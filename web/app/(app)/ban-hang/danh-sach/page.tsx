import Link from "next/link";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { recentSales } from "@/lib/services/sales";
import { fmtDate, fmtMoney } from "@/lib/util";

export default async function SalesList() {
  await requireUser(ACCESS.banHang);
  const rows = recentSales(getDb(), 100);
  return (
    <>
      <h1>Phiếu bán đã lập (100 phiếu gần nhất)</h1>
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Số phiếu</th><th>Ngày</th><th>Khách</th><th>NV bán</th><th>Thanh toán</th><th className="num">Tổng tiền</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/ban-hang/${r.id}`}>{r.code}</Link></td>
                <td>{fmtDate(r.date)} {r.date.slice(11, 16)}</td>
                <td>{r.customer_name}</td><td>{r.user_name}</td>
                <td>{r.status === "huy" ? <span className="badge gray">Đã hủy</span> : r.payment_type === "cong_no" ? <span className="badge red">Ghi nợ</span> : <span className="badge green">Tiền mặt</span>}</td>
                <td className="num" style={r.status === "huy" ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>{fmtMoney(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
