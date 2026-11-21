import type { DB } from "../db-core";
import { daysAgo, daysBetween, round, today } from "../util";
import { debtors } from "./debt";
import { stockOf, type Product } from "./inventory";

const monthRange = (m: string) => [`${m}-01`, `${m}-31`] as const;

/** R1 – lãi lỗ theo tháng. Giá vốn lấy theo giá nhập từng lô đã xuất (FIFO). */
export function profit(db: DB, month: string) {
  const [a, b] = monthRange(month);
  const s = db.prepare(
    "SELECT COALESCE(SUM(total),0) AS revenue, COUNT(*) AS n FROM sales WHERE status = 'ok' AND substr(date,1,10) BETWEEN ? AND ?",
  ).get(a, b) as { revenue: number; n: number };
  const cogs = (db.prepare(
    `SELECT COALESCE(SUM(si.cost),0) AS c FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status = 'ok' AND substr(s.date,1,10) BETWEEN ? AND ?`,
  ).get(a, b) as { c: number }).c;
  const r = db.prepare(
    "SELECT COALESCE(SUM(total),0) AS t, COALESCE(SUM(cost),0) AS c FROM returns WHERE substr(date,1,10) BETWEEN ? AND ?",
  ).get(a, b) as { t: number; c: number };
  const byGroup = db.prepare(
    `SELECT p.group_name AS grp,
       SUM(si.amount * s.total / CASE WHEN s.subtotal = 0 THEN 1 ELSE s.subtotal END) AS revenue, SUM(si.cost) AS cogs
     FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
     WHERE s.status = 'ok' AND substr(s.date,1,10) BETWEEN ? AND ? GROUP BY p.group_name ORDER BY revenue DESC`,
  ).all(a, b) as { grp: string; revenue: number; cogs: number }[];
  const retByGroup = db.prepare(
    `SELECT p.group_name AS grp, SUM(ri.amount) AS t, SUM(ri.cost) AS c FROM return_items ri
     JOIN returns r ON r.id = ri.return_id JOIN sale_items si ON si.id = ri.sale_item_id JOIN products p ON p.id = si.product_id
     WHERE substr(r.date,1,10) BETWEEN ? AND ? GROUP BY p.group_name`,
  ).all(a, b) as { grp: string; t: number; c: number }[];
  const groups = byGroup.map((g) => {
    const rt = retByGroup.find((x) => x.grp === g.grp);
    const rev = g.revenue - (rt?.t ?? 0);
    const cost = g.cogs - (rt?.c ?? 0);
    return { grp: g.grp, revenue: round(rev, 0), cogs: round(cost, 0), profit: round(rev - cost, 0), margin: rev ? (rev - cost) / rev : 0 };
  });
  const netCogs = cogs - r.c;
  return {
    sales: s.n, revenue: s.revenue, returns: r.t, cogs: round(netCogs, 0),
    profit: round(s.revenue - r.t - netCogs, 0), groups,
  };
}

/** R2 – công nợ khách hàng. */
export const debtReport = debtors;

/** R3 – doanh số theo nhân viên (trừ hàng bị trả của các phiếu họ bán). */
export function salesByUser(db: DB, month: string) {
  const [a, b] = monthRange(month);
  return db.prepare(
    `SELECT u.id, u.full_name, u.role,
       (SELECT COUNT(*) FROM sales s WHERE s.user_id = u.id AND s.status = 'ok' AND substr(s.date,1,10) BETWEEN ? AND ?) AS n,
       (SELECT COALESCE(SUM(total),0) FROM sales s WHERE s.user_id = u.id AND s.status = 'ok' AND substr(s.date,1,10) BETWEEN ? AND ?) AS gross,
       (SELECT COALESCE(SUM(r.total),0) FROM returns r JOIN sales s ON s.id = r.sale_id
          WHERE s.user_id = u.id AND substr(r.date,1,10) BETWEEN ? AND ?) AS returned
     FROM users u WHERE u.role IN ('ban_hang','chu') ORDER BY gross DESC`,
  ).all(a, b, a, b, a, b) as { id: number; full_name: string; role: string; n: number; gross: number; returned: number }[];
}

