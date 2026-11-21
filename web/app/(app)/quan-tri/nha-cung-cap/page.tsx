import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listSuppliers, supplierReceipts } from "@/lib/services/master";
import { fmtDate, fmtMoney } from "@/lib/util";
import SupplierForm from "./SupplierForm";

// W11 – Quản lý nhà cung cấp (UC18)
export default async function NccPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  await requireUser(ACCESS.quanTri);
  const sp = await searchParams;
  const db = getDb();
  const rows = listSuppliers(db, sp.q ?? "");
  const sel = sp.id && sp.id !== "new" ? listSuppliers(db).find((s) => s.id === Number(sp.id)) : null;
  return (
    <>
      <h1>Nhà cung cấp</h1>
      <form className="row card" method="get">
        <input name="q" defaultValue={sp.q} placeholder="🔍 tên nhà cung cấp" className="grow" />
        <button className="primary">Tìm</button>
        <Link className="btn" href="?id=new">+ Thêm NCC</Link>
      </form>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Tên nhà cung cấp</th><th>Người liên hệ</th><th>SĐT</th><th>Lần nhập gần nhất</th><th className="num">Tổng đã nhập</th><th></th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={sel?.id === s.id ? "sel" : ""}>
                <td>{s.code}</td><td>{s.name}</td><td>{s.contact}</td><td>{s.phone}</td>
                <td>{fmtDate(s.last_purchase)}</td><td className="num">{fmtMoney(s.total_purchase)}</td>
                <td><Link href={`?id=${s.id}`}>Sửa</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(sel || sp.id === "new") && (
        <div className="grid2">
          <SupplierForm key={sp.id} initial={sel ? {
            id: sel.id, name: sel.name, contact: sel.contact ?? "", phone: sel.phone ?? "", address: sel.address ?? "", tax_code: sel.tax_code ?? "",
          } : null} />
          {sel && (
            <fieldset className="card">
              <legend>Lịch sử phiếu nhập</legend>
              <table className="tbl">
                <thead><tr><th>Số phiếu</th><th>Ngày</th><th className="num">Tổng tiền</th></tr></thead>
                <tbody>
                  {supplierReceipts(db, sel.id).map((r) => <tr key={r.id}><td><Link href={`/kho/nhap/${r.id}`}>{r.code}</Link>{r.status === "huy" && <> <span className="badge gray">Đã hủy</span></>}</td><td>{fmtDate(r.date)}</td><td className="num">{fmtMoney(r.total)}</td></tr>)}
                </tbody>
              </table>
            </fieldset>
          )}
        </div>
      )}
    </>
  );
}
