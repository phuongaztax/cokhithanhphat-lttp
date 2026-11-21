"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supplierAction } from "../../../actions";

type S = { id?: number; name: string; contact: string; phone: string; address: string; tax_code: string };

export default function SupplierForm({ initial }: { initial: S | null }) {
  const router = useRouter();
  const [s, setS] = useState<S>(initial ?? { name: "", contact: "", phone: "", address: "", tax_code: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const field = (k: keyof Omit<S, "id">, label: string, required = false) => (
    <>
      <label>{label}</label>
      <input value={s[k]} required={required} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
    </>
  );
  return (
    <fieldset className="card">
      <legend>{s.id ? "Thông tin nhà cung cấp" : "Thêm nhà cung cấp"}</legend>
      {error && <div className="alert err">{error}</div>}
      {ok && <div className="alert ok">{ok}</div>}
      <form className="grid-form" onSubmit={async (e) => {
        e.preventDefault(); setError(null); setOk(null);
        const r = await supplierAction(s);
        if (!r.ok) return setError(r.error);
        setOk("Đã lưu");
        if (!s.id) router.replace(`/quan-tri/nha-cung-cap?id=${r.data}`);
      }}>
        {field("name", "Tên NCC", true)}
        {field("contact", "Người liên hệ")}
        {field("phone", "Số điện thoại")}
        {field("address", "Địa chỉ")}
        {field("tax_code", "Mã số thuế")}
        <span />
        <div className="row" style={{ margin: 0 }}>
          <button className="primary">Lưu</button>
          {s.id && <a className="btn" href={`/kho/nhap?ncc=${s.id}`}>Lập phiếu nhập</a>}
          <button type="button" onClick={() => router.push("/quan-tri/nha-cung-cap")}>Đóng</button>
        </div>
      </form>
    </fieldset>
  );
}
