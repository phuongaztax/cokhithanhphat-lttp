"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmtMoney, fmtQty } from "@/lib/util";
import type { CustomerMini } from "@/lib/services/master";

type Row = {
  id: number; code: string; name: string; base_unit: string; stock: number; min_stock: number; status: string;
  units: { unit: string; factor: number; sale_price: number }[];
  byWh: { name: string; qty: number }[];
};
export type QuoteLine = { productId: number; code: string; name: string; unit: string; qty: number; price: number; units: Row["units"] };
export type Quote = { customerId: number | null; lines: QuoteLine[] };

export const QUOTE_KEY = "chck_quote";

export default function QuoteBoard({ rows, customers, canQuote }: { rows: Row[]; customers: CustomerMini[]; canQuote: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [quote, setQuote] = useState<Quote>({ customerId: null, lines: [] });

  useEffect(() => {
    try { const s = sessionStorage.getItem(QUOTE_KEY); if (s) setQuote(JSON.parse(s)); } catch { /* bỏ qua */ }
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(QUOTE_KEY, JSON.stringify(quote)); } catch { /* bỏ qua */ }
  }, [quote]);

  const add = (r: Row) => {
    const u = r.units.find((x) => x.unit === r.base_unit) ?? r.units[0];
    setQuote((q) => q.lines.some((l) => l.productId === r.id && l.unit === u.unit) ? q : {
      ...q, lines: [...q.lines, { productId: r.id, code: r.code, name: r.name, unit: u.unit, qty: 1, price: u.sale_price, units: r.units }],
    });
  };
  const upd = (i: number, patch: Partial<QuoteLine>) =>
    setQuote((q) => ({ ...q, lines: q.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }));
  const total = quote.lines.reduce((s, l) => s + l.qty * l.price, 0);
  const priceText = (r: Row) => r.units.map((u) => `${fmtMoney(u.sale_price)} / ${u.unit}`).join(" · ");
  const cust = customers.find((c) => c.id === quote.customerId);

  return (
    <>
      <div className="card no-print tbl-wrap">
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Tên hàng</th><th className="num">Tồn</th><th>ĐVT</th><th>Giá bán theo đơn vị</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className={open === r.id ? "sel" : ""} onClick={() => setOpen(open === r.id ? null : r.id)} style={{ cursor: "pointer" }}>
                  <td>{r.code}</td>
                  <td>{r.name} {r.status === "ngung_nhap" && <span className="badge gray">ngừng nhập</span>}</td>
                  <td className={`num ${r.stock <= r.min_stock && r.min_stock > 0 ? "red b" : ""}`}>{fmtQty(r.stock)}</td>
                  <td>{r.base_unit}</td>
                  <td>{priceText(r)}</td>
                  <td>{canQuote && <button type="button" onClick={(e) => { e.stopPropagation(); add(r); }}>+ Báo giá</button>}</td>
                </tr>
                {open === r.id && (
                  <tr><td colSpan={6} className="detail-row">
                    <b>Tồn theo đơn vị:</b>{" "}
                    {r.units.map((u) => `${fmtQty(r.stock / u.factor)} ${u.unit}`).join(" · ")}
                    <br />
                    <b>Tồn theo kho:</b> {r.byWh.map((w) => `${w.name}: ${fmtQty(w.qty)} ${r.base_unit}`).join(" · ")}
                  </td></tr>
                )}
              </Fragment>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">Không tìm thấy mặt hàng</td></tr>}
          </tbody>
        </table>
        <p className="note">Tồn tính theo đơn vị cơ sở; bấm vào một dòng để xem tồn theo từng đơn vị quy đổi và theo kho.</p>
      </div>

      {canQuote && (
        <fieldset className="card">
          <legend>Phiếu báo giá</legend>
          <div className="row no-print">
            <span>Khách</span>
            <select value={quote.customerId ?? ""} onChange={(e) => setQuote({ ...quote, customerId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— Khách lẻ —</option>
              {customers.filter((c) => c.code !== "KH000").map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type === "thau" ? "thầu" : "lẻ"})</option>)}
            </select>
          </div>
          <h2 className="only-print">BÁO GIÁ – {cust?.name ?? "Khách lẻ"} – {new Date().toLocaleDateString("vi-VN")}</h2>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Hàng</th><th className="num">SL</th><th>ĐVT</th><th className="num">Đơn giá</th><th className="num">Thành tiền</th><th className="no-print"></th></tr></thead>
              <tbody>
                {quote.lines.map((l, i) => (
                  <tr key={`${l.productId}-${i}`}>
                    <td>{l.code} – {l.name}</td>
                    <td className="num"><input type="number" min={0} step="any" className="sm" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
                    <td>
                      <select value={l.unit} onChange={(e) => {
                        const u = l.units.find((x) => x.unit === e.target.value)!;
                        upd(i, { unit: u.unit, price: u.sale_price });
                      }}>
                        {l.units.map((u) => <option key={u.unit}>{u.unit}</option>)}
                      </select>
                    </td>
                    <td className="num">{fmtMoney(l.price)}</td>
                    <td className="num">{fmtMoney(l.qty * l.price)}</td>
                    <td className="no-print"><button type="button" className="danger" onClick={() => setQuote({ ...quote, lines: quote.lines.filter((_, k) => k !== i) })}>Xóa</button></td>
                  </tr>
                ))}
                {!quote.lines.length && <tr><td colSpan={6} className="muted">Bấm “+ Báo giá” ở bảng trên để thêm hàng</td></tr>}
              </tbody>
              <tfoot><tr><td colSpan={4} className="right">Tổng</td><td className="num">{fmtMoney(total)} đ</td><td className="no-print"></td></tr></tfoot>
            </table>
          </div>
          <div className="actions no-print">
            <button type="button" onClick={() => window.print()} disabled={!quote.lines.length}>In báo giá</button>
            <button type="button" className="primary" disabled={!quote.lines.length}
              onClick={() => router.push("/ban-hang?from=quote")}>Chuyển thành phiếu bán</button>
            <button type="button" onClick={() => setQuote({ customerId: null, lines: [] })}>Hủy</button>
          </div>
        </fieldset>
      )}
    </>
  );
}
