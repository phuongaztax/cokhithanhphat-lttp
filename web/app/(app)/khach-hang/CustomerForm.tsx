"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { customerAction } from "../../actions";

type C = { id?: number; name: string; phone: string; address: string; type: "le" | "thau"; credit_limit: number; note: string };

export default function CustomerForm({ initial }: { initial: C | null }) {
  const router = useRouter();
  const [c, setC] = useState<C>(initial ?? { name: "", phone: "", address: "", type: "thau", credit_limit: 0, note: "" });
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOk] = useState<string | null>(null);
  const set = (p: Partial<C>) => setC({ ...c, ...p });

  return (
    <fieldset className="card">
      <legend>{c.id ? "Sửa thông tin khách hàng" : "Thêm khách hàng"}</legend>
      {error && <div className="alert err">{error}</div>}
      {okMsg && <div className="alert ok">{okMsg}</div>}
      <form className="grid-form" onSubmit={async (e) => {
        e.preventDefault(); setError(null); setOk(null);
        const r = await customerAction(c);
        if (!r.ok) return setError(r.error);
        setOk("Đã lưu");
        if (!c.id) router.replace(`/khach-hang?id=${r.data}`);
      }}>
        <label>Tên khách</label><input value={c.name} onChange={(e) => set({ name: e.target.value })} required />
        <label>Số điện thoại</label><input value={c.phone} onChange={(e) => set({ phone: e.target.value })} />
        <label>Địa chỉ</label><input value={c.address} onChange={(e) => set({ address: e.target.value })} />
        <label>Loại khách</label>
        <div className="row" style={{ margin: 0 }}>
          <label className="inline"><input type="radio" checked={c.type === "thau"} onChange={() => set({ type: "thau" })} /> Thầu (thanh toán cuối tháng)</label>
          <label className="inline"><input type="radio" checked={c.type === "le"} onChange={() => set({ type: "le", credit_limit: 0 })} /> Lẻ (trả ngay)</label>
        </div>
        <label>Hạn mức nợ</label>
        <input type="number" min={0} value={c.credit_limit} disabled={c.type === "le"} onChange={(e) => set({ credit_limit: Number(e.target.value) })} />
        <label>Ghi chú</label><input value={c.note} onChange={(e) => set({ note: e.target.value })} />
        <span />
        <div className="row" style={{ margin: 0 }}>
          <button className="primary">Lưu</button>
          <button type="button" onClick={() => router.push("/khach-hang")}>Đóng</button>
        </div>
      </form>
      <p className="note">Hạn mức 0 = không giới hạn. Phiếu bán ghi nợ vượt hạn mức sẽ được cảnh báo.</p>
    </fieldset>
  );
}
