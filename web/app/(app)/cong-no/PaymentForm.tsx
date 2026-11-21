"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { paymentAction } from "../../actions";
import { fmtMoney } from "@/lib/util";

export default function PaymentForm({ customerId, customerName, balance, userName, back }: {
  customerId: number; customerName: string; balance: number; userName: string; back: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(balance);
  const [method, setMethod] = useState("Tiền mặt");
  const [note, setNote] = useState(`Thanh toán T${new Date().getMonth() + 1}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <fieldset className="card no-print" style={{ maxWidth: 640, marginTop: 16 }}>
      <legend>Thu nợ (UC15)</legend>
      {error && <div className="alert err">{error}</div>}
      <form className="grid-form" onSubmit={async (e) => {
        e.preventDefault(); setError(null); setBusy(true);
        const r = await paymentAction({ customerId, amount, method, note });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        router.push(`${back}&ok=${(r.data as { code: string }).code}`);
      }}>
        <span>Khách</span><b>{customerName}</b>
        <span>Còn nợ</span><b className="red">{fmtMoney(balance)} đ</b>
        <label>Số tiền thu</label>
        <div className="row" style={{ margin: 0 }}>
          <input type="number" min={1} max={balance} value={amount} onChange={(e) => setAmount(Number(e.target.value))} required />
          {amount < balance && <span className="muted">thu một phần – còn lại {fmtMoney(balance - amount)}</span>}
          {amount === balance && <span className="green">tất toán</span>}
        </div>
        <label>Hình thức</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}><option>Tiền mặt</option><option>Chuyển khoản</option></select>
        <span>Người thu</span><span>{userName}</span>
        <label>Ghi chú</label><input value={note} onChange={(e) => setNote(e.target.value)} />
        <span />
        <div className="row" style={{ margin: 0 }}>
          <button className="primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu phiếu thu"}</button>
          <button type="button" onClick={() => router.push(back)}>Hủy</button>
        </div>
      </form>
      <p className="note">Thu đủ → tất toán; thu một phần → trừ dần vào các phiếu nợ cũ nhất trước.</p>
    </fieldset>
  );
}
