import type { DB } from "../db-core";
import { BizError, nextDocCode, nowLocal, round } from "../util";
import { addToLot, consumeFIFO, getProduct, getUnit, stockOf, type Lot } from "./inventory";

// ------------------------------------------------------------------ UC09 + UC10
export type PurchaseInput = {
  supplierId: number;
  warehouseId: number;
  note?: string;
  items: { productId: number; unit: string; qty: number; price: number }[];
};

/** Lập phiếu nhập: mỗi dòng tạo một lô mới giữ giá nhập riêng (UC10), quy đổi ĐVT (UC04). */
export function createPurchase(db: DB, userId: number, input: PurchaseInput, date = nowLocal()) {
  if (!input.items.length) throw new BizError("Phiếu nhập chưa có mặt hàng nào");
  return db.transaction(() => {
    const code = nextDocCode(db, "purchase_receipts", "PN", date);
    const lines = input.items.map((it) => {
      if (!(it.qty > 0)) throw new BizError("Số lượng nhập phải lớn hơn 0");
      if (!(it.price >= 0)) throw new BizError("Giá nhập không hợp lệ");
      const p = getProduct(db, it.productId);
      if (p.status === "ngung_nhap") throw new BizError(`${p.name} đang ở trạng thái ngừng nhập`);
      const u = getUnit(db, p.id, it.unit);
      return { p, u, qty: it.qty, price: it.price, amount: round(it.qty * it.price, 2) };
    });
    const total = lines.reduce((s, l) => s + l.amount, 0);
    const rid = Number(db.prepare(
      "INSERT INTO purchase_receipts (code, date, supplier_id, warehouse_id, user_id, total, note) VALUES (?,?,?,?,?,?,?)",
    ).run(code, date, input.supplierId, input.warehouseId, userId, total, input.note ?? null).lastInsertRowid);
    const yymm = date.slice(2, 4) + date.slice(5, 7);
    for (const l of lines) {
      const base = `L-${l.p.code}-${yymm}`;
      let lotCode = base;
      for (let k = 2; db.prepare("SELECT 1 FROM lots WHERE lot_code = ?").get(lotCode); k++) lotCode = `${base}-${k}`;
      const lotId = Number(db.prepare(
        "INSERT INTO lots (product_id, warehouse_id, lot_code, cost_per_base, qty_base, created_at) VALUES (?,?,?,?,?,?)",
      ).run(l.p.id, input.warehouseId, lotCode, round(l.price / l.u.factor, 6), round(l.qty * l.u.factor), date).lastInsertRowid);
      db.prepare(
        "INSERT INTO purchase_items (receipt_id, product_id, unit, factor, qty, price, amount, lot_id) VALUES (?,?,?,?,?,?,?,?)",
      ).run(rid, l.p.id, l.u.unit, l.u.factor, l.qty, l.price, l.amount, lotId);
    }
    return { id: rid, code };
  })();
}

/** Giá các lô trước của một mặt hàng (để thủ kho tham khảo khi nhập). */
export function lastLotPrices(db: DB, productId: number, limit = 3) {
  return db.prepare(
    `SELECT pi.unit, pi.price, pr.date, l.lot_code FROM purchase_items pi
     JOIN purchase_receipts pr ON pr.id = pi.receipt_id JOIN lots l ON l.id = pi.lot_id
     WHERE pi.product_id = ? AND pr.status = 'ok' ORDER BY pr.date DESC, pi.id DESC LIMIT ?`,
  ).all(productId, limit) as { unit: string; price: number; date: string; lot_code: string }[];
}

export function recentPurchases(db: DB, limit = 20) {
  return db.prepare(
    `SELECT pr.id, pr.code, pr.date, pr.total, pr.status, s.name AS supplier_name, w.name AS warehouse_name
     FROM purchase_receipts pr JOIN suppliers s ON s.id = pr.supplier_id JOIN warehouses w ON w.id = pr.warehouse_id
     ORDER BY pr.date DESC, pr.id DESC LIMIT ?`,
  ).all(limit) as { id: number; code: string; date: string; total: number; status: string; supplier_name: string; warehouse_name: string }[];
}

