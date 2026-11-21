"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelPurchaseAction, cancelSaleAction } from "@/app/actions";

/** Nút hủy chứng từ (chủ cửa hàng): hỏi lý do, gọi action, hiển thị lỗi nghiệp vụ. */
export default function CancelDocButton({ kind, id, code }: { kind: "sale" | "purchase"; id: number; code: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" className="danger" disabled={busy} onClick={async () => {
        const reason = prompt(`Hủy ${kind === "sale" ? "phiếu bán" : "phiếu nhập"} ${code}?\nNhập lý do hủy:`);
        if (reason == null) return;
        setBusy(true); setError(null);
        const r = kind === "sale" ? await cancelSaleAction(id, reason) : await cancelPurchaseAction(id, reason);
        setBusy(false);
        if (!r.ok) return setError(r.error);
        router.refresh();
      }}>{busy ? "Đang hủy…" : "Hủy phiếu"}</button>
      {error && <div className="alert err" style={{ flexBasis: "100%" }}>{error}</div>}
    </>
  );
}
