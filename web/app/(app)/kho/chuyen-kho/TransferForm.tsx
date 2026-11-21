"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { transferAction } from "../../../actions";
import { fmtMoney, fmtQty } from "@/lib/util";

type LotRow = {
  id: number; lot_code: string; qty_base: number; cost_per_base: number; product_id: number;
  product_code: string; product_name: string; base_unit: string; units: { unit: string; factor: number }[];
};
type Line = { lotId: number; unit: string; qty: number };

export default function TransferForm({ warehouses, lotsByWh, userName }: {
  warehouses: { id: number; name: string }[]; lotsByWh: Record<number, LotRow[]>; userName: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState(warehouses[0]?.id);
  const [to, setTo] = useState(warehouses[1]?.id ?? warehouses[0]?.id);
  const [lotId, setLotId] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lots = lotsByWh[from] ?? [];
  const lotOf = (id: number) => lots.find((l) => l.id === id)!;
  const sel = lotId ? lotOf(lotId) : null;
  const factor = (l: LotRow, u: string) => l.units.find((x) => x.unit === u)?.factor ?? 1;
  const usedBase = (id: number) => lines.filter((x) => x.lotId === id).reduce((s, x) => s + x.qty * factor(lotOf(id), x.unit), 0);

  const add = () => {
    if (!sel || !(qty > 0)) return;
    if (usedBase(sel.id) + qty * factor(sel, unit) > sel.qty_base + 1e-9)
      return setError(`SL chuyển vượt tồn của lô ${sel.lot_code} (${fmtQty(sel.qty_base)} ${sel.base_unit})`);
    setError(null);
    setLines([...lines, { lotId: sel.id, unit, qty }]);
    setLotId(""); setQty(1);
  };

  async function save() {
    setError(null); setBusy(true);
    const res = await transferAction({ fromWarehouseId: from, toWarehouseId: to, note, items: lines });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setLines([]);
    router.push(`/kho/chuyen-kho?ok=${(res.data as { code: string }).code}`);
  }

  return (
    <>
      {error && <div className="alert err">{error}</div>}
      <div className="card">
        <div className="row muted"><span>Số phiếu: <b>(tự sinh khi lưu)</b></span><span>· Ngày: {new Date().toLocaleDateString("vi-VN")}</span><span>· Thủ kho: {userName}</span></div>
        <div className="row">
          <span>Kho nguồn</span>
          <select value={from} disabled={lines.length > 0} onChange={(e) => { setFrom(Number(e.target.value)); setLotId(""); }}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <b>➜</b>
          <span>Kho đích</span>
          <select value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {from === to && <span className="red">Kho nguồn và kho đích phải khác nhau</span>}
        </div>
      </div>

      <fieldset className="card">
        <legend>Thêm hàng</legend>
        <div className="row">
          <span>Lô</span>
          <select className="grow" value={lotId} onChange={(e) => {
            const id = Number(e.target.value) || "";
            setLotId(id);
            if (id) setUnit(lotOf(id).base_unit);
          }}>
            <option value="">— Chọn hàng / lô —</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>{l.product_code} – {l.product_name} · {l.lot_code} (còn {fmtQty(l.qty_base - usedBase(l.id))} {l.base_unit})</option>
            ))}
          </select>
          {sel && (
            <>
              <span>SL</span>
              <input type="number" className="sm" min={0} step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>{sel.units.map((u) => <option key={u.unit}>{u.unit}</option>)}</select>
              <button className="primary" type="button" onClick={add}>Thêm</button>
            </>
          )}
        </div>
      </fieldset>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Hàng</th><th>Lô</th><th className="num">Tồn kho nguồn</th><th className="num">SL chuyển</th><th>ĐVT</th><th className="num">Giá nhập lô</th><th></th></tr></thead>
          <tbody>
            {lines.map((x, i) => {
              const l = lotOf(x.lotId);
              const f = factor(l, x.unit);
              return (
                <tr key={i}>
                  <td>{l.product_code} – {l.product_name}</td><td>{l.lot_code}</td>
                  <td className="num">{fmtQty(l.qty_base)} {l.base_unit}</td>
                  <td className="num">{fmtQty(x.qty)}</td>
                  <td>{x.unit}{f !== 1 && <span className="muted"> (≈ {fmtQty(x.qty * f)} {l.base_unit})</span>}</td>
                  <td className="num">{fmtMoney(l.cost_per_base * f)} / {x.unit}</td>
                  <td><button className="danger" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Xóa</button></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={7} className="muted">Chưa có hàng</td></tr>}
          </tbody>
        </table>
        <p className="note">Trừ tồn kho nguồn, cộng tồn kho đích; giữ nguyên lô và giá nhập. SL chuyển không được vượt tồn kho nguồn của lô.</p>
        <div className="row"><span>Ghi chú</span><input className="grow" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy || !lines.length || from === to} onClick={save}>{busy ? "Đang lưu…" : "Lưu phiếu chuyển"}</button>
        <button onClick={() => setLines([])}>Hủy</button>
      </div>
    </>
  );
}
