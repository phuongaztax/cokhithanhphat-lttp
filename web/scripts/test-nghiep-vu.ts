/**
 * Kiểm thử nghiệp vụ trên CSDL tạm (in-memory, có dữ liệu mẫu).
 * Chạy: npm run test
 */
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { openDb, BASE_SCHEMA } from "../lib/db-core";
import { migrate, LATEST_VERSION } from "../lib/migrations";
import { BizError } from "../lib/util";
import { stockOf, getUnit } from "../lib/services/inventory";
import { createSale, createReturn, getSale, cancelSale } from "../lib/services/sales";
import { balanceOf, createPayment, debtors, ledger, createOpeningDebt } from "../lib/services/debt";
import {
  createPurchase, createTransfer, createStocktake, saveCounts, closeStocktake, lotsInWarehouse,
  cancelPurchase, updatePurchasePrice, getPurchase, lastLotPrices,
} from "../lib/services/warehouse";
import { saveProduct, saveUser, listUsers, saveCustomer } from "../lib/services/master";
import { profit, lowStock, slowMoving, stocktakeDiffs, salesByUser } from "../lib/services/reports";

const db = openDb(":memory:");
const id = (sql: string, ...a: unknown[]) => (db.prepare(sql).get(...a) as { id: number }).id;
const P = (code: string) => id("SELECT id FROM products WHERE code = ?", code);
const C = (name: string) => id("SELECT id FROM customers WHERE name = ?", name);
const LAN = id("SELECT id FROM users WHERE username = 'nv_lan'");
const BINH = id("SELECT id FROM users WHERE username = 'tk_binh'");
const KC = 1, KP = 2;

let pass = 0;
function test(name: string, fn: () => void) {
  try { fn(); pass++; console.log("  ✓", name); }
  catch (e) { console.error("  ✗", name, "\n   ", e instanceof Error ? e.message : e); process.exitCode = 1; }
}
const throwsBiz = (fn: () => unknown, re: RegExp) =>
  assert.throws(fn, (e: unknown) => e instanceof BizError && re.test(e.message));
const totalStock = () => (db.prepare("SELECT SUM(qty_base) AS s FROM lots").get() as { s: number }).s;

console.log("Dữ liệu mẫu");
test("seed tạo đủ người dùng, hàng, phiếu", () => {
  assert.equal(listUsers(db).length, 4);
  assert.ok((db.prepare("SELECT COUNT(*) AS n FROM sales").get() as { n: number }).n > 50);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM lots WHERE qty_base < 0").get() as { n: number }).n, 0);
});
test("sổ công nợ khớp: tổng nợ = Σ ghi nợ − Σ trả hàng trừ nợ − Σ thu", () => {
  const debit = (db.prepare("SELECT SUM(total) s FROM sales WHERE payment_type='cong_no'").get() as { s: number }).s;
  const ret = (db.prepare("SELECT COALESCE(SUM(total),0) s FROM returns WHERE method='tru_no'").get() as { s: number }).s;
  const pay = (db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments").get() as { s: number }).s;
  const bal = (db.prepare("SELECT SUM(debit-credit) s FROM debt_entries").get() as { s: number }).s;
  assert.ok(Math.abs(debit - ret - pay - bal) < 0.01);
});

console.log("UC03–UC06 bán hàng");
test("bán lẻ theo kg → trừ tồn theo con (hệ số 80), giá vốn FIFO", () => {
  const oc = P("OC010");
  const before = stockOf(db, oc, KC);
  const s = createSale(db, LAN, { customerId: C("Khách lẻ"), paymentType: "tien_mat", warehouseId: KC,
    items: [{ productId: oc, unit: "kg", qty: 2 }], cashGiven: 200000 });
  assert.equal(stockOf(db, oc, KC), before - 160);
  const it = getSale(db, s.id)!.items[0];
  assert.equal(it.price, getUnit(db, oc, "kg").sale_price);
  const cost = (db.prepare("SELECT cost FROM sale_items WHERE id = ?").get(it.id) as { cost: number }).cost;
  assert.ok(cost > 0 && cost < it.amount);
});
test("khách lẻ không được ghi nợ", () => {
  throwsBiz(() => createSale(db, LAN, { customerId: C("Khách lẻ"), paymentType: "cong_no", warehouseId: KC,
    items: [{ productId: P("OC010"), unit: "con", qty: 1 }] }), /khách thầu/);
});
test("không cho bán vượt tồn, không thay đổi dữ liệu khi lỗi", () => {
  const t = totalStock();
  throwsBiz(() => createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KC,
    items: [{ productId: P("OC011"), unit: "con", qty: 1 }, { productId: P("BL999"), unit: "con", qty: 99999 }] }), /Không đủ tồn/);
  assert.equal(totalStock(), t);
});
test("khách đưa thiếu tiền → báo lỗi", () => {
  throwsBiz(() => createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KC,
    items: [{ productId: P("OC010"), unit: "con", qty: 10 }], cashGiven: 1000 }), /chưa đủ/);
});
test("ghi nợ khách thầu → phát sinh nợ đúng số tiền sau chiết khấu", () => {
  const tu = C("Anh Tư");
  const b0 = balanceOf(db, tu);
  createSale(db, LAN, { customerId: tu, paymentType: "cong_no", warehouseId: KC, discount: 10000,
    items: [{ productId: P("OC010"), unit: "con", qty: 10 }] });
  assert.equal(balanceOf(db, tu), b0 + 10 * 1500 - 10000);
});

