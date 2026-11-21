import type { DB } from "../db-core";
import { BizError, nextDocCode, nowLocal, round } from "../util";
import { consumeFIFO, getProduct, getUnit, addToLot } from "./inventory";
import { balanceOf } from "./debt";

export type SaleInput = {
  customerId: number | null;
  paymentType: "tien_mat" | "cong_no";
  warehouseId: number;
  items: { productId: number; unit: string; qty: number; price?: number }[];
  discount?: number;
  cashGiven?: number | null;
  note?: string;
};

type Customer = { id: number; name: string; type: "le" | "thau"; credit_limit: number };

/** UC03 lập phiếu bán (+UC04 quy đổi ĐVT, UC05 thu tiền ngay / UC06 ghi công nợ). */
export function createSale(db: DB, userId: number, input: SaleInput, date = nowLocal()) {
  if (!input.items.length) throw new BizError("Phiếu bán chưa có mặt hàng nào");
  let customer: Customer | undefined;
  if (input.customerId) {
    customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(input.customerId) as Customer | undefined;
    if (!customer) throw new BizError("Không tìm thấy khách hàng");
  }
  if (input.paymentType === "cong_no" && customer?.type !== "thau")
    throw new BizError("Chỉ khách thầu mới được ghi công nợ");

  return db.transaction(() => {
    const lines = input.items.map((it) => {
      if (!(it.qty > 0)) throw new BizError("Số lượng phải lớn hơn 0");
      const p = getProduct(db, it.productId);
      const u = getUnit(db, p.id, it.unit); // UC04: quy đổi theo hệ số đã khai báo
      const price = it.price ?? u.sale_price;
      if (price < 0) throw new BizError("Đơn giá không hợp lệ");
      return { p, u, qty: it.qty, price, amount: round(it.qty * price, 2) };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    const discount = input.discount ?? 0;
    if (discount < 0 || discount > subtotal) throw new BizError("Chiết khấu không hợp lệ");
    const total = subtotal - discount;
    if (input.paymentType === "tien_mat" && input.cashGiven != null && input.cashGiven < total)
      throw new BizError("Khách đưa chưa đủ tiền");

    const code = nextDocCode(db, "sales", "PB", date);
    const saleId = Number(
      db.prepare(
        `INSERT INTO sales (code, date, customer_id, user_id, warehouse_id, payment_type, subtotal, discount, total, cash_given, note)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(code, date, customer?.id ?? null, userId, input.warehouseId, input.paymentType, subtotal, discount, total,
        input.cashGiven ?? null, input.note ?? null).lastInsertRowid,
    );
    const insItem = db.prepare(
      "INSERT INTO sale_items (sale_id, product_id, unit, factor, qty, price, amount, cost) VALUES (?,?,?,?,?,?,?,?)",
    );
    const insAlloc = db.prepare("INSERT INTO sale_item_lots (sale_item_id, lot_id, qty_base, cost_per_base) VALUES (?,?,?,?)");
    for (const l of lines) {
      const used = consumeFIFO(db, l.p.id, input.warehouseId, round(l.qty * l.u.factor));
      const cost = round(used.reduce((s, a) => s + a.qty_base * a.cost_per_base, 0), 2);
      const itemId = Number(insItem.run(saleId, l.p.id, l.u.unit, l.u.factor, l.qty, l.price, l.amount, cost).lastInsertRowid);
      for (const a of used) insAlloc.run(itemId, a.lot_id, a.qty_base, a.cost_per_base);
    }
    if (input.paymentType === "cong_no" && customer) {
      // UC06: lưu số tiền nợ và ngày phát sinh theo phiếu
      db.prepare(
        "INSERT INTO debt_entries (customer_id, date, doc_type, doc_code, description, debit) VALUES (?,?,?,?,?,?)",
      ).run(customer.id, date, "ban", code, "Mua hàng", total);
    }
    return { id: saleId, code };
  })();
}

export function getSale(db: DB, id: number) {
  const sale = db.prepare(
    `SELECT s.*, c.name AS customer_name, c.type AS customer_type, u.full_name AS user_name, w.name AS warehouse_name,
       cu.full_name AS cancelled_by_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
     JOIN warehouses w ON w.id = s.warehouse_id LEFT JOIN users cu ON cu.id = s.cancelled_by WHERE s.id = ?`,
  ).get(id) as (Record<string, unknown> & { id: number; code: string; total: number; subtotal: number; payment_type: string; customer_id: number | null }) | undefined;
  if (!sale) return null;
  const items = db.prepare(
    `SELECT si.*, p.code AS product_code, p.name AS product_name, p.base_unit,
       COALESCE((SELECT SUM(ri.qty) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned_qty
     FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ? ORDER BY si.id`,
  ).all(id) as {
    id: number; product_code: string; product_name: string; base_unit: string; unit: string; factor: number;
    qty: number; price: number; amount: number; returned_qty: number;
  }[];
  return { sale, items };
}

export function findSaleByCode(db: DB, code: string) {
  const r = db.prepare("SELECT id FROM sales WHERE code = ?").get(code.trim()) as { id: number } | undefined;
  return r ? getSale(db, r.id) : null;
}

export function recentSales(db: DB, limit = 30) {
  return db.prepare(
    `SELECT s.id, s.code, s.date, s.total, s.payment_type, s.status, COALESCE(c.name,'Khách lẻ') AS customer_name, u.full_name AS user_name
     FROM sales s LEFT JOIN customers c ON c.id = s.customer_id JOIN users u ON u.id = s.user_id
     ORDER BY s.date DESC, s.id DESC LIMIT ?`,
  ).all(limit) as { id: number; code: string; date: string; total: number; payment_type: string; status: string; customer_name: string; user_name: string }[];
}

/**
 * Hủy phiếu bán (chủ cửa hàng) – dùng khi lập nhầm phiếu.
 * Điều kiện: phiếu chưa bị hủy, chưa có phiếu trả hàng; với phiếu ghi nợ, khách chưa trả phần nợ đó
 * (bỏ khoản nợ của phiếu mà số dư không bị âm). Hàng được cộng lại đúng các lô đã xuất.
 */
export function cancelSale(db: DB, userId: number, saleId: number, reason: string, date = nowLocal()) {
  const why = reason.trim();
  if (!why) throw new BizError("Nhập lý do hủy phiếu");
  const s = db.prepare("SELECT * FROM sales WHERE id = ?").get(saleId) as
    { id: number; code: string; status: string; payment_type: string; customer_id: number | null; total: number } | undefined;
  if (!s) throw new BizError("Không tìm thấy phiếu bán");
  if (s.status === "huy") throw new BizError("Phiếu đã bị hủy trước đó");
  const nRet = (db.prepare("SELECT COUNT(*) AS n FROM returns WHERE sale_id = ?").get(saleId) as { n: number }).n;
  if (nRet) throw new BizError("Phiếu đã có phiếu trả hàng, không hủy được – tiếp tục dùng chức năng trả hàng");
  return db.transaction(() => {
    if (s.payment_type === "cong_no" && s.customer_id) {
      db.prepare("DELETE FROM debt_entries WHERE doc_type = 'ban' AND doc_code = ?").run(s.code);
      if (balanceOf(db, s.customer_id) < -0.01)
        throw new BizError("Khách đã thanh toán phần nợ của phiếu này – không hủy được, hãy dùng trả hàng");
    }
    const allocs = db.prepare(
      "SELECT a.lot_id, a.qty_base FROM sale_item_lots a JOIN sale_items si ON si.id = a.sale_item_id WHERE si.sale_id = ?",
    ).all(saleId) as { lot_id: number; qty_base: number }[];
    for (const a of allocs) addToLot(db, a.lot_id, a.qty_base);
    db.prepare("UPDATE sales SET status = 'huy', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?").run(date, userId, why, saleId);
    db.prepare("INSERT INTO change_log (date, user_id, action, doc_code, detail) VALUES (?,?,?,?,?)")
      .run(date, userId, "huy_phieu_ban", s.code, `Hủy phiếu bán ${s.code} (${s.total.toLocaleString("vi-VN")} đ). Lý do: ${why}`);
    return { code: s.code };
  })();
}

export type ReturnInput = {
  saleId: number;
  method: "tru_no" | "hoan_tien";
  reason?: string;
  items: { saleItemId: number; qty: number; intact: boolean }[];
};

/** UC07 xử lý khách trả hàng (+UC08 trừ công nợ / hoàn tiền). Chỉ nhận hàng còn nguyên. */
export function createReturn(db: DB, userId: number, input: ReturnInput, date = nowLocal()) {
  const data = getSale(db, input.saleId);
  if (!data) throw new BizError("Không tìm thấy phiếu bán gốc");
  const { sale, items } = data;
  if (sale.status === "huy") throw new BizError("Phiếu bán đã bị hủy, không nhận trả hàng");
  const lines = input.items.filter((i) => i.qty > 0);
  if (!lines.length) throw new BizError("Chưa chọn hàng trả");
  const customer = sale.customer_id
    ? (db.prepare("SELECT * FROM customers WHERE id = ?").get(sale.customer_id) as Customer)
    : undefined;
  if (input.method === "tru_no" && customer?.type !== "thau")
    throw new BizError("Chỉ trừ công nợ được với khách thầu; khách lẻ thì hoàn tiền");
  const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1; // phân bổ chiết khấu

  return db.transaction(() => {
    const code = nextDocCode(db, "returns", "TH", date);
    let total = 0, totalCost = 0;
    const prepared = lines.map((l) => {
      const it = items.find((x) => x.id === l.saleItemId);
      if (!it) throw new BizError("Dòng hàng không thuộc phiếu bán này");
      if (!l.intact) throw new BizError(`${it.product_name}: chỉ nhận lại hàng còn nguyên`);
      const remain = it.qty - it.returned_qty;
      if (l.qty > remain + 1e-9) throw new BizError(`${it.product_name}: chỉ được trả tối đa ${remain} ${it.unit}`);
      return { it, qty: l.qty };
    });
    const retId = Number(
      db.prepare(
        "INSERT INTO returns (code, date, sale_id, customer_id, user_id, method, total, cost, reason) VALUES (?,?,?,?,?,?,0,0,?)",
      ).run(code, date, sale.id, sale.customer_id, userId, input.method, input.reason ?? null).lastInsertRowid,
    );
    for (const { it, qty } of prepared) {
      const amount = round(qty * it.price * ratio, 0);
      const riId = Number(db.prepare("INSERT INTO return_items (return_id, sale_item_id, qty, amount, cost) VALUES (?,?,?,?,0)")
        .run(retId, it.id, qty, amount).lastInsertRowid);
      // cộng lại tồn kho vào đúng các lô đã xuất, ghi lại lô nào để tính lại giá vốn khi sửa giá nhập
      let need = round(qty * it.factor);
      let cost = 0;
      const allocs = db.prepare("SELECT * FROM sale_item_lots WHERE sale_item_id = ? ORDER BY id").all(it.id) as {
        id: number; lot_id: number; qty_base: number; cost_per_base: number; returned_base: number;
      }[];
      for (const a of allocs) {
        if (need <= 1e-9) break;
        const take = Math.min(a.qty_base - a.returned_base, need);
        if (take <= 0) continue;
        addToLot(db, a.lot_id, take);
        db.prepare("UPDATE sale_item_lots SET returned_base = returned_base + ? WHERE id = ?").run(take, a.id);
        db.prepare("INSERT INTO return_item_lots (return_item_id, sale_item_lot_id, qty_base) VALUES (?,?,?)").run(riId, a.id, take);
        cost += take * a.cost_per_base;
        need -= take;
      }
      db.prepare("UPDATE return_items SET cost = ? WHERE id = ?").run(round(cost, 2), riId);
      total += amount;
      totalCost += cost;
    }
    db.prepare("UPDATE returns SET total = ?, cost = ? WHERE id = ?").run(total, round(totalCost, 2), retId);
    if (input.method === "tru_no" && customer) {
      const bal = balanceOf(db, customer.id);
      if (total > bal + 1e-6) throw new BizError(`Tiền trả lại (${total}) lớn hơn số nợ hiện tại (${bal}); chọn hoàn tiền`);
      db.prepare(
        "INSERT INTO debt_entries (customer_id, date, doc_type, doc_code, description, credit) VALUES (?,?,?,?,?,?)",
      ).run(customer.id, date, "tra", code, "Trả hàng", total);
    }
    return { id: retId, code, total };
  })();
}
