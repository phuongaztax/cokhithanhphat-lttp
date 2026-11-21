"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openingDebtAction } from "../../actions";

/** Ghi nợ đầu kỳ cho khách thầu (chủ cửa hàng) – chuyển số nợ từ sổ tay sang phần mềm. */
export default function OpeningDebtForm({ customers, defaultCustomer }: { customers: { id: number; name: string }[]; defaultCustomer?: number }) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(defaultCustomer ?? customers[0]?.id);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("Chuyển từ sổ công nợ cũ");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <fieldset className="card no-print" style={{ marginTop: 16 }}>
      <legend>Ghi nợ đầu kỳ (chủ cửa hàng)</legend>
      {msg && <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        if (!confirm(`Ghi nợ đầu kỳ ${amount.toLocaleString("vi-VN")} đ cho ${customers.find((c) => c.id === customerId)?.name}?`)) return;
        const r = await openingDebtAction({ customerId, amount, date, note });
        if (!r.ok) return setMsg({ ok: false, text: r.error });
        setMsg({ ok: true, text: `Đã ghi ${(r.data as { code: string }).code}` });
        setAmount(0);
        router.refresh();
      }}>
        <select value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))}>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span>Số nợ</span><input type="number" className="md" min={1} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} required />
        <span>Nợ từ ngày</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input className="grow" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú" />
        <button className="primary">Ghi nợ đầu kỳ</button>
      </form>
      <p className="note">Dùng khi bắt đầu sử dụng phần mềm: nhập số nợ còn lại của từng khách thầu theo sổ cũ, ngày = ngày bắt đầu nợ (để tính số ngày nợ).</p>
    </fieldset>
  );
}
