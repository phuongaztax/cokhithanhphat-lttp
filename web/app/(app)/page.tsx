import Link from "next/link";
import { requireUser, can, ACCESS } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { dashboard } from "@/lib/services/reports";
import { fmtDate, fmtMoney, today } from "@/lib/util";

// W01 – Trang chính
export default async function Home({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const d = dashboard(getDb(), user.role === "ban_hang" ? user.id : null);
  return (
    <>
      {denied && <div className="alert err">Bạn không có quyền truy cập chức năng đó.</div>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Xin chào, {user.full_name}</h1>
        <span className="muted">Ngày {fmtDate(today())}</span>
      </div>

      <h2>Lối tắt</h2>
      <div className="row" style={{ marginBottom: 18 }}>
        {can(user, ACCESS.banHang) && <Link className="btn primary" href="/ban-hang">Lập phiếu bán</Link>}
        {can(user, ACCESS.traCuu) && <Link className="btn" href="/tra-cuu">Tra cứu hàng</Link>}
        {can(user, ACCESS.banHang) && <Link className="btn" href="/tra-hang">Khách trả hàng</Link>}
        {can(user, ACCESS.congNo) && <Link className="btn" href="/cong-no">Tra cứu công nợ</Link>}
        {can(user, ACCESS.kho) && <Link className="btn primary" href="/kho/nhap">Lập phiếu nhập</Link>}
        {can(user, ACCESS.kho) && <Link className="btn" href="/kho/kiem-ke">Kiểm kê</Link>}
        {can(user, ACCESS.kho) && <Link className="btn" href="/kho/chuyen-kho">Chuyển kho</Link>}
        {can(user, ACCESS.quanTri) && <Link className="btn" href="/bao-cao">Xem báo cáo</Link>}
      </div>

      <h2>Hôm nay {user.role === "ban_hang" ? "(của bạn)" : "(toàn cửa hàng)"}</h2>
      <div className="stats">
        <div className="stat"><div className="k">Số phiếu bán</div><div className="v">{d.n}</div></div>
        <div className="stat"><div className="k">Doanh thu</div><div className="v">{fmtMoney(d.revenue)} đ</div></div>
        <div className="stat"><div className="k">Ghi nợ mới</div><div className="v">{fmtMoney(d.debt)} đ</div></div>
        <div className="stat"><div className="k">Khách trả hàng</div><div className="v">{d.returns} phiếu</div></div>
      </div>

      <fieldset className="card">
        <legend>Cảnh báo</legend>
        <div className="row">
          <span className={d.low ? "red b" : "muted"}>⚠ {d.low} mặt hàng dưới mức tồn tối thiểu</span>
          {can(user, ACCESS.quanTri) && <Link href="/bao-cao?tab=sap-het">Xem</Link>}
          {!can(user, ACCESS.quanTri) && can(user, ACCESS.traCuu) && <Link href="/tra-cuu">Tra cứu</Link>}
        </div>
        <div className="row">
          <span className={d.overdue ? "red" : "muted"}>{d.overdue} khách thầu nợ quá 30 ngày</span>
          {can(user, ACCESS.congNo) && <Link href="/cong-no?tab=ds">Xem</Link>}
        </div>
      </fieldset>
    </>
  );
}
