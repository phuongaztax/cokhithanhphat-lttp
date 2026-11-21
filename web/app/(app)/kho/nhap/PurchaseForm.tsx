"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ProductPicker from "@/components/ProductPicker";
import { purchaseAction } from "../../../actions";
import { fmtDate, fmtMoney, fmtQty } from "@/lib/util";
import type { CatalogItem } from "@/lib/services/inventory";

type Line = { productId: number; unit: string; qty: number; price: number };
type Hist = { unit: string; price: number; date: string; lot_code: string }[];

export default function PurchaseForm({ catalog, suppliers, warehouses, history, userName, defaultSupplier }: {
  catalog: CatalogItem[]; suppliers: { id: number; name: string }[]; warehouses: { id: number; name: string }[];
  history: Record<number, Hist>; userName: string; defaultSupplier?: number;
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const [supplierId, setSupplierId] = useState<number>(defaultSupplier ?? suppliers[0]?.id);
  const [whId, setWhId] = useState(warehouses[0]?.id);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState<{ p: CatalogItem; unit: string; qty: number; price: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastPrice = (pid: number, unit: string) => history[pid]?.find((h) => h.unit === unit)?.price ?? 0;
  const factor = (p: CatalogItem, unit: string) => p.units.find((u) => u.unit === unit)!.factor;
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const add = () => {
    if (!pick || !(pick.qty > 0)) return;
    setLines([...lines, { productId: pick.p.id, unit: pick.unit, qty: pick.qty, price: pick.price }]);
    setPick(null);
  };

  async function save() {
    setError(null); setBusy(true);
    const res = await purchaseAction({ supplierId, warehouseId: whId, note, items: lines });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setLines([]); setNote("");
    router.push(`/kho/nhap?ok=${(res.data as { code: string }).code}`);
  }

  return (
    <>
      {error && <div className="alert err">{error}</div>}
      <div className="card">
        <div className="row muted">
          <span>Số phiếu: <b>(tự sinh khi lưu)</b></span><span>· Ngày nhập: {new Date().toLocaleDateString("vi-VN")}</span><span>· Thủ kho: {userName}</span>
        </div>
        <div className="row">
          <span>Nhà cung cấp</span>
          <select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span>Kho nhập</span>
          <select value={whId} onChange={(e) => setWhId(Number(e.target.value))}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset className="card">
        <legend>Thêm hàng</legend>
        <div className="row">
          <ProductPicker catalog={catalog} filter={(p) => p.status !== "ngung_nhap"} onPick={(p) => {
            const u = p.units.reduce((a, b) => (b.factor > a.factor ? b : a)); // mặc định đơn vị lớn nhất (kg, cuộn…)
            setPick({ p, unit: u.unit, qty: 1, price: lastPrice(p.id, u.unit) });
          }} />
          {pick && (
            <>
              <b>{pick.p.code} – {pick.p.name}</b>
              <span>SL</span>
              <input type="number" className="sm" min={0} step="any" value={pick.qty} onChange={(e) => setPick({ ...pick, qty: Number(e.target.value) })} />
              <select value={pick.unit} onChange={(e) => setPick({ ...pick, unit: e.target.value, price: lastPrice(pick.p.id, e.target.value) })}>
                {pick.p.units.map((u) => <option key={u.unit}>{u.unit}</option>)}
              </select>
              <span>Giá nhập</span>
              <input type="number" className="md" min={0} value={pick.price} onChange={(e) => setPick({ ...pick, price: Number(e.target.value) })} />
              <span>/ {pick.unit}</span>
              <button type="button" className="primary" onClick={add}>Thêm</button>
            </>
          )}
        </div>
        {pick && (
          <p className="note">
            Giá các lô trước: {history[pick.p.id]?.length
              ? history[pick.p.id].map((h) => `${h.lot_code} (${fmtDate(h.date)}) – ${fmtMoney(h.price)} / ${h.unit}`).join(" · ")
              : "chưa có"}
          </p>
        )}
      </fieldset>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Hàng</th><th className="num">SL</th><th>ĐVT</th><th>Quy đổi</th><th className="num">Giá nhập</th><th className="num">Thành tiền</th><th>Lô</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const p = byId.get(l.productId)!;
              return (
                <tr key={i}>
                  <td>{p.code} – {p.name}</td>
                  <td className="num"><input type="number" className="sm" min={0} step="any" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td>{l.unit}</td>
                  <td>{factor(p, l.unit) === 1 ? `${fmtQty(l.qty)} ${p.base_unit}` : `≈ ${fmtQty(l.qty * factor(p, l.unit))} ${p.base_unit}`}</td>
                  <td className="num"><input type="number" className="md" min={0} value={l.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} /></td>
                  <td className="num">{fmtMoney(l.qty * l.price)}</td>
                  <td className="muted">lô mới (tự sinh)</td>
                  <td><button type="button" className="danger" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Xóa</button></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={8} className="muted">Chưa có hàng</td></tr>}
          </tbody>
          <tfoot><tr><td colSpan={5} className="right">Tổng tiền nhập</td><td className="num">{fmtMoney(total)} đ</td><td colSpan={2}></td></tr></tfoot>
        </table>
        <p className="note">Mỗi dòng nhập tạo một lô mới giữ giá nhập riêng – dùng để tính giá vốn (FIFO) cho báo cáo lãi lỗ.</p>
        <div className="row"><span>Ghi chú</span><input className="grow" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>

      <div className="actions">
        <button className="primary" disabled={busy || !lines.length} onClick={save}>{busy ? "Đang lưu…" : "Lưu phiếu nhập"}</button>
        <button onClick={() => setLines([])}>Hủy</button>
      </div>
    </>
  );
}
