"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductPicker from "@/components/ProductPicker";
import { saleAction } from "../../actions";
import { fmtMoney, fmtQty } from "@/lib/util";
import type { CatalogItem } from "@/lib/services/inventory";
import type { CustomerMini } from "@/lib/services/master";
import { QUOTE_KEY, type Quote } from "../tra-cuu/QuoteBoard";

type Line = { productId: number; unit: string; qty: number; price: number };

export default function SaleForm({ catalog, customers, warehouses, userName }: {
  catalog: CatalogItem[]; customers: CustomerMini[]; warehouses: { id: number; name: string }[]; userName: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [kind, setKind] = useState<"le" | "thau">("le");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [whId, setWhId] = useState(warehouses[0]?.id ?? 1);
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState<{ p: CatalogItem; unit: string; qty: number } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [pay, setPay] = useState<"tien_mat" | "cong_no">("tien_mat");
  const [cash, setCash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(catalog.map((p) => [p.id, p])), [catalog]);
  const walkIn = customers.find((c) => c.code === "KH000");
  const cust = customers.find((c) => c.id === customerId);

  // Nhận dữ liệu từ phiếu báo giá (W02 → "Chuyển thành phiếu bán")
  useEffect(() => {
    if (sp.get("from") !== "quote") return;
    try {
      const q = JSON.parse(sessionStorage.getItem(QUOTE_KEY) ?? "null") as Quote | null;
      if (!q) return;
      setLines(q.lines.map((l) => ({ productId: l.productId, unit: l.unit, qty: l.qty, price: l.price })));
      const c = customers.find((x) => x.id === q.customerId);
      if (c) { setKind(c.type); setCustomerId(c.id); if (c.type === "thau") setPay("cong_no"); }
      sessionStorage.removeItem(QUOTE_KEY);
    } catch { /* bỏ qua */ }
  }, [sp, customers]);

  const unitOf = (p: CatalogItem, unit: string) => p.units.find((u) => u.unit === unit)!;
  const addLine = () => {
    if (!pick || !(pick.qty > 0)) return;
    const u = unitOf(pick.p, pick.unit);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === pick.p.id && l.unit === pick.unit);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, qty: l.qty + pick.qty } : l));
      return [...ls, { productId: pick.p.id, unit: pick.unit, qty: pick.qty, price: u.sale_price }];
    });
    setPick(null);
  };
  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));

  const subtotal = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const total = Math.max(0, subtotal - discount);
  const debtAfter = (cust?.balance ?? 0) + (pay === "cong_no" ? total : 0);
  const overLimit = kind === "thau" && pay === "cong_no" && cust && cust.credit_limit > 0 && debtAfter > cust.credit_limit;
  const cashNum = cash === "" ? null : Number(cash);

  // cảnh báo vượt tồn theo kho đang chọn (cộng dồn các dòng cùng mặt hàng)
  const needBase = new Map<number, number>();
  for (const l of lines) {
    const p = byId.get(l.productId)!;
    needBase.set(l.productId, (needBase.get(l.productId) ?? 0) + l.qty * unitOf(p, l.unit).factor);
  }

  async function save() {
    setError(null);
    if (kind === "thau" && !customerId) return setError("Chọn khách thầu");
    setBusy(true);
    const res = await saleAction({
      customerId: kind === "thau" ? customerId : (customerId ?? walkIn?.id ?? null),
      paymentType: kind === "le" ? "tien_mat" : pay,
      warehouseId: whId,
      items: lines.map((l) => ({ productId: l.productId, unit: l.unit, qty: l.qty, price: l.price })),
      discount, cashGiven: pay === "tien_mat" || kind === "le" ? cashNum : null,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/ban-hang/${(res.data as { id: number }).id}?moi=1`);
  }

  const thauList = customers.filter((c) => c.type === "thau");
  const leList = customers.filter((c) => c.type === "le");

  return (
    <>
      {error && <div className="alert err">{error}</div>}
      <div className="row muted">
        <span>Số phiếu: <b>(tự sinh khi lưu)</b></span>
        <span>· Ngày: {new Date().toLocaleDateString("vi-VN")}</span>
        <span>· NV bán: {userName}</span>
        <span className="grow" />
        <span>Xuất từ kho</span>
        <select value={whId} onChange={(e) => setWhId(Number(e.target.value))}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      <fieldset className="card">
        <legend>Khách hàng</legend>
        <div className="row">
          <label className="inline"><input type="radio" checked={kind === "le"} onChange={() => { setKind("le"); setCustomerId(null); setPay("tien_mat"); }} /> Khách lẻ</label>
          <label className="inline"><input type="radio" checked={kind === "thau"} onChange={() => { setKind("thau"); setCustomerId(null); setPay("cong_no"); }} /> Khách thầu</label>
          <select className="grow" value={customerId ?? ""} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{kind === "le" ? "— Khách vãng lai —" : "— Chọn khách thầu —"}</option>
            {(kind === "le" ? leList.filter((c) => c.code !== "KH000") : thauList).map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.phone ? ` – ${c.phone}` : ""}</option>
            ))}
          </select>
          <a className="btn" href="/khach-hang?id=new" target="_blank">+ Khách mới</a>
        </div>
        {kind === "thau" && cust && (
          <div className="row">
            Nợ hiện tại: <span className="red b">{fmtMoney(cust.balance)} đ</span>
            <span className="muted">· Hạn mức: {cust.credit_limit ? fmtMoney(cust.credit_limit) + " đ" : "không giới hạn"}</span>
          </div>
        )}
      </fieldset>

      <fieldset className="card">
        <legend>Thêm hàng</legend>
        <div className="row">
          <ProductPicker catalog={catalog} onPick={(p) => {
            const base = p.units.find((u) => u.unit === p.base_unit) ?? p.units[0];
            setPick({ p, unit: base.unit, qty: 1 });
          }} />
          {pick && (
            <>
              <b>{pick.p.code} – {pick.p.name}</b>
              <span className="muted">(tồn {fmtQty(pick.p.stock[whId] ?? 0)} {pick.p.base_unit})</span>
              <span>SL</span>
              <input type="number" className="sm" min={0} step="any" value={pick.qty} autoFocus
                onChange={(e) => setPick({ ...pick, qty: Number(e.target.value) })}
                onKeyDown={(e) => e.key === "Enter" && addLine()} />
              <select value={pick.unit} onChange={(e) => setPick({ ...pick, unit: e.target.value })}>
                {pick.p.units.map((u) => <option key={u.unit}>{u.unit}</option>)}
              </select>
              <button type="button" className="primary" onClick={addLine}>Thêm</button>
            </>
          )}
        </div>
      </fieldset>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>#</th><th>Hàng</th><th className="num">SL</th><th>ĐVT</th><th>Quy đổi</th><th className="num">Đơn giá</th><th className="num">Thành tiền</th><th></th></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const p = byId.get(l.productId)!;
              const u = unitOf(p, l.unit);
              const short = (needBase.get(p.id) ?? 0) > (p.stock[whId] ?? 0) + 1e-9;
              return (
                <tr key={`${l.productId}-${l.unit}`}>
                  <td>{i + 1}</td>
                  <td>{p.code} – {p.name}{short && <div className="red" style={{ fontSize: 12 }}>Vượt tồn kho ({fmtQty(p.stock[whId] ?? 0)} {p.base_unit})</div>}</td>
                  <td className="num"><input type="number" className="sm" min={0} step="any" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td>
                    <select value={l.unit} onChange={(e) => upd(i, { unit: e.target.value, price: unitOf(p, e.target.value).sale_price })}>
                      {p.units.map((x) => <option key={x.unit}>{x.unit}</option>)}
                    </select>
                  </td>
                  <td>{u.factor === 1 ? `${fmtQty(l.qty)} ${p.base_unit}` : `≈ ${fmtQty(l.qty * u.factor)} ${p.base_unit}`}</td>
                  <td className="num"><input type="number" className="md" min={0} value={l.price} onChange={(e) => upd(i, { price: Number(e.target.value) })} /></td>
                  <td className="num">{fmtMoney(l.qty * l.price)}</td>
                  <td><button type="button" className="danger" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Xóa</button></td>
                </tr>
              );
            })}
            {!lines.length && <tr><td colSpan={8} className="muted">Chưa có hàng – gõ mã hoặc tên hàng ở ô “Thêm hàng”</td></tr>}
          </tbody>
        </table>
        <p className="note">ĐVT lấy theo khai báo của hàng (con / kg / mét / cuộn…); hệ thống tự quy đổi về đơn vị cơ sở để trừ tồn theo lô (FIFO).</p>
      </div>

      <div className="grid2">
        <div className="card totals">
          <span>Tổng tiền hàng</span><span className="v">{fmtMoney(subtotal)} đ</span>
          <span>Chiết khấu</span><input type="number" min={0} className="md" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
          <span className="b">Phải trả</span><span className="v" style={{ fontSize: 18 }}>{fmtMoney(total)} đ</span>
        </div>
        <fieldset className="card">
          <legend>Thanh toán</legend>
          <div className="row">
            <label className="inline"><input type="radio" checked={kind === "le" || pay === "tien_mat"} onChange={() => setPay("tien_mat")} /> Thu tiền ngay</label>
            <span>Khách đưa</span>
            <input type="number" className="md" min={0} value={cash} disabled={kind === "thau" && pay === "cong_no"} onChange={(e) => setCash(e.target.value)} />
            {cashNum != null && <span>Thối lại: <b>{fmtMoney(Math.max(0, cashNum - total))}</b></span>}
          </div>
          <div className="row">
            <label className="inline">
              <input type="radio" disabled={kind === "le"} checked={kind === "thau" && pay === "cong_no"} onChange={() => setPay("cong_no")} /> Ghi công nợ (khách thầu)
            </label>
            {kind === "thau" && pay === "cong_no" && cust && <span>Nợ sau phiếu: <b className="red">{fmtMoney(debtAfter)} đ</b></span>}
          </div>
          {overLimit && <div className="alert warn">⚠ Nợ sau phiếu vượt hạn mức {fmtMoney(cust!.credit_limit)} đ – cân nhắc thu bớt tiền.</div>}
        </fieldset>
      </div>

      <div className="actions">
        <button className="primary" disabled={busy || !lines.length} onClick={save}>{busy ? "Đang lưu…" : "Lưu & In phiếu"}</button>
        <button onClick={() => { setLines([]); setDiscount(0); setCash(""); setError(null); }}>Hủy</button>
      </div>
    </>
  );
}