console.log("UC07–UC08 trả hàng");
test("trả hàng còn nguyên → cộng lại đúng lô, trừ công nợ", () => {
  const tu = C("Anh Tư");
  const s = createSale(db, LAN, { customerId: tu, paymentType: "cong_no", warehouseId: KC,
    items: [{ productId: P("LD010"), unit: "kg", qty: 1 }] });
  const item = getSale(db, s.id)!.items[0];
  const st0 = stockOf(db, P("LD010"), KC), b0 = balanceOf(db, tu);
  const r = createReturn(db, LAN, { saleId: s.id, method: "tru_no", items: [{ saleItemId: item.id, qty: 0.5, intact: true }] });
  assert.equal(stockOf(db, P("LD010"), KC), st0 + 100);
  assert.equal(r.total, 27500);
  assert.equal(balanceOf(db, tu), b0 - 27500);
});
test("hàng không còn nguyên → từ chối", () => {
  const s = createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KC, items: [{ productId: P("OC010"), unit: "con", qty: 5 }] });
  const item = getSale(db, s.id)!.items[0];
  throwsBiz(() => createReturn(db, LAN, { saleId: s.id, method: "hoan_tien", items: [{ saleItemId: item.id, qty: 1, intact: false }] }), /còn nguyên/);
  throwsBiz(() => createReturn(db, LAN, { saleId: s.id, method: "tru_no", items: [{ saleItemId: item.id, qty: 1, intact: true }] }), /khách thầu/);
  createReturn(db, LAN, { saleId: s.id, method: "hoan_tien", items: [{ saleItemId: item.id, qty: 5, intact: true }] });
  throwsBiz(() => createReturn(db, LAN, { saleId: s.id, method: "hoan_tien", items: [{ saleItemId: item.id, qty: 1, intact: true }] }), /tối đa 0/);
});

console.log("UC14–UC15 công nợ");
test("thu một phần trừ vào phiếu nợ cũ nhất trước; không thu vượt nợ", () => {
  const tu = C("Anh Tư");
  const bal = balanceOf(db, tu);
  throwsBiz(() => createPayment(db, LAN, { customerId: tu, amount: bal + 1, method: "Tiền mặt" }), /vượt/);
  createPayment(db, LAN, { customerId: tu, amount: 1000, method: "Tiền mặt" });
  assert.equal(balanceOf(db, tu), bal - 1000);
  const L = ledger(db, tu, "2000-01-01", "2999-12-31");
  const debits = L.lines.filter((l) => l.debit > 0);
  const firstOpen = debits.findIndex((d) => d.remaining > 0);
  assert.ok(debits.slice(firstOpen + 1).every((d) => d.remaining === d.debit), "chỉ phiếu cũ nhất bị trừ dở");
  createPayment(db, LAN, { customerId: tu, amount: balanceOf(db, tu), method: "Chuyển khoản" });
  assert.equal(balanceOf(db, tu), 0);
  assert.ok(!debtors(db).some((d) => d.id === tu));
});