/** Chi tiết phiếu nhập: từng dòng kèm lô, tồn còn lại và cho biết lô đã được dùng (bán / chuyển / kiểm kê) chưa. */
export function getPurchase(db: DB, id: number) {
  const pr = db.prepare(
    `SELECT pr.*, s.name AS supplier_name, w.name AS warehouse_name, u.full_name AS user_name, cu.full_name AS cancelled_by_name
     FROM purchase_receipts pr JOIN suppliers s ON s.id = pr.supplier_id JOIN warehouses w ON w.id = pr.warehouse_id
     JOIN users u ON u.id = pr.user_id LEFT JOIN users cu ON cu.id = pr.cancelled_by WHERE pr.id = ?`,
  ).get(id) as {
    id: number; code: string; date: string; total: number; note: string | null; status: string; cancelled_at: string | null;
    cancel_reason: string | null; supplier_name: string; warehouse_name: string; user_name: string; cancelled_by_name: string | null;
  } | undefined;
  if (!pr) return null;
  const items = db.prepare(
    `SELECT pi.*, p.code AS product_code, p.name AS product_name, p.base_unit, l.lot_code, l.qty_base AS lot_remaining
     FROM purchase_items pi JOIN products p ON p.id = pi.product_id JOIN lots l ON l.id = pi.lot_id
     WHERE pi.receipt_id = ? ORDER BY pi.id`,
  ).all(id) as {
    id: number; product_code: string; product_name: string; base_unit: string; unit: string; factor: number; qty: number;
    price: number; amount: number; lot_id: number; lot_code: string; lot_remaining: number;
  }[];
  const log = db.prepare(
    "SELECT c.date, c.detail, u.full_name FROM change_log c JOIN users u ON u.id = c.user_id WHERE c.doc_code = ? ORDER BY c.id DESC",
  ).all(pr.code) as { date: string; detail: string; full_name: string }[];
  return { pr, items: items.map((i) => ({ ...i, used: lotUsed(db, i.lot_id, i.qty * i.factor) })), log };
}

/** Lô đã phát sinh nghiệp vụ sau khi nhập chưa (bán, chuyển kho, điều chỉnh kiểm kê)? */
function lotUsed(db: DB, lotId: number, originalQty: number): boolean {
  const sold = db.prepare("SELECT 1 FROM sale_item_lots WHERE lot_id = ? LIMIT 1").get(lotId);
  const moved = db.prepare("SELECT 1 FROM transfer_items WHERE from_lot_id = ? LIMIT 1").get(lotId);
  const qty = (db.prepare("SELECT qty_base FROM lots WHERE id = ?").get(lotId) as { qty_base: number }).qty_base;
  return !!sold || !!moved || Math.abs(qty - originalQty) > 1e-6;
}

const fmt = (n: number) => Math.round(n).toLocaleString("vi-VN");

const logChange = (db: DB, userId: number, action: string, code: string, detail: string, date: string) =>
  db.prepare("INSERT INTO change_log (date, user_id, action, doc_code, detail) VALUES (?,?,?,?,?)").run(date, userId, action, code, detail);

/**
 * Hủy phiếu nhập (chủ cửa hàng) – dùng khi nhập nhầm số lượng / mặt hàng / nhà cung cấp.
 * Chỉ hủy được khi CHƯA lô nào của phiếu được dùng (bán, chuyển kho, điều chỉnh kiểm kê); tồn của các lô về 0.
 */
