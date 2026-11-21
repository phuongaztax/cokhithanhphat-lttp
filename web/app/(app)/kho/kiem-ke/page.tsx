import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { productGroups, warehouses } from "@/lib/services/inventory";
import { listStocktakes } from "@/lib/services/warehouse";
import { fmtDate } from "@/lib/util";
import NewStocktake from "./NewStocktake";

// W06 – Kiểm kê kho (UC11): danh sách đợt + tạo đợt mới
export default async function KiemKePage() {
  await requireUser(ACCESS.kho);
  const db = getDb();
  const list = listStocktakes(db);
  return (
    <>
      <h1>Kiểm kê kho</h1>
      <NewStocktake warehouses={warehouses(db)} groups={productGroups(db)} />
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Đợt</th><th>Kho</th><th>Nhóm</th><th>Ngày tạo</th><th>Đã đếm</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/kho/kiem-ke/${s.id}`}>{s.code}</Link></td>
                <td>{s.warehouse_name}</td><td>{s.group_name ?? "Tất cả"}</td><td>{fmtDate(s.created_at)}</td>
                <td>{s.counted} / {s.total}</td>
                <td>{s.status === "chot" ? <span className="badge green">Đã chốt {fmtDate(s.closed_at)}</span> : <span className="badge">Đang kiểm</span>}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="muted">Chưa có đợt kiểm kê</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
