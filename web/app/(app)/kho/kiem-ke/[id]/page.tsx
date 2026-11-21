import { notFound } from "next/navigation";
import { requireUser, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getStocktake } from "@/lib/services/warehouse";
import { stockOf } from "@/lib/services/inventory";
import { fmtDate, fmtMoney } from "@/lib/util";
import CountSheet from "./CountSheet";

// W06 – Phiếu đếm của một đợt kiểm kê (UC11 + UC12)
export default async function StocktakePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ lech?: string; gt?: string }>;
}) {
  await requireUser(ACCESS.kho);
  const { id } = await params;
  const { lech, gt } = await searchParams;
  const db = getDb();
  const data = getStocktake(db, Number(id));
  if (!data) notFound();
  const { st, items } = data;
  const open = st.status === "nhap";
  return (
    <>
      <h1>Kiểm kê {st.code}</h1>
      {lech != null && !open && (
        <div className="alert ok">
          Đã chốt: {lech} dòng lệch, giá trị {fmtMoney(Number(gt))} đ. Tồn kho đã cập nhật theo thực tế và đã báo cho chủ cửa hàng (báo cáo R6).
        </div>
      )}
      <div className="row card">
        <span>Kho: <b>{st.warehouse_name}</b></span><span>· Nhóm: {st.group_name ?? "Tất cả"}</span>
        <span>· Người kiểm: {st.user_name}</span><span>· Tạo: {fmtDate(st.created_at)}</span>
        {open ? <span className="badge">Đang kiểm</span> : <span className="badge green">Đã chốt {fmtDate(st.closed_at)}</span>}
      </div>
      <CountSheet
        key={st.status}
        id={st.id}
        open={open}
        items={items.map((i) => ({
          productId: i.product_id, code: i.code, name: i.name, unit: i.base_unit,
          // đang kiểm: hiển thị sổ sách hiện tại; đã chốt: sổ sách tại lúc chốt
          book: open ? stockOf(db, i.product_id, st.warehouse_id) : i.book_qty,
          actual: i.actual_qty, note: i.note ?? "", value: i.diff_value,
        }))}
      />
    </>
  );
}