export function cancelPurchase(db: DB, userId: number, receiptId: number, reason: string, date = nowLocal()) {
  const why = reason.trim();
  if (!why) throw new BizError("Nhập lý do hủy phiếu");
  const data = getPurchase(db, receiptId);
  if (!data) throw new BizError("Không tìm thấy phiếu nhập");
  if (data.pr.status === "huy") throw new BizError("Phiếu đã bị hủy trước đó");
  const used = data.items.filter((i) => i.used);
  if (used.length)
    throw new BizError(`Không hủy được: lô ${used.map((i) => i.lot_code).join(", ")} đã được bán / chuyển kho / kiểm kê. Nếu chỉ sai giá, dùng "Sửa giá nhập".`);
  db.transaction(() => {
    for (const i of data.items) db.prepare("UPDATE lots SET qty_base = 0 WHERE id = ?").run(i.lot_id);
    db.prepare("UPDATE purchase_receipts SET status = 'huy', cancelled_at = ?, cancelled_by = ?, cancel_reason = ? WHERE id = ?")
      .run(date, userId, why, receiptId);
    logChange(db, userId, "huy_phieu_nhap", data.pr.code, `Hủy phiếu nhập ${data.pr.code} (${fmt(data.pr.total)} đ). Lý do: ${why}`, date);
  })();
  return { code: data.pr.code };
}

/**
 * Sửa giá nhập một dòng phiếu nhập (chủ cửa hàng). Được sửa cả khi lô đã bán:
 * giá lô (mọi kho, kể cả phần đã chuyển kho) đổi theo, và giá vốn các phiếu bán / trả hàng đã dùng lô được tính lại.
 * Giá trị lệch của các đợt kiểm kê đã chốt KHÔNG tính lại.
 */
export function updatePurchasePrice(db: DB, userId: number, itemId: number, newPrice: number, date = nowLocal()) {
  if (!(newPrice >= 0)) throw new BizError("Giá nhập không hợp lệ");
  const it = db.prepare(
    `SELECT pi.*, pr.code AS receipt_code, pr.status, l.lot_code, p.name AS product_name FROM purchase_items pi
     JOIN purchase_receipts pr ON pr.id = pi.receipt_id JOIN lots l ON l.id = pi.lot_id JOIN products p ON p.id = pi.product_id
     WHERE pi.id = ?`,
  ).get(itemId) as {
    id: number; receipt_id: number; receipt_code: string; status: string; lot_code: string; product_name: string;
    unit: string; factor: number; qty: number; price: number;
  } | undefined;
  if (!it) throw new BizError("Không tìm thấy dòng phiếu nhập");
  if (it.status === "huy") throw new BizError("Phiếu nhập đã bị hủy");
  if (newPrice === it.price) throw new BizError("Giá mới trùng giá cũ");
  return db.transaction(() => {
    const cost = round(newPrice / it.factor, 6);
    db.prepare("UPDATE purchase_items SET price = ?, amount = ? WHERE id = ?").run(newPrice, round(it.qty * newPrice, 2), itemId);
    db.prepare("UPDATE purchase_receipts SET total = (SELECT SUM(amount) FROM purchase_items WHERE receipt_id = ?) WHERE id = ?")
      .run(it.receipt_id, it.receipt_id);
    const lotIds = (db.prepare("SELECT id FROM lots WHERE lot_code = ?").all(it.lot_code) as { id: number }[]).map((r) => r.id);
    const inList = lotIds.join(",");
    db.prepare(`UPDATE lots SET cost_per_base = ? WHERE id IN (${inList})`).run(cost);
    db.prepare(`UPDATE sale_item_lots SET cost_per_base = ? WHERE lot_id IN (${inList})`).run(cost);
    // tính lại giá vốn dòng bán, dòng trả và phiếu trả bị ảnh hưởng
    const saleItems = db.prepare(`SELECT DISTINCT sale_item_id AS id FROM sale_item_lots WHERE lot_id IN (${inList})`).all() as { id: number }[];
    for (const si of saleItems) {
      db.prepare("UPDATE sale_items SET cost = (SELECT ROUND(SUM(qty_base * cost_per_base), 2) FROM sale_item_lots WHERE sale_item_id = ?) WHERE id = ?")
        .run(si.id, si.id);
      const ris = db.prepare("SELECT id, return_id FROM return_items WHERE sale_item_id = ?").all(si.id) as { id: number; return_id: number }[];
      for (const ri of ris) {
        db.prepare(
          `UPDATE return_items SET cost = (SELECT ROUND(COALESCE(SUM(ril.qty_base * a.cost_per_base), 0), 2) FROM return_item_lots ril
             JOIN sale_item_lots a ON a.id = ril.sale_item_lot_id WHERE ril.return_item_id = ?) WHERE id = ?`,
        ).run(ri.id, ri.id);
        db.prepare("UPDATE returns SET cost = (SELECT SUM(cost) FROM return_items WHERE return_id = ?) WHERE id = ?").run(ri.return_id, ri.return_id);
      }
    }
    logChange(db, userId, "sua_gia_nhap", it.receipt_code,
      `${it.product_name} (lô ${it.lot_code}): giá nhập ${fmt(it.price)} → ${fmt(newPrice)} đ / ${it.unit}; tính lại giá vốn ${saleItems.length} dòng bán`, date);
    return { affectedSales: saleItems.length };
  })();
}


