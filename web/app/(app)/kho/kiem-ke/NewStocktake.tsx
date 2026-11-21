"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { newStocktakeAction } from "../../../actions";

export default function NewStocktake({ warehouses, groups }: { warehouses: { id: number; name: string }[]; groups: string[] }) {
  const router = useRouter();
  const [wh, setWh] = useState(warehouses[0]?.id);
  const [g, setG] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <fieldset className="card">
      <legend>Tạo đợt kiểm kê mới</legend>
      {error && <div className="alert err">{error}</div>}
      <div className="row">
        <span>Kho</span>
        <select value={wh} onChange={(e) => setWh(Number(e.target.value))}>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <span>Nhóm hàng</span>
        <select value={g} onChange={(e) => setG(e.target.value)}>
          <option value="">Tất cả</option>{groups.map((x) => <option key={x}>{x}</option>)}
        </select>
        <button className="primary" onClick={async () => {
          const r = await newStocktakeAction(wh, g);
          if (!r.ok) return setError(r.error);
          router.push(`/kho/kiem-ke/${(r.data as { id: number }).id}`);
        }}>Tải danh sách & bắt đầu đếm</button>
      </div>
      <p className="note">Hệ thống chụp lại số tồn sổ sách; thủ kho nhập số đếm thực tế, khi chốt mới so lại với sổ sách tại thời điểm chốt.</p>
    </fieldset>
  );
}
