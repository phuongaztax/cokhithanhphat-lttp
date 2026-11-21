import { requireUser, can, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productGroups, searchStock, stockOf, warehouses } from "@/lib/services/inventory";
import { customersMini } from "@/lib/services/master";
import QuoteBoard from "./QuoteBoard";

// W02 – Tra cứu tồn kho & giá (UC01) / Báo giá (UC02)
export default async function TraCuuPage({ searchParams }: { searchParams: Promise<{ q?: string; g?: string; wh?: string }> }) {
  const user = await requireUser(ACCESS.traCuu);
  const sp = await searchParams;
  const db = getDb();
  const q = sp.q ?? "", g = sp.g ?? "", wh = sp.wh ? Number(sp.wh) : undefined;
  const whs = warehouses(db);
  const rows = searchStock(db, q, g, wh).map((r) => ({
    id: r.id, code: r.code, name: r.name, base_unit: r.base_unit, stock: r.stock, min_stock: r.min_stock, status: r.status,
    units: r.units.map((u) => ({ unit: u.unit, factor: u.factor, sale_price: u.sale_price })),
    byWh: whs.map((w) => ({ name: w.name, qty: stockOf(db, r.id, w.id) })),
  }));
  const canQuote = can(user, ACCESS.banHang);
  return (
    <>
      <h1>{canQuote ? "Tra cứu tồn kho & báo giá" : "Tra cứu tồn kho"}</h1>
      <form className="row card" method="get">
        <input name="q" defaultValue={q} placeholder="🔍 mã / tên hàng" className="grow" autoFocus />
        <select name="g" defaultValue={g}>
          <option value="">Tất cả nhóm</option>
          {productGroups(db).map((x) => <option key={x}>{x}</option>)}
        </select>
        <select name="wh" defaultValue={sp.wh ?? ""}>
          <option value="">Tất cả kho</option>
          {whs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="primary">Tìm</button>
      </form>
      <QuoteBoard rows={rows} customers={canQuote ? customersMini(db) : []} canQuote={canQuote} />
    </>
  );
}