// ------------------------------------------------------------------ UC21
export type TransferInput = {
  fromWarehouseId: number;
  toWarehouseId: number;
  note?: string;
  items: { lotId: number; unit: string; qty: number }[];
};

/** Chuyển kho: trừ tồn kho nguồn, cộng tồn kho đích, giữ nguyên lô và giá nhập. */
export function createTransfer(db: DB, userId: number, input: TransferInput, date = nowLocal()) {
  if (input.fromWarehouseId === input.toWarehouseId) throw new BizError("Kho nguồn và kho đích phải khác nhau");
  if (!input.items.length) throw new BizError("Phiếu chuyển chưa có mặt hàng nào");
  return db.transaction(() => {
    const code = nextDocCode(db, "transfers", "PC", date);
    const tid = Number(db.prepare(
      "INSERT INTO transfers (code, date, from_warehouse_id, to_warehouse_id, user_id, note) VALUES (?,?,?,?,?,?)",
    ).run(code, date, input.fromWarehouseId, input.toWarehouseId, userId, input.note ?? null).lastInsertRowid);
    for (const it of input.items) {
      const lot = db.prepare("SELECT * FROM lots WHERE id = ?").get(it.lotId) as Lot | undefined;
      if (!lot || lot.warehouse_id !== input.fromWarehouseId) throw new BizError("Lô không thuộc kho nguồn");
      const p = getProduct(db, lot.product_id);
      const u = getUnit(db, p.id, it.unit);
      if (!(it.qty > 0)) throw new BizError("Số lượng chuyển phải lớn hơn 0");
      const qb = round(it.qty * u.factor);
      if (qb > lot.qty_base + 1e-9)
        throw new BizError(`${p.name}: SL chuyển (${qb} ${p.base_unit}) vượt tồn của lô ${lot.lot_code} (${lot.qty_base} ${p.base_unit})`);
      db.prepare("UPDATE lots SET qty_base = round(qty_base - ?, 4) WHERE id = ?").run(qb, lot.id);
      let dest = db.prepare("SELECT * FROM lots WHERE lot_code = ? AND warehouse_id = ?").get(lot.lot_code, input.toWarehouseId) as Lot | undefined;
      if (!dest) {
        const id = Number(db.prepare(
          "INSERT INTO lots (product_id, warehouse_id, lot_code, cost_per_base, qty_base, created_at) VALUES (?,?,?,?,0,?)",
        ).run(lot.product_id, input.toWarehouseId, lot.lot_code, lot.cost_per_base, lot.created_at).lastInsertRowid);
        dest = { ...lot, id, warehouse_id: input.toWarehouseId, qty_base: 0 };
      }
      addToLot(db, dest.id, qb);
      db.prepare(
        "INSERT INTO transfer_items (transfer_id, product_id, from_lot_id, to_lot_id, unit, factor, qty, qty_base) VALUES (?,?,?,?,?,?,?,?)",
      ).run(tid, p.id, lot.id, dest.id, u.unit, u.factor, it.qty, qb);
    }
    return { id: tid, code };
  })();
}

