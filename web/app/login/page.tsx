import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";
import DemoBanner from "@/components/DemoBanner";

// W00 – Đăng nhập (UC00)
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <>
    <DemoBanner />
    <div className="login-wrap">
      <div className="login-box">
        <h1>CỬA HÀNG CƠ KHÍ</h1>
        <LoginForm />
        <p className="note" style={{ marginTop: 16 }}>
          Tài khoản mẫu: admin / admin123 (chủ) · nv_lan / 123456 (bán hàng) · tk_binh / 123456 (thủ kho)
        </p>
      </div>
    </div>
    </>
  );
}
