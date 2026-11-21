import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listCustomers } from "@/lib/services/master";
import { fmtMoney } from "@/lib/util";
import CustomerForm from "./CustomerForm";

// W08 – Quản lý khách hàng (UC13)
export default async function KhachHangPage({ searchParams }: { searchParams: Promise<{ q?: string; t?: string; id?: string }> }) {
  await requireUser(ACCESS.congNo);
  const sp = await searchParams;
  const db = getDb();
  const rows = listCustomers(db, sp.q ?? "", sp.t ?? "");
  const selId = sp.id && sp.id !== "new" ? Number(sp.id) : null;
  const sel = selId ? listCustomers(db).find((c) => c.id === selId) : null;
  const qs = (id: string | number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.t ? { t: sp.t } : {}), id: String(id) })}`;
  return (
    <>
      <h1>Quản lý khách hàng</h1>
      <form className="row card" method="get">
        <input name="q" defaultValue={sp.q} placeholder="🔍 tên / SĐT / mã" className="grow" />
        <span>Loại</span>
        <select name="t" defaultValue={sp.t ?? ""}><option value="">Tất cả</option><option value="thau">Thầu</option><option value="le">Lẻ</option></select>
        <button className="primary">Tìm</button>
        <Link className="btn" href={qs("new")}>+ Thêm khách</Link>
      </form>
      <div className="grid2" style={{ gridTemplateColumns: "3fr 2fr" }}>
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Mã</th><th>Tên khách</th><th>SĐT</th><th>Loại</th><th className="num">Hạn mức nợ</th><th className="num">Đang nợ</th><th></th></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.id === selId ? "sel" : ""}>
                  <td>{c.code}</td><td>{c.name}</td><td>{c.phone}</td>
                  <td>{c.type === "thau" ? "Thầu" : "Lẻ"}</td>
                  <td className="num">{c.type === "thau" ? (c.credit_limit ? fmtMoney(c.credit_limit) : "không giới hạn") : "–"}</td>
                  <td className="num">{c.balance > 0 ? <Link className="red" href={`/cong-no?kh=${c.id}`}>{fmtMoney(c.balance)}</Link> : "–"}</td>
                  <td>{c.code !== "KH000" && <Link href={qs(c.id)}>Sửa</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(sel || sp.id === "new") && (
          <CustomerForm key={sp.id} initial={sel ? {
            id: sel.id, name: sel.name, phone: sel.phone ?? "", address: sel.address ?? "", type: sel.type,
            credit_limit: sel.credit_limit, note: sel.note ?? "",
          } : null} />
        )}
      </div>
    </>
  );
}
