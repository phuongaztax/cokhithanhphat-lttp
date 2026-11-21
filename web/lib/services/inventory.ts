import type { DB } from "../db-core";
import { BizError, round } from "../util";

export type Unit = { id: number; product_id: number; unit: string; factor: number; sale_price: number; usage: string | null };
export type Product = {
  id: number; code: string; name: string; group_name: string; base_unit: string;
  min_stock: number; status: "dang_ban" | "ngung_nhap";
};
export type Lot = {
  id: number; product_id: number; warehouse_id: number; lot_code: string;
  cost_per_base: number; qty_base: number; created_at: string;
};

export function getProduct(db: DB, id: number): Product {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
  if (!p) throw new BizError("Không tìm thấy mặt hàng");
  return p;
}

export function getUnits(db: DB, productId: number): Unit[] {
  return db.prepare("SELECT * FROM product_units WHERE product_id = ? ORDER BY factor").all(productId) as Unit[];
}

export function getUnit(db: DB, productId: number, unit: string): Unit {
  const u = db.prepare("SELECT * FROM product_units WHERE product_id = ? AND unit = ?").get(productId, unit) as Unit | undefined;
  if (!u) throw new BizError(`Đơn vị "${unit}" chưa được khai báo cho mặt hàng này`);
  return u;
}

/** Tồn theo đơn vị cơ sở; warehouseId = undefined → mọi kho. */
export function stockOf(db: DB, productId: number, warehouseId?: number): number {
  const row = warehouseId
    ? db.prepare("SELECT COALESCE(SUM(qty_base),0) AS q FROM lots WHERE product_id = ? AND warehouse_id = ?").get(productId, warehouseId)
    : db.prepare("SELECT COALESCE(SUM(qty_base),0) AS q FROM lots WHERE product_id = ?").get(productId);
  return round((row as { q: number }).q);
}

export function lotsOf(db: DB, productId: number, warehouseId: number): Lot[] {
  return db.prepare(
    "SELECT * FROM lots WHERE product_id = ? AND warehouse_id = ? AND qty_base > 0 ORDER BY created_at, id",
  ).all(productId, warehouseId) as Lot[];
}

/** Xuất kho FIFO theo lô; trả về phân bổ từng lô. Ném lỗi nếu không đủ tồn. */
export function consumeFIFO(db: DB, productId: number, warehouseId: number, qtyBase: number) {
  const lots = lotsOf(db, productId, warehouseId);
  const total = lots.reduce((s, l) => s + l.qty_base, 0);
  if (total + 1e-9 < qtyBase) {
    const p = getProduct(db, productId);
    throw new BizError(`Không đủ tồn: ${p.name} còn ${round(total, 3)} ${p.base_unit}, cần ${round(qtyBase, 3)} ${p.base_unit}`);
  }
  const used: { lot_id: number; qty_base: number; cost_per_base: number }[] = [];
  let need = qtyBase;
  const upd = db.prepare("UPDATE lots SET qty_base = ? WHERE id = ?");
  for (const l of lots) {
    if (need <= 1e-9) break;
    const take = Math.min(l.qty_base, need);
    upd.run(round(l.qty_base - take), l.id);
    used.push({ lot_id: l.id, qty_base: take, cost_per_base: l.cost_per_base });
    need -= take;
  }
  return used;
}

export function addToLot(db: DB, lotId: number, qtyBase: number) {
  db.prepare("UPDATE lots SET qty_base = round(qty_base + ?, 4) WHERE id = ?").run(qtyBase, lotId);
}

export function warehouses(db: DB) {
  return db.prepare("SELECT * FROM warehouses ORDER BY id").all() as { id: number; name: string }[];
}

export type StockRow = Product & { stock: number; units: Unit[] };

/** UC01: tra cứu tồn kho & giá. */
export function searchStock(db: DB, q: string, group: string, warehouseId?: number): StockRow[] {
  const like = `%${q.trim()}%`;
  const rows = db.prepare(
    `SELECT * FROM products WHERE (code LIKE ? OR name LIKE ?) AND (? = '' OR group_name = ?) ORDER BY code LIMIT 200`,
  ).all(like, like, group, group) as Product[];
  return rows.map((p) => ({ ...p, stock: stockOf(db, p.id, warehouseId), units: getUnits(db, p.id) }));
}

export function productGroups(db: DB): string[] {
  return (db.prepare("SELECT DISTINCT group_name FROM products ORDER BY group_name").all() as { group_name: string }[]).map((r) => r.group_name);
}

/** Danh mục rút gọn cho ô chọn hàng ở client (kèm đơn vị và tồn từng kho). */
export function productCatalog(db: DB) {
  const whs = warehouses(db);
  return (db.prepare("SELECT * FROM products ORDER BY code").all() as Product[]).map((p) => ({
    id: p.id, code: p.code, name: p.name, base_unit: p.base_unit, status: p.status,
    units: getUnits(db, p.id).map((u) => ({ unit: u.unit, factor: u.factor, sale_price: u.sale_price })),
    stock: Object.fromEntries(whs.map((w) => [w.id, stockOf(db, p.id, w.id)])) as Record<number, number>,
  }));
}
export type CatalogItem = ReturnType<typeof productCatalog>[number];