export function lotsInWarehouse(db: DB, warehouseId: number) {
  return db.prepare(
    `SELECT l.id, l.lot_code, l.qty_base, l.cost_per_base, l.product_id, p.code AS product_code, p.name AS product_name, p.base_unit
     FROM lots l JOIN products p ON p.id = l.product_id
     WHERE l.warehouse_id = ? AND l.qty_base > 0 ORDER BY p.code, l.created_at`,
  ).all(warehouseId) as {
    id: number; lot_code: string; qty_base: number; cost_per_base: number; product_id: number;
    product_code: string; product_name: string; base_unit: string;
  }[];
}

export function recentTransfers(db: DB, limit = 10) {
  return db.prepare(
    `SELECT t.id, t.code, t.date, wf.name AS from_name, wt.name AS to_name,
       (SELECT COUNT(*) FROM transfer_items ti WHERE ti.transfer_id = t.id) AS lines
     FROM transfers t JOIN warehouses wf ON wf.id = t.from_warehouse_id JOIN warehouses wt ON wt.id = t.to_warehouse_id
     ORDER BY t.date DESC, t.id DESC LIMIT ?`,
  ).all(limit) as { id: number; code: string; date: string; from_name: string; to_name: string; lines: number }[];
}

// ------------------------------------------------------------------ UC11 + UC12
export function createStocktake(db: DB, userId: number, warehouseId: number, group: string | null, date = nowLocal()) {
  return db.transaction(() => {
    const code = nextDocCode(db, "stocktakes", "KK", date);
    const id = Number(db.prepare(
      "INSERT INTO stocktakes (code, warehouse_id, group_name, user_id, created_at) VALUES (?,?,?,?,?)",
    ).run(code, warehouseId, group || null, userId, date).lastInsertRowid);
    const prods = db.prepare("SELECT id FROM products WHERE (? IS NULL OR group_name = ?) ORDER BY code").all(group || null, group || null) as { id: number }[];
    const ins = db.prepare("INSERT INTO stocktake_items (stocktake_id, product_id, book_qty) VALUES (?,?,?)");
    for (const p of prods) ins.run(id, p.id, stockOf(db, p.id, warehouseId));
    return { id, code };
  })();
}

export function saveCounts(db: DB, stocktakeId: number, counts: { productId: number; actual: number | null; note?: string }[]) {
  const st = db.prepare("SELECT status FROM stocktakes WHERE id = ?").get(stocktakeId) as { status: string } | undefined;
  if (!st) throw new BizError("Không tìm thấy đợt kiểm kê");
  if (st.status !== "nhap") throw new BizError("Đợt kiểm kê đã chốt");
  const upd = db.prepare("UPDATE stocktake_items SET actual_qty = ?, note = ? WHERE stocktake_id = ? AND product_id = ?");
  db.transaction(() => {
    for (const c of counts) {
      if (c.actual != null && c.actual < 0) throw new BizError("Số đếm thực tế không được âm");
      upd.run(c.actual, c.note ?? null, stocktakeId, c.productId);
    }
  })();
}