/** R4 – hàng sắp hết: tồn (mọi kho) <= tồn tối thiểu. */
export function lowStock(db: DB) {
  const ps = db.prepare("SELECT * FROM products WHERE status = 'dang_ban' AND min_stock > 0 ORDER BY code").all() as Product[];
  return ps
    .map((p) => {
      const sup = db.prepare(
        `SELECT s.id, s.name FROM purchase_items pi JOIN purchase_receipts pr ON pr.id = pi.receipt_id
         JOIN suppliers s ON s.id = pr.supplier_id WHERE pi.product_id = ? AND pr.status = 'ok' ORDER BY pr.date DESC LIMIT 1`,
      ).get(p.id) as { id: number; name: string } | undefined;
      return { ...p, stock: stockOf(db, p.id), supplier: sup?.name ?? "", supplier_id: sup?.id ?? null };
    })
    .filter((p) => p.stock <= p.min_stock);
}

/** R5 – hàng tồn lâu không bán (còn tồn và không bán trong N ngày). */
export function slowMoving(db: DB, days: number) {
  const cutoff = daysAgo(days).slice(0, 10);
  const ps = db.prepare("SELECT * FROM products ORDER BY code").all() as Product[];
  return ps
    .map((p) => {
      const last = (db.prepare(
        "SELECT MAX(s.date) AS d FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE si.product_id = ? AND s.status = 'ok'",
      ).get(p.id) as { d: string | null }).d;
      const firstLot = (db.prepare("SELECT MIN(created_at) AS d FROM lots WHERE product_id = ? AND qty_base > 0").get(p.id) as { d: string | null }).d;
      const value = (db.prepare("SELECT COALESCE(SUM(qty_base * cost_per_base),0) AS v FROM lots WHERE product_id = ?").get(p.id) as { v: number }).v;
      return { ...p, stock: stockOf(db, p.id), last_sale: last, since: last ?? firstLot, value: round(value, 0) };
    })
    .filter((p) => p.stock > 0 && p.since != null && p.since.slice(0, 10) < cutoff)
    .map((p) => ({ ...p, idle_days: daysBetween(p.since!) }));
}

/** R6 – chênh lệch kiểm kê các đợt đã chốt trong tháng. */
export function stocktakeDiffs(db: DB, month: string) {
  const [a, b] = monthRange(month);
  return db.prepare(
    `SELECT s.code, s.closed_at, w.name AS warehouse_name, p.code AS product_code, p.name AS product_name, p.base_unit,
       i.book_qty, i.actual_qty, (i.actual_qty - i.book_qty) AS diff, i.diff_value, i.note
     FROM stocktake_items i JOIN stocktakes s ON s.id = i.stocktake_id JOIN products p ON p.id = i.product_id
     JOIN warehouses w ON w.id = s.warehouse_id
     WHERE s.status = 'chot' AND substr(s.closed_at,1,10) BETWEEN ? AND ? AND i.actual_qty IS NOT NULL
       AND abs(i.actual_qty - i.book_qty) > 0.00001
     ORDER BY s.closed_at DESC, p.code`,
  ).all(a, b) as {
    code: string; closed_at: string; warehouse_name: string; product_code: string; product_name: string; base_unit: string;
    book_qty: number; actual_qty: number; diff: number; diff_value: number; note: string | null;
  }[];
}

/** Số liệu trang chính. */
export function dashboard(db: DB, userId: number | null) {
  const d = today();
  const s = db.prepare(
    `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS revenue,
       COALESCE(SUM(CASE WHEN payment_type='cong_no' THEN total END),0) AS debt
     FROM sales WHERE status = 'ok' AND substr(date,1,10) = ? AND (? IS NULL OR user_id = ?)`,
  ).get(d, userId, userId) as { n: number; revenue: number; debt: number };
  const r = (db.prepare("SELECT COUNT(*) AS n FROM returns WHERE substr(date,1,10) = ?").get(d) as { n: number }).n;
  const overdue = debtors(db).filter((x) => x.days > 30).length;
  return { ...s, returns: r, low: lowStock(db).length, overdue };
}