console.log("UC09–UC10 nhập hàng, UC21 chuyển kho");
test("nhập theo cuộn tạo lô mới, giá vốn theo mét", () => {
  const dd = P("DD025");
  const st0 = stockOf(db, dd);
  const r = createPurchase(db, BINH, { supplierId: 2, warehouseId: KC, items: [{ productId: dd, unit: "cuộn", qty: 3, price: 1000000 }] });
  assert.equal(stockOf(db, dd), st0 + 300);
  const lot = db.prepare("SELECT l.* FROM lots l JOIN purchase_items pi ON pi.lot_id = l.id WHERE pi.receipt_id = ?").get(r.id) as { cost_per_base: number; lot_code: string };
  assert.equal(lot.cost_per_base, 10000);
  assert.match(lot.lot_code, /^L-DD025-\d{4}/);
});
test("hàng ngừng nhập không nhập được", () => {
  throwsBiz(() => createPurchase(db, BINH, { supplierId: 1, warehouseId: KC, items: [{ productId: P("BL999"), unit: "con", qty: 1, price: 1 }] }), /ngừng nhập/);
});
test("chuyển kho giữ lô & giá, tổng tồn không đổi, không vượt tồn lô", () => {
  const t0 = totalStock();
  const lot = lotsInWarehouse(db, KC).find((l) => l.product_code === "OC010")!;
  const p = P("OC010");
  const kc0 = stockOf(db, p, KC), kp0 = stockOf(db, p, KP);
  createTransfer(db, BINH, { fromWarehouseId: KC, toWarehouseId: KP, items: [{ lotId: lot.id, unit: "kg", qty: 1 }] });
  assert.equal(stockOf(db, p, KC), kc0 - 80);
  assert.equal(stockOf(db, p, KP), kp0 + 80);
  assert.equal(totalStock(), t0);
  const dest = db.prepare("SELECT * FROM lots WHERE lot_code = ? AND warehouse_id = ?").get(lot.lot_code, KP) as { cost_per_base: number };
  assert.equal(dest.cost_per_base, lot.cost_per_base);
  throwsBiz(() => createTransfer(db, BINH, { fromWarehouseId: KC, toWarehouseId: KP, items: [{ lotId: lot.id, unit: "con", qty: 1e9 }] }), /vượt tồn/);
  throwsBiz(() => createTransfer(db, BINH, { fromWarehouseId: KC, toWarehouseId: KC, items: [] }), /khác nhau/);
});

console.log("UC11–UC12 kiểm kê");
test("chốt kiểm kê: chỉ dòng lệch được ghi nhận, tồn cập nhật theo thực tế", () => {
  const kk = createStocktake(db, BINH, KC, "Ốc vít");
  const a = P("OC010"), b = P("OC011");
  const ba = stockOf(db, a, KC), bb = stockOf(db, b, KC);
  saveCounts(db, kk.id, [{ productId: a, actual: ba - 5, note: "đứt" }, { productId: b, actual: bb }]);
  const r = closeStocktake(db, kk.id);
  assert.equal(r.diffLines, 1);
  assert.ok(r.diffValue < 0);
  assert.equal(stockOf(db, a, KC), ba - 5);
  assert.equal(stockOf(db, b, KC), bb);
  throwsBiz(() => closeStocktake(db, kk.id), /đã chốt/);
  assert.ok(stocktakeDiffs(db, new Date().toISOString().slice(0, 7)).some((d) => d.product_code === "OC010"));
});

