import Link from "next/link";
import { requireUser, ACCESS, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { debtors, ledger } from "@/lib/services/debt";
import { fmtDate, fmtMoney, today } from "@/lib/util";
import PrintButton from "@/components/PrintButton";
import PaymentForm from "./PaymentForm";
import OpeningDebtForm from "./OpeningDebtForm";

// W09 – Tra cứu công nợ (UC14) & Thu nợ cuối tháng (UC15)
export default async function CongNoPage({ searchParams }: {
  searchParams: Promise<{ tab?: string; kh?: string; from?: string; to?: string; thu?: string; ok?: string }>;
}) {
  const user = await requireUser(ACCESS.congNo);
  const sp = await searchParams;
  const db = getDb();
  const all = debtors(db);
  const thau = db.prepare("SELECT id, name FROM customers WHERE type = 'thau' ORDER BY name").all() as { id: number; name: string }[];
  const tab = sp.tab === "ds" ? "ds" : "tc";
  const kh = sp.kh ? Number(sp.kh) : all[0]?.id ?? thau[0]?.id;
  const t = today();
  const from = sp.from ?? `${t.slice(0, 8)}01`;
  const to = sp.to ?? t;
  const L = kh ? ledger(db, kh, from, to) : null;
  const name = thau.find((c) => c.id === kh)?.name ?? "";

  return (
    <>
      <h1>Công nợ khách hàng</h1>
      <div className="tabs no-print">
        <Link href={`/cong-no?kh=${kh ?? ""}`} className={tab === "tc" ? "on" : ""}>Tra cứu công nợ</Link>
        <Link href="/cong-no?tab=ds" className={tab === "ds" ? "on" : ""}>Danh sách khách đang nợ ({all.length})</Link>
      </div>

      {tab === "ds" ? (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Khách</th><th>SĐT</th><th className="num">Đang nợ</th><th className="num">Hạn mức</th><th>Nợ từ ngày</th><th className="num">Số ngày nợ</th><th className="num">Phiếu chưa trả</th><th></th></tr></thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.id}>
                  <td>{d.name}</td><td>{d.phone}</td>
                  <td className="num red b">{fmtMoney(d.balance)}</td>
                  <td className="num">{d.credit_limit ? fmtMoney(d.credit_limit) : "–"}</td>
                  <td>{fmtDate(d.since)}</td>
                  <td className={`num ${d.days > 30 ? "red b" : ""}`}>{d.days}</td>
                  <td className="num">{d.open_docs}</td>
                  <td><Link href={`/cong-no?kh=${d.id}`}>Chi tiết</Link> · <Link href={`/cong-no?kh=${d.id}&thu=1`}>Thu nợ</Link></td>
                </tr>
              ))}
              {!all.length && <tr><td colSpan={8} className="muted">Không có khách nào đang nợ</td></tr>}
            </tbody>
            <tfoot><tr><td colSpan={2} className="right">Tổng</td><td className="num">{fmtMoney(all.reduce((s, d) => s + d.balance, 0))}</td><td colSpan={5}></td></tr></tfoot>
          </table>
        </div>
      ) : (
        <>
          {sp.ok && <div className="alert ok">Đã lưu phiếu thu {sp.ok}.</div>}
          <form className="row card no-print" method="get">
            <span>Khách</span>
            <select name="kh" defaultValue={kh}>{thau.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <span>Từ</span><input type="date" name="from" defaultValue={from} />
            <span>Đến</span><input type="date" name="to" defaultValue={to} />
            <button className="primary">Xem</button>
          </form>
          {L && (
            <>
              <h2 className="only-print">BẢNG KÊ CÔNG NỢ – {name} – từ {fmtDate(from)} đến {fmtDate(to)}</h2>
              <div className="stats">
                <div className="stat"><div className="k">Nợ đầu kỳ</div><div className="v">{fmtMoney(L.opening)}</div></div>
                <div className="stat"><div className="k">Phát sinh</div><div className="v">{fmtMoney(L.debit)}</div></div>
                <div className="stat"><div className="k">Đã trừ / trả</div><div className="v">{fmtMoney(L.credit)}</div></div>
                <div className="stat"><div className="k">Còn nợ cuối kỳ</div><div className="v red">{fmtMoney(L.closing)} đ</div></div>
              </div>
              <div className="card tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Ngày</th><th>Chứng từ</th><th>Diễn giải</th><th className="num">Phát sinh nợ</th><th className="num">Giảm nợ</th><th className="num">Số dư</th><th className="num">Phiếu còn nợ</th><th className="num">Số ngày nợ</th></tr></thead>
                  <tbody>
                    {L.lines.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtDate(r.date)}</td><td>{r.doc_code}</td><td>{r.description}</td>
                        <td className="num">{r.debit ? fmtMoney(r.debit) : ""}</td>
                        <td className="num">{r.credit ? fmtMoney(r.credit) : ""}</td>
                        <td className="num">{fmtMoney(r.balance)}</td>
                        <td className="num">{r.debit ? (r.remaining > 0 ? fmtMoney(r.remaining) : <span className="green">đã trả đủ</span>) : ""}</td>
                        <td className={`num ${r.days != null && r.days > 30 ? "red b" : ""}`}>{r.days ?? ""}</td>
                      </tr>
                    ))}
                    {!L.lines.length && <tr><td colSpan={8} className="muted">Không có phát sinh trong kỳ</td></tr>}
                  </tbody>
                </table>
                <p className="note">Khoản giảm nợ (trả hàng, thu nợ) được trừ dần vào các phiếu nợ cũ nhất trước.</p>
              </div>
              <div className="actions no-print">
                <PrintButton label="In bảng kê công nợ" />
                {L.current > 0 && <Link className="btn primary" href={`/cong-no?kh=${kh}&from=${from}&to=${to}&thu=1`}>Thu nợ khách này</Link>}
              </div>
              {sp.thu && L.current > 0 && (
                <PaymentForm customerId={kh!} customerName={name} balance={L.current} userName={user.full_name} back={`/cong-no?kh=${kh}&from=${from}&to=${to}`} />
              )}
            </>
          )}
          {can(user, ACCESS.quanTri) && thau.length > 0 && <OpeningDebtForm key={kh} customers={thau} defaultCustomer={kh} />}
        </>
      )}
    </>
  );
}
