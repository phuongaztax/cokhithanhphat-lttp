"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { productAction } from "../../../actions";
import type { ProductInput } from "@/lib/services/master";

type U = { unit: string; factor: number; sale_price: number; usage: string };
type P = Omit<ProductInput, "units"> & { units: U[] };

export default function ProductForm({ initial, groups }: { initial: P | null; groups: string[] }) {
  const router = useRouter();
  const [p, setP] = useState<P>(initial ?? {
    code: "", name: "", group_name: groups[0] ?? "", base_unit: "cái", min_stock: 0, status: "dang_ban",
    units: [{ unit: "cái", factor: 1, sale_price: 0, usage: "Bán lẻ" }],
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const set = (x: Partial<P>) => setP({ ...p, ...x });
  const setU = (i: number, x: Partial<U>) => set({ units: p.units.map((u, k) => (k === i ? { ...u, ...x } : u)) });

  const changeBase = (b: string) => {
    // đơn vị cơ sở luôn có hệ số 1
    const has = p.units.some((u) => u.unit === b);
    set({
      base_unit: b,
      units: has ? p.units.map((u) => (u.unit === b ? { ...u, factor: 1 } : u)) : [{ unit: b, factor: 1, sale_price: 0, usage: "Bán lẻ" }, ...p.units.filter((u) => u.factor !== 1)],
    });
  };

  return (
    <form className="grid2" onSubmit={async (e) => {
      e.preventDefault(); setError(null); setOk(null);
      const r = await productAction(p);
      if (!r.ok) return setError(r.error);
      setOk("Đã lưu");
      if (!p.id) router.replace(`/quan-tri/hang-hoa?id=${r.data}`);
    }}>
      <fieldset className="card">
        <legend>{p.id ? `Thông tin hàng: ${p.code}` : "Thêm hàng mới"}</legend>
        {error && <div className="alert err">{error}</div>}
        {ok && <div className="alert ok">{ok}</div>}
        <div className="grid-form">
          <label>Mã hàng</label><input value={p.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} required />
          <label>Tên hàng</label><input value={p.name} onChange={(e) => set({ name: e.target.value })} required />
          <label>Nhóm</label>
          <input list="groups" value={p.group_name} onChange={(e) => set({ group_name: e.target.value })} required />
          <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          <label>Đơn vị cơ sở</label><input value={p.base_unit} onChange={(e) => changeBase(e.target.value.trim())} required />
          <label>Tồn tối thiểu</label><input type="number" min={0} step="any" value={p.min_stock} onChange={(e) => set({ min_stock: Number(e.target.value) })} />
          <label>Trạng thái</label>
          <select value={p.status} onChange={(e) => set({ status: e.target.value as P["status"] })}>
            <option value="dang_ban">Đang bán</option><option value="ngung_nhap">Ngừng nhập</option>
          </select>
        </div>
        <p className="note">Tồn tối thiểu dùng cho cảnh báo / báo cáo “Hàng sắp hết”. Hàng ngừng nhập vẫn bán được phần còn tồn.</p>
      </fieldset>

      <fieldset className="card">
        <legend>Đơn vị tính & hệ số quy đổi (UC17)</legend>
        <table className="tbl">
          <thead><tr><th>Đơn vị</th><th className="num">= ? {p.base_unit}</th><th className="num">Giá bán</th><th>Dùng khi</th><th></th></tr></thead>
          <tbody>
            {p.units.map((u, i) => {
              const isBase = u.unit === p.base_unit;
              return (
                <tr key={i}>
                  <td><input className="sm" value={u.unit} disabled={isBase} onChange={(e) => setU(i, { unit: e.target.value })} /></td>
                  <td className="num"><input type="number" className="sm" min={0} step="any" value={u.factor} disabled={isBase} onChange={(e) => setU(i, { factor: Number(e.target.value) })} /></td>
                  <td className="num"><input type="number" className="md" min={0} value={u.sale_price} onChange={(e) => setU(i, { sale_price: Number(e.target.value) })} /></td>
                  <td><input className="md" value={u.usage} onChange={(e) => setU(i, { usage: e.target.value })} /></td>
                  <td>{!isBase && <button type="button" className="danger" onClick={() => set({ units: p.units.filter((_, k) => k !== i) })}>Xóa</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="actions">
          <button type="button" onClick={() => set({ units: [...p.units, { unit: "", factor: 1, sale_price: 0, usage: "Bán sỉ" }] })}>+ Thêm đơn vị</button>
        </div>
        <p className="note">VD ốc vít: con = 1, kg = 80 con, hộp = 500 con; dây điện: mét = 1, cuộn = 100 mét.</p>
        <div className="actions">
          <button className="primary">Lưu</button>
          <button type="button" onClick={() => router.push("/quan-tri/hang-hoa")}>Đóng</button>
        </div>
      </fieldset>
    </form>
  );
}