console.log("UC16–UC17 hàng hóa, UC19 nhân viên");
test("đơn vị cơ sở phải có hệ số 1, không trùng đơn vị", () => {
  throwsBiz(() => saveProduct(db, { code: "X1", name: "X", group_name: "G", base_unit: "con", min_stock: 0, status: "dang_ban",
    units: [{ unit: "con", factor: 2, sale_price: 1 }] }), /hệ số = 1/);
  throwsBiz(() => saveProduct(db, { code: "X1", name: "X", group_name: "G", base_unit: "con", min_stock: 0, status: "dang_ban",
    units: [{ unit: "kg", factor: 5, sale_price: 1 }, { unit: "kg", factor: 6, sale_price: 1 }] }), /trùng/);
  const pid = saveProduct(db, { code: "x1", name: "X", group_name: "G", base_unit: "con", min_stock: 0, status: "dang_ban",
    units: [{ unit: "kg", factor: 5, sale_price: 1 }] });
  assert.deepEqual((db.prepare("SELECT unit, factor FROM product_units WHERE product_id = ? ORDER BY factor").all(pid) as object[]).map((u) => ({ ...u })),
    [{ unit: "con", factor: 1 }, { unit: "kg", factor: 5 }]);
  throwsBiz(() => saveProduct(db, { code: "OC010", name: "dup", group_name: "G", base_unit: "con", min_stock: 0, status: "dang_ban", units: [] }), /đã tồn tại/);
});
test("không tự khóa tài khoản chủ đang đăng nhập", () => {
  throwsBiz(() => saveUser(db, { id: 1, full_name: "A", username: "admin", role: "chu", active: false }, 1), /tự khóa/);
});

console.log("UC20 báo cáo");
test("R1 lãi = doanh thu − trả − giá vốn; R3 có số liệu; R4/R5 có cảnh báo", () => {
  const m = new Date().toISOString().slice(0, 7);
  const r = profit(db, m);
  assert.equal(Math.round(r.revenue - r.returns - r.cogs), r.profit);
  assert.ok(salesByUser(db, m).some((u) => u.n > 0));
  assert.ok(slowMoving(db, 365).some((p) => p.code === "BL999"));
  assert.ok(Array.isArray(lowStock(db)));
});

