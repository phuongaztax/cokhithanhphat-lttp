"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetPasswordAction, userAction } from "../../../actions";

type U = { id?: number; full_name: string; username: string; phone: string; role: "ban_hang" | "thu_kho" | "chu"; active: boolean; password?: string };

export default function UserForm({ initial }: { initial: U | null }) {
  const router = useRouter();
  const [u, setU] = useState<U>(initial ?? { full_name: "", username: "", phone: "", role: "ban_hang", active: true, password: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const set = (x: Partial<U>) => setU({ ...u, ...x });
  return (
    <fieldset className="card" style={{ maxWidth: 640 }}>
      <legend>{u.id ? "Thông tin nhân viên" : "Thêm nhân viên"}</legend>
      {error && <div className="alert err">{error}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <form className="grid-form" onSubmit={async (e) => {
        e.preventDefault(); setError(null); setOk(null);
        const r = await userAction(u);
        if (!r.ok) return setError(r.error);
        setOk("Đã lưu");
        if (!u.id) router.replace(`/quan-tri/nhan-vien?id=${r.data}`);
      }}>
        <label>Họ tên</label><input value={u.full_name} onChange={(e) => set({ full_name: e.target.value })} required />
        <label>Số điện thoại</label><input value={u.phone} onChange={(e) => set({ phone: e.target.value })} />
        <label>Tài khoản</label><input value={u.username} onChange={(e) => set({ username: e.target.value })} required />
        {!u.id && (<><label>Mật khẩu ban đầu</label><input type="password" value={u.password} onChange={(e) => set({ password: e.target.value })} required minLength={6} /></>)}
        <label>Vai trò</label>
        <select value={u.role} onChange={(e) => set({ role: e.target.value as U["role"] })}>
          <option value="ban_hang">Nhân viên bán hàng</option><option value="thu_kho">Thủ kho</option><option value="chu">Chủ cửa hàng</option>
        </select>
        <label>Trạng thái</label>
        <div className="row" style={{ margin: 0 }}>
          <label className="inline"><input type="radio" checked={u.active} onChange={() => set({ active: true })} /> Hoạt động</label>
          <label className="inline"><input type="radio" checked={!u.active} onChange={() => set({ active: false })} /> Khóa</label>
        </div>
        <span />
        <div className="row" style={{ margin: 0 }}>
          <button className="primary">Lưu</button>
          {u.id && (
            <button type="button" onClick={async () => {
              const pw = prompt("Mật khẩu mới (tối thiểu 6 ký tự):");
              if (!pw) return;
              const r = await resetPasswordAction(u.id!, pw);
              if (r.ok) setOk("Đã đặt lại mật khẩu"); else setError(r.error);
            }}>Đặt lại mật khẩu</button>
          )}
          <button type="button" onClick={() => router.push("/quan-tri/nhan-vien")}>Đóng</button>
        </div>
      </form>
      <p className="note">Vai trò quyết định menu hiển thị. Khóa tài khoản sẽ đăng xuất người đó ngay.</p>
    </fieldset>
  );
}
