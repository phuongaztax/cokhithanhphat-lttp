import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productGroups } from "@/lib/services/inventory";
import { getProductFull, listProducts } from "@/lib/services/master";
import { fmtQty } from "@/lib/util";
import ProductForm from "./ProductForm";

// W10 – Quản lý hàng hóa (UC16) + Khai báo đơn vị & hệ số quy đổi (UC17)
export default async function HangHoaPage({ searchParams }: { searchParams: Promise<{ q?: string; g?: string; id?: string }> }) {
  await requireUser(ACCESS.quanTri);
  const sp = await searchParams;
  const db = getDb();
  const rows = listProducts(db, sp.q ?? "", sp.g ?? "");
  const groups = productGroups(db);
  const sel = sp.id && sp.id !== "new" ? getProductFull(db, Number(sp.id)) : null;
  const qs = (id: string | number) => `?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.g ? { g: sp.g } : {}), id: String(id) })}`;
  return (
    <>
      <h1>Hàng hóa & đơn vị tính</h1>
      <form className="row card" method="get">
        <input name="q" defaultValue={sp.q} placeholder="🔍 mã / tên hàng" className="grow" />
        <span>Nhóm</span>
        <select name="g" defaultValue={sp.g ?? ""}><option value="">Tất cả</option>{groups.map((g) => <option key={g}>{g}</option>)}</select>
        <button className="primary">Tìm</button>
        <Link className="btn" href={qs("new")}>+ Thêm hàng</Link>
      </form>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Tên hàng</th><th>Nhóm</th><th>ĐV cơ sở</th><th className="num">Tồn</th><th className="num">Tồn tối thiểu</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={sel?.id === p.id ? "sel" : ""}>
                <td>{p.code}</td><td>{p.name}</td><td>{p.group_name}</td><td>{p.base_unit}</td>
                <td className={`num ${p.min_stock > 0 && p.stock <= p.min_stock ? "red b" : ""}`}>{fmtQty(p.stock)}</td>
                <td className="num">{fmtQty(p.min_stock)}</td>
                <td>{p.status === "dang_ban" ? <span className="badge green">Đang bán</span> : <span className="badge gray">Ngừng nhập</span>}</td>
                <td><Link href={qs(p.id)}>Sửa</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(sel || sp.id === "new") && (
        <ProductForm key={sp.id} groups={groups} initial={sel ? {
          id: sel.id, code: sel.code, name: sel.name, group_name: sel.group_name, base_unit: sel.base_unit,
          min_stock: sel.min_stock, status: sel.status,
          units: sel.units.map((u) => ({ unit: u.unit, factor: u.factor, sale_price: u.sale_price, usage: u.usage ?? "" })),
        } : null} />
      )}
    </>
  );
}