console.log("Hủy / sửa chứng từ (chủ cửa hàng)");
const ADMIN = id("SELECT id FROM users WHERE username = 'admin'");
test("hủy phiếu bán ghi nợ → hoàn tồn, bỏ khoản nợ, loại khỏi báo cáo", () => {
  const sau = C("Chú Sáu"), p = P("OC011");
  const st0 = stockOf(db, p, KC), b0 = balanceOf(db, sau);
  const m = new Date().toISOString().slice(0, 7);
  const rev0 = profit(db, m).revenue;
  const s = createSale(db, LAN, { customerId: sau, paymentType: "cong_no", warehouseId: KC, items: [{ productId: p, unit: "con", qty: 3 }] });
  throwsBiz(() => cancelSale(db, ADMIN, s.id, "  "), /lý do/);
  cancelSale(db, ADMIN, s.id, "Lập nhầm khách");
  assert.equal(stockOf(db, p, KC), st0);
  assert.equal(balanceOf(db, sau), b0);
  assert.equal(profit(db, m).revenue, rev0);
  throwsBiz(() => cancelSale(db, ADMIN, s.id, "x"), /đã bị hủy/);
  const item = getSale(db, s.id)!.items[0];
  throwsBiz(() => createReturn(db, LAN, { saleId: s.id, method: "hoan_tien", items: [{ saleItemId: item.id, qty: 1, intact: true }] }), /đã bị hủy/);
});
test("không hủy phiếu đã có trả hàng hoặc khách đã trả nợ của phiếu", () => {
  const sau = C("Chú Sáu");
  const s1 = createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KC, items: [{ productId: P("OC010"), unit: "con", qty: 4 }] });
  createReturn(db, LAN, { saleId: s1.id, method: "hoan_tien", items: [{ saleItemId: getSale(db, s1.id)!.items[0].id, qty: 1, intact: true }] });
  throwsBiz(() => cancelSale(db, ADMIN, s1.id, "x"), /trả hàng/);
  createPayment(db, LAN, { customerId: sau, amount: balanceOf(db, sau), method: "Tiền mặt" }); // trả hết nợ cũ
  const s2 = createSale(db, LAN, { customerId: sau, paymentType: "cong_no", warehouseId: KC, items: [{ productId: P("OC010"), unit: "con", qty: 2 }] });
  createPayment(db, LAN, { customerId: sau, amount: 3000, method: "Tiền mặt" }); // trả đúng phiếu s2
  throwsBiz(() => cancelSale(db, ADMIN, s2.id, "x"), /đã thanh toán/);
  assert.equal(getSale(db, s2.id)!.sale.status, "ok", "lỗi thì không đổi gì");
});
test("hủy phiếu nhập: được khi lô chưa dùng, không được khi đã bán", () => {
  const p = P("KB200");
  const st0 = stockOf(db, p);
  const r = createPurchase(db, BINH, { supplierId: 3, warehouseId: KC, items: [{ productId: p, unit: "cái", qty: 7, price: 100000 }] });
  assert.equal(stockOf(db, p), st0 + 7);
  cancelPurchase(db, ADMIN, r.id, "Nhập nhầm số lượng");
  assert.equal(stockOf(db, p), st0);
  assert.equal(getPurchase(db, r.id)!.pr.status, "huy");
  assert.ok(!lastLotPrices(db, p).some((h) => h.price === 100000), "giá lô đã hủy không dùng gợi ý");

  const ml = P("ML010");
  const r2 = createPurchase(db, BINH, { supplierId: 3, warehouseId: KP, items: [{ productId: ml, unit: "cái", qty: 2, price: 1 }] });
  createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KP, items: [{ productId: ml, unit: "cái", qty: 1 }] });
  throwsBiz(() => cancelPurchase(db, ADMIN, r2.id, "x"), /đã được bán/);
});
test("sửa giá nhập → tính lại giá vốn phiếu bán, phiếu trả và lô đã chuyển kho", () => {
  const p = P("CL824");
  const r = createPurchase(db, BINH, { supplierId: 3, warehouseId: KP, items: [{ productId: p, unit: "bộ", qty: 10, price: 300000 }] });
  // bán hết hàng cũ ở kho phụ không có → chỉ lô mới ở kho phụ được dùng
  const s = createSale(db, LAN, { customerId: null, paymentType: "tien_mat", warehouseId: KP, items: [{ productId: p, unit: "bộ", qty: 4 }] });
  const si = getSale(db, s.id)!.items[0];
  createReturn(db, LAN, { saleId: s.id, method: "hoan_tien", items: [{ saleItemId: si.id, qty: 1, intact: true }] });
  const lot = getPurchase(db, r.id)!.items[0];
  createTransfer(db, BINH, { fromWarehouseId: KP, toWarehouseId: KC, items: [{ lotId: lot.lot_id, unit: "bộ", qty: 2 }] });
  const cost = () => (db.prepare("SELECT cost FROM sale_items WHERE id = ?").get(si.id) as { cost: number }).cost;
  const retCost = () => (db.prepare("SELECT cost FROM return_items WHERE sale_item_id = ?").get(si.id) as { cost: number }).cost;
  assert.equal(cost(), 1200000);
  assert.equal(retCost(), 300000);
  const res = updatePurchasePrice(db, ADMIN, lot.id, 250000);
  assert.equal(res.affectedSales, 1);
  assert.equal(cost(), 1000000);
  assert.equal(retCost(), 250000);
  assert.equal(getPurchase(db, r.id)!.pr.total, 2500000);
  const costs = db.prepare("SELECT DISTINCT cost_per_base c FROM lots WHERE lot_code = ?").all(lot.lot_code) as { c: number }[];
  assert.deepEqual(costs.map((x) => x.c), [250000], "lô ở cả 2 kho cùng giá mới");
  assert.equal(getPurchase(db, r.id)!.log.length, 1, "có nhật ký chỉnh sửa");
});
test("ghi nợ đầu kỳ: chỉ khách thầu chưa có giao dịch, tính nợ từ ngày đã nhập", () => {
  throwsBiz(() => createOpeningDebt(db, ADMIN, { customerId: C("Khách lẻ"), amount: 1000, date: "2026-01-01" }), /khách thầu/);
  throwsBiz(() => createOpeningDebt(db, ADMIN, { customerId: C("Anh Tư"), amount: 1000, date: "2026-01-01" }), /đã có giao dịch/);
  const kh = saveCustomer(db, { name: "Thầu Mới", type: "thau", credit_limit: 0 });
  throwsBiz(() => createOpeningDebt(db, ADMIN, { customerId: kh, amount: 1000, date: "2999-01-01" }), /sau hôm nay/);
  createOpeningDebt(db, ADMIN, { customerId: kh, amount: 2_000_000, date: "2026-01-15", note: "sổ cũ" });
  createOpeningDebt(db, ADMIN, { customerId: kh, amount: 500_000, date: "2026-02-10" });
  assert.equal(balanceOf(db, kh), 2_500_000);
  createPayment(db, LAN, { customerId: kh, amount: 2_000_000, method: "Tiền mặt" });
  assert.equal(debtors(db).find((d) => d.id === kh)!.since!.slice(0, 10), "2026-02-10", "khoản cũ nhất đã trả xong");
});

