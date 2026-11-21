import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ACCESS, can } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPurchase } from "@/lib/services/warehouse";
import { fmtDate, fmtMoney, fmtQty } from "@/lib/util";
import PrintButton from "@/components/PrintButton";
import CancelDocButton from "@/components/CancelDocButton";
import PriceEditor from "./PriceEditor";

// Chi tiết phiếu nhập (W05) – chủ cửa hàng sửa giá nhập / hủy phiếu
export default async function PurchaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(ACCESS.kho);
  const { id } = await params;
  const data = getPurchase(getDb(), Number(id));
  if (!data) notFound();
  const { pr, items, log } = data;
  const owner = can(user, ACCESS.quanTri);
  const cancelled = pr.status === "huy";
  const anyUsed = items.some((i) => i.used);
  return (
    <>
      {cancelled && (
        <div className="alert err">
          <b>PHIẾU ĐÃ HỦY</b> lúc {fmtDate(pr.cancelled_at)} {pr.cancelled_at?.slice(11, 16)} bởi {pr.cancelled_by_name}. Lý do: {pr.cancel_reason}. Tồn của các lô đã về 0.
        </div>
      )}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>PHIẾU NHẬP HÀNG</h1>
          <div className="right"><div>Số: <b>{pr.code}</b></div><div>Ngày: {fmtDate(pr.date)}</div></div>
        </div>
        <div className="row">
          <span>Nhà cung cấp: <b>{pr.supplier_name}</b></span><span>· Kho nhập: {pr.warehouse_name}</span><span>· Thủ kho: {pr.user_name}</span>
          {pr.note && <span>· Ghi chú: {pr.note}</span>}
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Hàng</th><th className="num">SL</th><th>ĐVT</th><th className="num">Giá nhập</th><th className="num">Thành tiền</th><th>Lô</th><th className="num">Lô còn</th><th className="no-print">Tình trạng lô</th></tr></thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.product_code} – {i.product_name}</td>
                  <td className="num">{fmtQty(i.qty)}</td><td>{i.unit}</td>
                  <td className="num">
                    {owner && !cancelled ? <PriceEditor itemId={i.id} price={i.price} unit={i.unit} /> : fmtMoney(i.price)}
                  </td>
                  <td className="num">{fmtMoney(i.amount)}</td>
                  <td>{i.lot_code}</td>
                  <td className="num">{fmtQty(i.lot_remaining)} {i.base_unit}</td>
                  <td className="no-print">{i.used ? <span className="badge">đã bán / chuyển / kiểm kê</span> : <span className="badge green">chưa dùng</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={4} className="right">Tổng tiền nhập</td><td className="num">{fmtMoney(pr.total)} đ</td><td colSpan={3}></td></tr></tfoot>
          </table>
        </div>
        {owner && !cancelled && (
          <p className="note no-print">
            Sửa giá nhập: giá vốn của các phiếu bán / trả hàng đã dùng lô được tính lại (giá trị lệch các đợt kiểm kê đã chốt giữ nguyên).
            Hủy phiếu chỉ được khi chưa lô nào được dùng{anyUsed ? " – phiếu này đã có lô được dùng nên không hủy được" : ""}.
          </p>
        )}
      </div>

      <div className="actions no-print">
        <PrintButton />
        <Link className="btn" href="/kho/nhap">Về phiếu nhập</Link>
        {owner && !cancelled && !anyUsed && <CancelDocButton kind="purchase" id={pr.id} code={pr.code} />}
      </div>

      {log.length > 0 && (
        <fieldset className="card no-print" style={{ marginTop: 16 }}>
          <legend>Lịch sử chỉnh sửa</legend>
          <table className="tbl">
            <thead><tr><th>Thời gian</th><th>Người sửa</th><th>Nội dung</th></tr></thead>
            <tbody>{log.map((l, k) => <tr key={k}><td>{fmtDate(l.date)} {l.date.slice(11, 16)}</td><td>{l.full_name}</td><td>{l.detail}</td></tr>)}</tbody>
          </table>
        </fieldset>
      )}
    </>
  );
}
