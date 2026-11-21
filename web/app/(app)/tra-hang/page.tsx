import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { findSaleByCode } from "@/lib/services/sales";
import { balanceOf } from "@/lib/services/debt";
import { fmtDate } from "@/lib/util";
import ReturnForm from "./ReturnForm";

// W04 – Xử lý khách trả hàng (UC07 + UC08)
export default async function TraHangPage({ searchParams }: { searchParams: Promise<{ code?: string; ok?: string }> }) {
  await requireUser(ACCESS.banHang);
  const { code = "", ok } = await searchParams;
  const db = getDb();
  const data = code ? findSaleByCode(db, code) : null;
  const s = data?.sale as undefined | {
    id: number; code: string; date: string; customer_name: string | null; customer_type: string | null;
    customer_id: number | null; payment_type: string;
  };
  return (
    <>
      <h1>Xử lý khách trả hàng</h1>
      {ok && <div className="alert ok">Đã lưu phiếu trả {ok}.</div>}
      <form className="card row" method="get">
        <span>Phiếu bán gốc</span>
        <input name="code" defaultValue={code} placeholder="PB-YYYYMMDD-NNN" className="lg" required />
        <button className="primary">Tìm phiếu</button>
        <a href="/ban-hang/danh-sach" className="muted">Xem danh sách phiếu bán</a>
      </form>
      {code && !data && <div className="alert err">Không tìm thấy phiếu bán {code}</div>}
      {data && s && (
        <>
          <div className="row card">
            <span>Khách: <b>{s.customer_name ?? "Khách lẻ"}</b> {s.customer_type === "thau" && "(thầu)"}</span>
            <span>· Ngày bán: {fmtDate(s.date)}</span>
            <span>· Hình thức: {s.payment_type === "cong_no" ? "Ghi nợ" : "Tiền mặt"}</span>
          </div>
          <ReturnForm
            key={s.id}
            saleId={s.id}
            isThau={s.customer_type === "thau"}
            debt={s.customer_id ? balanceOf(db, s.customer_id) : 0}
            ratio={(data.sale.subtotal as number) > 0 ? (data.sale.total as number) / (data.sale.subtotal as number) : 1}
            items={data.items.map((i) => ({
              id: i.id, name: `${i.product_code} – ${i.product_name}`, unit: i.unit, qty: i.qty, price: i.price, returned: i.returned_qty,
            }))}
          />
        </>
      )}
    </>
  );
}