console.log("Khởi tạo & nâng cấp CSDL");
test("CSDL trống: chỉ có admin, 2 kho, khách lẻ; đúng phiên bản mới nhất", () => {
  const e = openDb(":memory:", "trong", "matkhau1");
  const cnt = (t: string) => (e.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  assert.deepEqual([cnt("users"), cnt("warehouses"), cnt("customers"), cnt("products"), cnt("sales")], [1, 2, 1, 0, 0]);
  assert.equal(e.pragma("user_version", { simple: true }), LATEST_VERSION);
});
test("nâng cấp CSDL cũ (phiên bản 0) giữ dữ liệu, dựng lại lô trả hàng", () => {
  const o = new Database(":memory:");
  o.exec(BASE_SCHEMA);
  o.exec(`
    INSERT INTO users VALUES (1,'NV00','A','admin','x','chu',NULL,1);
    INSERT INTO warehouses VALUES (1,'Kho chính');
    INSERT INTO customers VALUES (1,'KH001','T',NULL,NULL,'thau',0,NULL);
    INSERT INTO products VALUES (1,'P1','P','G','con',0,'dang_ban');
    INSERT INTO product_units VALUES (1,1,'con',1,10,NULL);
    INSERT INTO lots VALUES (1,1,1,'L1',5,0,'2026-01-01'),(2,1,1,'L2',6,0,'2026-02-01');
    INSERT INTO sales VALUES (1,'PB-1','2026-03-01',1,1,1,'cong_no',100,0,100,NULL,NULL);
    INSERT INTO sale_items VALUES (1,1,1,'con',1,10,10,100,56);
    INSERT INTO sale_item_lots VALUES (1,1,1,4,5,4),(2,1,2,6,6,1);
    INSERT INTO returns VALUES (1,'TH-1','2026-03-02',1,1,1,'tru_no',30,15,NULL),(2,'TH-2','2026-03-03',1,1,1,'tru_no',20,11,NULL);
    INSERT INTO return_items VALUES (1,1,1,3,30,15),(2,2,1,2,20,11);
    INSERT INTO debt_entries VALUES (1,1,'2026-03-01','ban','PB-1','Mua hàng',100,0),(2,1,'2026-03-02','tra','TH-1','Trả hàng',0,30);
  `);
  assert.deepEqual(migrate(o), [1]);
  assert.equal(o.pragma("user_version", { simple: true }), 1);
  assert.equal((o.prepare("SELECT status FROM sales").get() as { status: string }).status, "ok");
  assert.deepEqual(o.prepare("SELECT return_item_id r, sale_item_lot_id a, qty_base q FROM return_item_lots ORDER BY id").all().map((x) => ({ ...(x as object) })),
    [{ r: 1, a: 1, q: 3 }, { r: 2, a: 1, q: 1 }, { r: 2, a: 2, q: 1 }]);
  assert.equal((o.prepare("SELECT SUM(debit-credit) b FROM debt_entries").get() as { b: number }).b, 70);
  o.prepare("INSERT INTO debt_entries (customer_id, date, doc_type, doc_code, description, debit) VALUES (1,'2026-01-01','dau_ky','NDK','x',5)").run();
  assert.deepEqual(migrate(o), [], "chạy lại không làm gì");
});

console.log(`\n${pass} kiểm thử đạt${process.exitCode ? " – CÓ LỖI" : ""}`);
