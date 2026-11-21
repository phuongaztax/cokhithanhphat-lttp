"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { returnAction } from "../../actions";
import { fmtMoney, fmtQty } from "@/lib/util";

type Item = { id: number; name: string; unit: string; qty: number; price: number; returned: number };

export default function ReturnForm({ saleId, items, isThau, debt, ratio }: {
  saleId: number; items: Item[]; isThau: boolean; debt: number; ratio: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(items.map((i) => ({ ...i, pick: false, rq: 0, intact: false })));
  const [method, setMethod] = useState<"tru_no" | "hoan_tien">(isThau ? "tru_no" : "hoan_tien");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upd = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const money = (r: (typeof rows)[number]) => (r.pick && r.intact ? Math.round(r.rq * r.price * ratio) : 0);
  const total = rows.reduce((s, r) => s + money(r), 0);
  const notIntact = rows.some((r) => r.pick && r.rq > 0 && !r.intact);

  async function save() {
    setError(null);
    setBusy(true);
    const res = await returnAction({
      saleId, method, reason,
      items: rows.filter((r) => r.pick && r.rq > 0).map((r) => ({ saleItemId: r.id, qty: r.rq, intact: r.intact })),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/tra-hang?ok=${(res.data as { code: string }).code}`);
  }

  return (
    <>
      {error && <div className="alert err">{error}</div>}
      <div className="card tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Trả</th><th>Hàng</th><th className="num">Đã mua</th><th className="num">Còn trả được</th><th className="num">SL trả</th><th>ĐVT</th><th>Còn nguyên?</th><th className="num">Tiền trả lại</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const remain = r.qty - r.returned;
              return (
                <tr key={r.id}>
                  <td><input type="checkbox" checked={r.pick} disabled={remain <= 0}
                    onChange={(e) => upd(i, { pick: e.target.checked, rq: e.target.checked ? Math.min(1, remain) : 0 })} /></td>
                  <td>{r.name}</td>
                  <td className="num">{fmtQty(r.qty)} {r.unit}</td>
                  <td className="num">{fmtQty(remain)}</td>
                  <td className="num"><input type="number" className="sm" min={0} max={remain} step="any" value={r.rq} disabled={!r.pick}
                    onChange={(e) => upd(i, { rq: Math.min(remain, Math.max(0, Number(e.target.value))) })} /></td>
                  <td>{r.unit}</td>
                  <td><label className="inline"><input type="checkbox" checked={r.intact} disabled={!r.pick} onChange={(e) => upd(i, { intact: e.target.checked })} /> Còn nguyên</label></td>
                  <td className="num">{fmtMoney(money(r))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="red" style={{ margin: "10px 0 0" }}>⚠ Chỉ nhận lại hàng còn nguyên; hàng nhận lại được cộng vào tồn kho (đúng lô đã xuất).</p>
        {notIntact && <div className="alert warn" style={{ marginTop: 8 }}>Có dòng chưa xác nhận “Còn nguyên” – không nhận lại được.</div>}
        <div className="row" style={{ marginTop: 10 }}>
          <span>Lý do trả</span>
          <input className="grow" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Mua dư" />
        </div>
      </div>

      <fieldset className="card">
        <legend>Xử lý tiền</legend>
        <div className="row">
          <label className="inline"><input type="radio" checked={method === "tru_no"} disabled={!isThau} onChange={() => setMethod("tru_no")} /> Trừ vào công nợ</label>
          {isThau && <span>Nợ trước: {fmtMoney(debt)} · Nợ sau: <b>{fmtMoney(debt - (method === "tru_no" ? total : 0))} đ</b></span>}
        </div>
        <div className="row">
          <label className="inline"><input type="radio" checked={method === "hoan_tien"} onChange={() => setMethod("hoan_tien")} /> Hoàn tiền mặt</label>
          {method === "hoan_tien" && <span>Hoàn: <b>{fmtMoney(total)} đ</b></span>}
        </div>
      </fieldset>

      <div className="actions">
        <button className="primary" disabled={busy || total <= 0} onClick={save}>{busy ? "Đang lưu…" : "Lưu phiếu trả"}</button>
        <button onClick={() => router.push("/tra-hang")}>Hủy</button>
      </div>
    </>
  );
}