/** Chốt kiểm kê: dòng nào thực tế khác sổ sách thì ghi nhận chênh lệch (UC12) và điều chỉnh tồn. */
export function closeStocktake(db: DB, stocktakeId: number, date = nowLocal()) {
  const st = db.prepare("SELECT * FROM stocktakes WHERE id = ?").get(stocktakeId) as { id: number; code: string; warehouse_id: number; status: string } | undefined;
  if (!st) throw new BizError("Không tìm thấy đợt kiểm kê");
  if (st.status !== "nhap") throw new BizError("Đợt kiểm kê đã chốt");
  return db.transaction(() => {
    const items = db.prepare("SELECT * FROM stocktake_items WHERE stocktake_id = ? AND actual_qty IS NOT NULL").all(stocktakeId) as {
      id: number; product_id: number; actual_qty: number;
    }[];
    let diffLines = 0, diffValue = 0;
    for (const it of items) {
      const book = stockOf(db, it.product_id, st.warehouse_id); // sổ sách tại thời điểm chốt
      const diff = round(it.actual_qty - book);
      let value = 0;
      if (diff < 0) {
        const used = consumeFIFO(db, it.product_id, st.warehouse_id, -diff);
        value = -used.reduce((s, a) => s + a.qty_base * a.cost_per_base, 0);
      } else if (diff > 0) {
        let lot = db.prepare(
          "SELECT * FROM lots WHERE product_id = ? AND warehouse_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        ).get(it.product_id, st.warehouse_id) as Lot | undefined;
        if (!lot) {
          const last = db.prepare("SELECT cost_per_base FROM lots WHERE product_id = ? ORDER BY created_at DESC LIMIT 1").get(it.product_id) as { cost_per_base: number } | undefined;
          const p = getProduct(db, it.product_id);
          const id = Number(db.prepare(
            "INSERT INTO lots (product_id, warehouse_id, lot_code, cost_per_base, qty_base, created_at) VALUES (?,?,?,?,0,?)",
          ).run(it.product_id, st.warehouse_id, `${st.code}-${p.code}`, last?.cost_per_base ?? 0, date).lastInsertRowid);
          lot = db.prepare("SELECT * FROM lots WHERE id = ?").get(id) as Lot;
        }
        addToLot(db, lot.id, diff);
        value = diff * lot.cost_per_base;
      }
      if (diff !== 0) { diffLines++; diffValue += value; }
      db.prepare("UPDATE stocktake_items SET book_qty = ?, diff_value = ? WHERE id = ?").run(book, round(value, 0), it.id);
    }
    db.prepare("UPDATE stocktakes SET status = 'chot', closed_at = ? WHERE id = ?").run(date, stocktakeId);
    return { diffLines, diffValue: round(diffValue, 0) };
  })();
}

export function getStocktake(db: DB, id: number) {
  const st = db.prepare(
    `SELECT s.*, w.name AS warehouse_name, u.full_name AS user_name FROM stocktakes s
     JOIN warehouses w ON w.id = s.warehouse_id JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).get(id) as { id: number; code: string; status: string; warehouse_id: number; warehouse_name: string; group_name: string | null; created_at: string; closed_at: string | null; user_name: string } | undefined;
  if (!st) return null;
  const items = db.prepare(
    `SELECT si.*, p.code, p.name, p.base_unit FROM stocktake_items si JOIN products p ON p.id = si.product_id
     WHERE si.stocktake_id = ? ORDER BY p.code`,
  ).all(id) as { id: number; product_id: number; code: string; name: string; base_unit: string; book_qty: number; actual_qty: number | null; diff_value: number; note: string | null }[];
  return { st, items };
}

export function listStocktakes(db: DB) {
  return db.prepare(
    `SELECT s.id, s.code, s.status, s.created_at, s.closed_at, s.group_name, w.name AS warehouse_name,
       (SELECT COUNT(*) FROM stocktake_items i WHERE i.stocktake_id = s.id) AS total,
       (SELECT COUNT(*) FROM stocktake_items i WHERE i.stocktake_id = s.id AND i.actual_qty IS NOT NULL) AS counted
     FROM stocktakes s JOIN warehouses w ON w.id = s.warehouse_id ORDER BY s.id DESC LIMIT 20`,
  ).all() as { id: number; code: string; status: string; created_at: string; closed_at: string | null; group_name: string | null; warehouse_name: string; total: number; counted: number }[];
}
