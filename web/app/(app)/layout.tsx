import { requireUser, can, ACCESS } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/util";
import { logoutAction } from "../actions";
import Nav, { type NavGroup } from "./Nav";
import DemoBanner from "@/components/DemoBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const groups: NavGroup[] = [];
  const banHang = [];
  if (can(user, ACCESS.traCuu)) banHang.push({ href: "/tra-cuu", label: user.role === "thu_kho" ? "Tra cứu tồn kho" : "Tra cứu & báo giá" });
  if (can(user, ACCESS.banHang)) {
    banHang.push({ href: "/ban-hang", label: "Lập phiếu bán" }, { href: "/tra-hang", label: "Khách trả hàng" },
      { href: "/ban-hang/danh-sach", label: "Phiếu bán đã lập" });
  }
  if (banHang.length) groups.push({ label: user.role === "thu_kho" ? "Tra cứu" : "Bán hàng", items: banHang });
  if (can(user, ACCESS.kho))
    groups.push({ label: "Kho", items: [
      { href: "/kho/nhap", label: "Lập phiếu nhập" }, { href: "/kho/kiem-ke", label: "Kiểm kê kho" },
      { href: "/kho/chuyen-kho", label: "Chuyển kho" },
    ] });
  if (can(user, ACCESS.congNo))
    groups.push({ label: "Công nợ", items: [
      { href: "/khach-hang", label: "Khách hàng" }, { href: "/cong-no", label: "Công nợ & thu nợ" },
    ] });
  if (can(user, ACCESS.quanTri)) {
    groups.push({ label: "Quản trị", items: [
      { href: "/quan-tri/hang-hoa", label: "Hàng hóa & đơn vị" }, { href: "/quan-tri/nha-cung-cap", label: "Nhà cung cấp" },
      { href: "/quan-tri/nhan-vien", label: "Nhân viên" },
    ] });
    groups.push({ label: "Báo cáo", items: [
      { href: "/bao-cao?tab=lai-lo", label: "Lãi lỗ" }, { href: "/bao-cao?tab=cong-no", label: "Công nợ" },
      { href: "/bao-cao?tab=doanh-so", label: "Doanh số nhân viên" }, { href: "/bao-cao?tab=sap-het", label: "Hàng sắp hết" },
      { href: "/bao-cao?tab=ton-lau", label: "Hàng tồn lâu" }, { href: "/bao-cao?tab=kiem-ke", label: "Chênh lệch kiểm kê" },
    ] });
  }

  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">CỬA HÀNG CƠ KHÍ</a>
        <span className="spacer" />
        <span className="who">{user.full_name} · {ROLE_LABEL[user.role]}</span>
        <form action={logoutAction}><button>Đăng xuất</button></form>
      </header>
      <DemoBanner />
      <Nav groups={groups} />
      <main className="page">{children}</main>
    </>
  );
}
