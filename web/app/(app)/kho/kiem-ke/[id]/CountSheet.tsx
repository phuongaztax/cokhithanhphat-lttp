"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCountsAction } from "../../../../actions";
import { fmtMoney, fmtQty } from "@/lib/util";

type Item = { productId: number; code: string; name: string; unit: string; book: number; actual: number | null; note: string; value: number };

export default function CountSheet({ id, open, items }: { id: number; open: boolean; items: Item[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(items.map((i) => ({ ...i, input: i.actual == null ? "" : String(i.actual) })));
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const diff = (r: (typeof rows)[number]) => (r.input === "" ? null : Number(r.input) - r.book);
  const counted = rows.filter((r) => r.input !== "").length;
  const diffRows = rows.filter((r) => { const d = diff(r); return d != null && Math.abs(d) > 1e-9; });
  const shown = onlyDiff ? diffRows : rows;

  async function submit(close: boolean) {
    if (close && !confirm(`Chốt kiểm kê? ${diffRows.length} dòng lệch sẽ được ghi nhận và tồn kho cập nhật theo thực tế. Dòng chưa đếm được bỏ qua.`)) return;
    setBusy(true); setMsg(null);
    const res = await saveCountsAction(id, rows.map((r) => ({ productId: r.productId, actual: r.input === "" ? null : Number(r.input), note: r.note })), close);
    setBusy(false);
    if (!res.ok) return setMsg({ kind: "err", text: res.error });
    const d = res.data as { diffLines: number; diffValue: number } | null;
    if (d) {
      // khi chốt, phiếu được dựng lại (key = trạng thái) → truyền kết quả qua URL để trang hiển thị
      router.replace(`/kho/kiem-ke/${id}?lech=${d.diffLines}&gt=${d.diffValue}`);
      return;
    }
    setMsg({ kind: "ok", text: "Đã lưu tạm." });
    router.refresh();
  }

  return (
    <>
      {msg && <div className={`alert ${msg.kind}`}>{msg.text}</div>}
      <div className="card tbl-wrap">
        <div className="row">
          <label className="inline"><input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Chỉ hiện dòng bị lệch</label>
          <span className="muted">Đã đếm: {counted} / {rows.length} mặt hàng</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Mã</th><th>Hàng</th><th>ĐVT</th><th className="num">Sổ sách</th><th className="num">Thực tế</th><th className="num">Lệch</th><th>Ghi chú</th>{!open && <th className="num">Giá trị lệch</th>}</tr></thead>
          <tbody>
            {shown.map((r) => {
              const i = rows.indexOf(r);
              const d = diff(r);
              return (
                <tr key={r.productId}>
                  <td>{r.code}</td><td>{r.name}</td><td>{r.unit}</td>
                  <td className="num">{fmtQty(r.book)}</td>
                  <td className="num">
                    {open
                      ? <input type="number" className="md" min={0} step="any" value={r.input} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, input: e.target.value } : x)))} />
                      : fmtQty(r.actual)}
                  </td>
                  <td className={`num b ${d == null ? "" : d < 0 ? "red" : d > 0 ? "blue" : ""}`}>{d == null ? "" : d > 0 ? `+${fmtQty(d)}` : fmtQty(d)}</td>
                  <td>{open ? <input value={r.note} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))} /> : r.note}</td>
                  {!open && <td className="num">{fmtMoney(r.value)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="note">Chỉ dòng có Thực tế khác Sổ sách mới được ghi nhận chênh lệch; khi chốt, tồn kho cập nhật theo thực tế (thiếu: trừ lô cũ nhất trước; thừa: cộng vào lô mới nhất).</p>
      </div>
      {open && (
        <div className="actions">
          <button disabled={busy} onClick={() => submit(false)}>Lưu tạm</button>
          <button className="primary" disabled={busy || !counted} onClick={() => submit(true)}>Chốt kiểm kê & báo chủ cửa hàng</button>
        </div>
      )}
    </>
  );
}
