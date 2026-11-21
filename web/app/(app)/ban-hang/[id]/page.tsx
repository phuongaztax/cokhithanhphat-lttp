import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ACCESS, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSale } from "@/lib/services/sales";
import { fmtDate, fmtMoney, fmtQty } from "@/lib/util";
import PrintButton from "@/components/PrintButton";
import CancelDocButton from "@/components/CancelDocButton";

// Xem / in phiếu bán
export default async function SaleDetail({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ moi?: string }>;
}) {
  const user = await requireUser(ACCESS.banHang);
  const { id } = await params;
  const { moi } = await searchParams;
  const data = getSale(getDb(), Number(id));
  if (!data) notFound();
  const { sale, items } = data;
  const s = sale as unknown as {
    code: string; date: string; customer_name: string | null; user_name: string; warehouse_name: string;
    payment_type: string; subtotal: number; discount: number; total: number; cash_given: number | null; id: number;
    status: string; cancelled_at: string | null; cancel_reason: string | null; cancelled_by_name: string | null;
  };
  const cancelled = s.status === "huy";
  const hasReturns = items.some((i) => i.returned_qty > 0);
  return (
    <>
      {moi && <div className="alert ok no-print">Đã lưu phiếu bán {s.code}.</div>}
      {cancelled && (
        <div className="alert err">
          <b>PHIẾU ĐÃ HỦY</b> lúc {fmtDate(s.cancelled_at)} {s.cancelled_at?.slice(11, 16)} bởi {s.cancelled_by_name}. Lý do: {s.cancel_reason}.
          Hàng đã được cộng lại vào kho{s.payment_type === "cong_no" ? ", khoản nợ của phiếu đã được bỏ" : ""}.
        </div>
      )}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>PHIẾU BÁN HÀNG</h1>
            <div className="muted">Cửa hàng cơ khí</div>
          </div>
          <div className="right">
            <div>Số: <b>{s.code}</b></div>
            <div>Ngày: {fmtDate(s.date)} {s.date.slice(11, 16)}</div>
          </div>
        </div>
        <div className="row">
          <span>Khách: <b>{s.customer_name ?? "Khách lẻ"}</b></span>
          <span>· NV bán: {s.user_name}</span>
          <span>· Kho xuất: {s.warehouse_name}</span>
          <span>· Thanh toán: {s.payment_type === "cong_no" ? <b className="red">Ghi công nợ</b> : "Tiền mặt"}</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>#</th><th>Hàng</th><th className="num">SL</th><th>ĐVT</th><th className="num">Đơn giá</th><th className="num">Thành tiền</th><th className="num">Đã trả lại</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id}>
                  <td>{i + 1}</td><td>{it.product_code} – {it.product_name}</td>
                  <td className="num">{fmtQty(it.qty)}</td><td>{it.unit}</td>
                  <td className="num">{fmtMoney(it.price)}</td><td className="num">{fmtMoney(it.amount)}</td>
                  <td className="num">{it.returned_qty ? `${fmtQty(it.returned_qty)} ${it.unit}` : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={5} className="right">Tổng tiền hàng</td><td className="num">{fmtMoney(s.subtotal)}</td><td></td></tr>
              {s.discount > 0 && <tr><td colSpan={5} className="right">Chiết khấu</td><td className="num">−{fmtMoney(s.discount)}</td><td></td></tr>}
              <tr><td colSpan={5} className="right">Phải trả</td><td className="num">{fmtMoney(s.total)} đ</td><td></td></tr>
              {s.cash_given != null && <tr><td colSpan={5} className="right">Khách đưa / Thối lại</td><td className="num">{fmtMoney(s.cash_given)} / {fmtMoney(s.cash_given - s.total)}</td><td></td></tr>}
            </tfoot>
          </table>
        </div>
      </div>
      <div className="actions no-print">
        <PrintButton />
        <Link className="btn primary" href="/ban-hang">Lập phiếu mới</Link>
        {!cancelled && <Link className="btn" href={`/tra-hang?code=${s.code}`}>Khách trả hàng</Link>}
        <Link className="btn" href="/ban-hang/danh-sach">Danh sách phiếu bán</Link>
        {!cancelled && can(user, ACCESS.quanTri) && !hasReturns && <CancelDocButton kind="sale" id={s.id} code={s.code} />}
      </div>
    </>
  );
}
