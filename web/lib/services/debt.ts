import type { DB } from "../db-core";
import { BizError, daysBetween, nextDocCode, nowLocal, round } from "../util";

type Entry = { id: number; customer_id: number; date: string; doc_type: string; doc_code: string; description: string; debit: number; credit: number };

export function balanceOf(db: DB, customerId: number): number {
  const r = db.prepare("SELECT COALESCE(SUM(debit - credit),0) AS b FROM debt_entries WHERE customer_id = ?").get(customerId) as { b: number };
  return round(r.b, 2);
}

/** Phân bổ các khoản giảm nợ vào phiếu nợ cũ nhất trước (FIFO) → nợ còn lại của từng phiếu. */
export function outstandingDebits(db: DB, customerId: number) {
  const entries = db.prepare("SELECT * FROM debt_entries WHERE customer_id = ? ORDER BY date, id").all(customerId) as Entry[];
  let credits = entries.reduce((s, e) => s + e.credit, 0);
  const res: (Entry & { remaining: number })[] = [];
  for (const e of entries.filter((x) => x.debit > 0)) {
    const used = Math.min(credits, e.debit);
    credits -= used;
    res.push({ ...e, remaining: round(e.debit - used, 2) });
  }
  return res;
}

/** UC14: sổ chi tiết công nợ trong kỳ. */
export function ledger(db: DB, customerId: number, from: string, to: string) {
  const opening = (db.prepare(
    "SELECT COALESCE(SUM(debit - credit),0) AS b FROM debt_entries WHERE customer_id = ? AND substr(date,1,10) < ?",
  ).get(customerId, from) as { b: number }).b;
  const rows = db.prepare(
    "SELECT * FROM debt_entries WHERE customer_id = ? AND substr(date,1,10) BETWEEN ? AND ? ORDER BY date, id",
  ).all(customerId, from, to) as Entry[];
  const out = outstandingDebits(db, customerId);
  let bal = opening;
  const lines = rows.map((r) => {
    bal += r.debit - r.credit;
    const o = out.find((x) => x.id === r.id);
    return { ...r, balance: round(bal, 2), remaining: o?.remaining ?? 0, days: o && o.remaining > 0 ? daysBetween(r.date) : null };
  });
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);
  return { opening: round(opening, 2), debit, credit, closing: round(opening + debit - credit, 2), lines, current: balanceOf(db, customerId) };
}

/** Danh sách khách đang nợ (W09 tab 2, báo cáo R2). */
export function debtors(db: DB) {
  const cs = db.prepare("SELECT id, code, name, phone, credit_limit FROM customers WHERE type = 'thau' ORDER BY name").all() as {
    id: number; code: string; name: string; phone: string; credit_limit: number;
  }[];
  return cs
    .map((c) => {
      const out = outstandingDebits(db, c.id).filter((d) => d.remaining > 0);
      const balance = balanceOf(db, c.id);
      const since = out[0]?.date ?? null;
      return { ...c, balance, since, days: since ? daysBetween(since) : 0, open_docs: out.length };
    })
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);
}

/** UC15: thu nợ. */
export function createPayment(
  db: DB, userId: number,
  input: { customerId: number; amount: number; method: string; note?: string }, date = nowLocal(),
) {
  if (!(input.amount > 0)) throw new BizError("Số tiền thu phải lớn hơn 0");
  const bal = balanceOf(db, input.customerId);
  if (input.amount > bal + 1e-6) throw new BizError(`Số tiền thu vượt số nợ hiện tại (${bal.toLocaleString("vi-VN")} đ)`);
  return db.transaction(() => {
    const code = nextDocCode(db, "payments", "PT", date);
    const id = Number(db.prepare(
      "INSERT INTO payments (code, date, customer_id, user_id, amount, method, note) VALUES (?,?,?,?,?,?,?)",
    ).run(code, date, input.customerId, userId, input.amount, input.method, input.note ?? null).lastInsertRowid);
    db.prepare(
      "INSERT INTO debt_entries (customer_id, date, doc_type, doc_code, description, credit) VALUES (?,?,?,?,?,?)",
    ).run(input.customerId, date, "thu", code, input.note ? `Thu nợ – ${input.note}` : "Thu nợ", input.amount);
    return { id, code, remaining: round(bal - input.amount, 2) };
  })();
}

/**
 * Ghi nợ đầu kỳ (chủ cửa hàng) – chuyển số nợ từ sổ tay cũ sang phần mềm khi bắt đầu sử dụng.
 * Chỉ khách thầu; ngày ghi có thể là ngày phát sinh nợ thực tế để tính đúng "nợ từ ngày".
 */
export function createOpeningDebt(
  db: DB, userId: number,
  input: { customerId: number; amount: number; date: string; note?: string },
) {
  if (!(input.amount > 0)) throw new BizError("Số nợ phải lớn hơn 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new BizError("Ngày không hợp lệ");
  if (input.date > nowLocal().slice(0, 10)) throw new BizError("Ngày nợ đầu kỳ không được sau hôm nay");
  const c = db.prepare("SELECT type FROM customers WHERE id = ?").get(input.customerId) as { type: string } | undefined;
  if (!c) throw new BizError("Không tìm thấy khách hàng");
  if (c.type !== "thau") throw new BizError("Chỉ ghi nợ đầu kỳ cho khách thầu");
  // Nợ đầu kỳ ghi lùi ngày → nếu khách đã có giao dịch trên phần mềm, các khoản đã trả sẽ bị phân bổ lại sai.
  const other = db.prepare("SELECT 1 FROM debt_entries WHERE customer_id = ? AND doc_type <> 'dau_ky' LIMIT 1").get(input.customerId);
  if (other) throw new BizError("Khách đã có giao dịch công nợ trên phần mềm – nợ đầu kỳ chỉ ghi trước khi phát sinh giao dịch đầu tiên");
  return db.transaction(() => {
    const ymd = input.date.replaceAll("-", "");
    const n = (db.prepare("SELECT COUNT(*) AS n FROM debt_entries WHERE doc_code LIKE ?").get(`NDK-${ymd}-%`) as { n: number }).n;
    const code = `NDK-${ymd}-${String(n + 1).padStart(3, "0")}`;
    const note = input.note?.trim();
    db.prepare(
      "INSERT INTO debt_entries (customer_id, date, doc_type, doc_code, description, debit) VALUES (?,?,?,?,?,?)",
    ).run(input.customerId, `${input.date} 00:00:00`, "dau_ky", code, note ? `Nợ đầu kỳ – ${note}` : "Nợ đầu kỳ", input.amount);
    db.prepare("INSERT INTO change_log (date, user_id, action, doc_code, detail) VALUES (?,?,?,?,?)")
      .run(nowLocal(), userId, "no_dau_ky", code, `Ghi nợ đầu kỳ ${input.amount.toLocaleString("vi-VN")} đ`);
    return { code };
  })();
}
