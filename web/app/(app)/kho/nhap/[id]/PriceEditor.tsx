"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { purchasePriceAction } from "../../../../actions";
import { fmtMoney } from "@/lib/util";

/** Sửa giá nhập một dòng (chủ cửa hàng). */
export default function PriceEditor({ itemId, price, unit }: { itemId: number; price: number; unit: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(price);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!edit)
    return (
      <span>{fmtMoney(price)} <button type="button" className="link no-print" onClick={() => { setV(price); setEdit(true); }}>sửa</button></span>
    );
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <input type="number" className="md" min={0} value={v} autoFocus onChange={(e) => setV(Number(e.target.value))} />
      <span className="muted">/ {unit}</span>
      <button type="button" className="primary" disabled={busy} onClick={async () => {
        if (!confirm(`Đổi giá nhập ${fmtMoney(price)} → ${fmtMoney(v)} đ / ${unit}? Giá vốn các phiếu bán đã dùng lô này sẽ được tính lại.`)) return;
        setBusy(true); setError(null);
        const r = await purchasePriceAction(itemId, v);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setEdit(false);
        router.refresh();
      }}>Lưu</button>
      <button type="button" onClick={() => setEdit(false)}>Bỏ</button>
      {error && <span className="red" style={{ flexBasis: "100%" }}>{error}</span>}
    </span>
  );
}
