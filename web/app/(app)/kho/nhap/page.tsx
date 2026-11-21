import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productCatalog, warehouses } from "@/lib/services/inventory";
import { suppliersMini } from "@/lib/services/master";
import { lastLotPrices, recentPurchases } from "@/lib/services/warehouse";
import { fmtDate, fmtMoney } from "@/lib/util";
import PurchaseForm from "./PurchaseForm";

// W05 – Lập phiếu nhập hàng (UC09 + UC10 + UC04)
export default async function NhapPage({ searchParams }: { searchParams: Promise<{ ok?: string; ncc?: string }> }) {
  const user = await requireUser(ACCESS.kho);
  const { ok, ncc } = await searchParams;
  const db = getDb();
  const catalog = productCatalog(db);
  const history = Object.fromEntries(catalog.map((p) => [p.id, lastLotPrices(db, p.id)]));
  return (
    <>
      <h1>Lập phiếu nhập hàng</h1>
      {ok && <div className="alert ok">Đã lưu phiếu nhập {ok}. Bấm số phiếu ở danh sách bên dưới để xem / in.</div>}
      <PurchaseForm catalog={catalog} suppliers={suppliersMini(db)} warehouses={warehouses(db)}
        history={history} userName={user.full_name} defaultSupplier={ncc ? Number(ncc) : undefined} />
      <h2 style={{ marginTop: 24 }}>Phiếu nhập gần đây</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Nhà cung cấp</th><th>Kho</th><th className="num">Tổng tiền</th></tr></thead>
          <tbody>
            {recentPurchases(db).map((r) => (
              <tr key={r.id}><td><Link href={`/kho/nhap/${r.id}`}>{r.code}</Link>{r.status === "huy" && <> <span className="badge gray">Đã hủy</span></>}</td><td>{fmtDate(r.date)}</td><td>{r.supplier_name}</td><td>{r.warehouse_name}</td><td className="num">{fmtMoney(r.total)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
