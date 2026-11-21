import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUnits, warehouses } from "@/lib/services/inventory";
import { lotsInWarehouse, recentTransfers } from "@/lib/services/warehouse";
import { fmtDate } from "@/lib/util";
import TransferForm from "./TransferForm";

// W07 – Chuyển kho (UC21 + UC01 + UC04)
export default async function ChuyenKhoPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const user = await requireUser(ACCESS.kho);
  const { ok } = await searchParams;
  const db = getDb();
  const whs = warehouses(db);
  const lots = Object.fromEntries(whs.map((w) => [w.id, lotsInWarehouse(db, w.id).map((l) => ({
    ...l, units: getUnits(db, l.product_id).map((u) => ({ unit: u.unit, factor: u.factor })),
  }))]));
  return (
    <>
      <h1>Chuyển kho</h1>
      {ok && <div className="alert ok">Đã lưu phiếu chuyển {ok}.</div>}
      <TransferForm warehouses={whs} lotsByWh={lots} userName={user.full_name} />
      <h2 style={{ marginTop: 24 }}>Phiếu chuyển gần đây</h2>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Kho nguồn</th><th>Kho đích</th><th className="num">Số dòng</th></tr></thead>
          <tbody>
            {recentTransfers(db).map((t) => (
              <tr key={t.id}><td>{t.code}</td><td>{fmtDate(t.date)}</td><td>{t.from_name}</td><td>{t.to_name}</td><td className="num">{t.lines}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
