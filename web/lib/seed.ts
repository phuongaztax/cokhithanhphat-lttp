import type { DB } from "./db-core";
import { daysAgo } from "./util";
import { hashPassword, saveCustomer, saveProduct, saveSupplier } from "./services/master";
import { createPurchase, createStocktake, saveCounts, closeStocktake, createTransfer } from "./services/warehouse";
import { createSale, createReturn } from "./services/sales";
import { createPayment } from "./services/debt";
import { stockOf } from "./services/inventory";

/**
 * Dữ liệu mẫu bám theo đặc tả & wireframe: 1 chủ, 2 NV bán hàng, 1 thủ kho; ốc vít bán theo con/kg/hộp,
 * dây điện theo mét/cuộn; khách thầu ghi nợ; hàng tồn lâu; một đợt kiểm kê có chênh lệch.
 * Ngày được tính lùi từ hôm nay để báo cáo luôn có số liệu.
 */
export function seed(db: DB) {
  db.transaction(() => {
    const users = [
      ["NV00", "Phạm Minh Hùng", "admin", "admin123", "chu", "0905000000"],
      ["NV01", "Nguyễn Văn Lan", "nv_lan", "123456", "ban_hang", "0905111222"],
      ["NV02", "Lê Thị Mai", "nv_mai", "123456", "ban_hang", "0912333444"],
      ["NV03", "Trần Văn Bình", "tk_binh", "123456", "thu_kho", "0935555666"],
    ];
    for (const [code, name, u, pw, role, phone] of users)
      db.prepare("INSERT INTO users (code, full_name, username, password_hash, role, phone) VALUES (?,?,?,?,?,?)")
        .run(code, name, u, hashPassword(pw), role, phone);
    db.prepare("INSERT INTO warehouses (name) VALUES ('Kho chính'), ('Kho phụ (quầy)')").run();

    const P = (code: string, name: string, group: string, base: string, min: number,
      units: [string, number, number, string][], status: "dang_ban" | "ngung_nhap" = "dang_ban") =>
      saveProduct(db, {
        code, name, group_name: group, base_unit: base, min_stock: min, status,
        units: units.map(([unit, factor, sale_price, usage]) => ({ unit, factor, sale_price, usage })),
      });
    const OC010 = P("OC010", "Ốc lục giác M10x30", "Ốc vít", "con", 1000,
      [["con", 1, 1500, "Bán lẻ"], ["kg", 80, 62000, "Bán sỉ / nhập"], ["hộp", 500, 700000, "Bán sỉ"]]);
    const OC011 = P("OC011", "Ốc lục giác M10x50", "Ốc vít", "con", 200,
      [["con", 1, 2200, "Bán lẻ"], ["kg", 60, 60000, "Bán sỉ / nhập"]]);
    const LD010 = P("LD010", "Long đền M10", "Ốc vít", "con", 500,
      [["con", 1, 300, "Bán lẻ"], ["kg", 200, 55000, "Bán sỉ / nhập"]]);
    const BL999 = P("BL999", "Bulong M24 inox", "Ốc vít", "con", 0, [["con", 1, 18000, "Bán lẻ"]]);
    const DD025 = P("DD025", "Dây điện 2x2.5", "Dây điện", "mét", 100,
      [["mét", 1, 14000, "Bán lẻ"], ["cuộn", 100, 1250000, "Bán sỉ / nhập"]]);
    const DD015 = P("DD015", "Dây điện 2x1.5", "Dây điện", "mét", 100,
      [["mét", 1, 9500, "Bán lẻ"], ["cuộn", 100, 850000, "Bán sỉ / nhập"]]);
    const KB200 = P("KB200", "Kìm bấm 200mm", "Dụng cụ cầm tay", "cái", 5, [["cái", 1, 145000, "Bán lẻ"]]);
    const ML010 = P("ML010", "Mỏ lết 10 inch", "Dụng cụ cầm tay", "cái", 5, [["cái", 1, 165000, "Bán lẻ"]]);
    const CL824 = P("CL824", "Bộ cờ lê 8–24", "Dụng cụ cầm tay", "bộ", 3, [["bộ", 1, 420000, "Bán lẻ"]]);

    const NCC1 = saveSupplier(db, { name: "Công ty Bulong Việt Đức", contact: "Chị Hạnh", phone: "0283xxx111", address: "KCN Tân Bình, TP.HCM", tax_code: "0301234567" });
    const NCC2 = saveSupplier(db, { name: "Cadivi Đà Nẵng", contact: "Anh Quang", phone: "0236xxx222", address: "Liên Chiểu, Đà Nẵng", tax_code: "0400112233" });
    const NCC3 = saveSupplier(db, { name: "Dụng cụ Toàn Phát", contact: "Anh Phát", phone: "0905xxx333", address: "Thanh Khê, Đà Nẵng" });

    const KL = saveCustomer(db, { name: "Khách lẻ", type: "le", credit_limit: 0, note: "Khách vãng lai" });
    const TU = saveCustomer(db, { name: "Anh Tư", phone: "0905xxx123", address: "12 Lê Lợi, Q. Hải Châu", type: "thau", credit_limit: 30_000_000 });
    const HP = saveCustomer(db, { name: "Công ty XD Hòa Phát", phone: "0236xxx456", address: "45 Nguyễn Văn Linh", type: "thau", credit_limit: 100_000_000 });
    const SAU = saveCustomer(db, { name: "Chú Sáu", phone: "0914xxx789", address: "Hòa Vang", type: "thau", credit_limit: 20_000_000 });
    saveCustomer(db, { name: "Chị Hoa", phone: "0987xxx321", type: "le", credit_limit: 0 });

    const KC = 1, KP = 2, ADMIN = 1, LAN = 2, MAI = 3, BINH = 4;

    // ---- nhập hàng theo lô, giá mỗi đợt một khác
    createPurchase(db, BINH, { supplierId: NCC1, warehouseId: KC, items: [
      { productId: BL999, unit: "con", qty: 300, price: 15000 },
      { productId: OC010, unit: "kg", qty: 30, price: 45000 },
    ] }, daysAgo(420));
    // Bulong M24 nằm kho cả năm không ai mua → chủ đã cho ngừng nhập
    db.prepare("UPDATE products SET status = 'ngung_nhap' WHERE id = ?").run(BL999);
    createPurchase(db, BINH, { supplierId: NCC1, warehouseId: KC, items: [
      { productId: OC010, unit: "kg", qty: 40, price: 46500 },
      { productId: OC011, unit: "kg", qty: 8, price: 48000 },
      { productId: LD010, unit: "kg", qty: 10, price: 40000 },
    ] }, daysAgo(60));
    createPurchase(db, BINH, { supplierId: NCC2, warehouseId: KC, items: [
      { productId: DD025, unit: "cuộn", qty: 5, price: 960000 },
      { productId: DD015, unit: "cuộn", qty: 4, price: 650000 },
    ] }, daysAgo(58));
    createPurchase(db, BINH, { supplierId: NCC3, warehouseId: KC, items: [
      { productId: KB200, unit: "cái", qty: 60, price: 105000 },
      { productId: ML010, unit: "cái", qty: 50, price: 120000 },
      { productId: CL824, unit: "bộ", qty: 30, price: 300000 },
    ] }, daysAgo(55));
    createPurchase(db, BINH, { supplierId: NCC1, warehouseId: KC, items: [
      { productId: OC010, unit: "kg", qty: 50, price: 48000 },
    ] }, daysAgo(15));

    // ---- chuyển một phần dây điện ra quầy
    const lot = db.prepare("SELECT id FROM lots WHERE product_id = ? AND warehouse_id = ? ORDER BY id LIMIT 1").get(DD025, KC) as { id: number };
    createTransfer(db, BINH, { fromWarehouseId: KC, toWarehouseId: KP, items: [{ lotId: lot.id, unit: "mét", qty: 100 }] }, daysAgo(40));

    // ---- bán hàng: khách lẻ trả ngay, khách thầu ghi nợ
    let x = 7;
    const rnd = (n: number) => { x = (x * 1103515245 + 12345) % 2147483648; return x % n; };
    const menu: [number, string, number][] = [
      [OC010, "con", 40], [OC010, "kg", 2], [OC011, "con", 20], [LD010, "con", 50], [DD015, "mét", 15],
      [KB200, "cái", 1], [ML010, "cái", 1], [CL824, "bộ", 1], [DD025, "mét", 20],
    ];
    // Khớp ví dụ trong wireframe: Anh Tư lấy hàng 19, 11, 3 ngày trước
    const s1 = createSale(db, LAN, { customerId: TU, paymentType: "cong_no", warehouseId: KC, items: [
      { productId: OC010, unit: "kg", qty: 5 }, { productId: DD015, unit: "cuộn", qty: 1 }, { productId: KB200, unit: "cái", qty: 4 },
    ] }, daysAgo(19, 10));
    createSale(db, MAI, { customerId: TU, paymentType: "cong_no", warehouseId: KC, items: [
      { productId: CL824, unit: "bộ", qty: 4 }, { productId: ML010, unit: "cái", qty: 6 }, { productId: LD010, unit: "kg", qty: 4 },
    ] }, daysAgo(11, 15));
    const s3 = createSale(db, LAN, { customerId: TU, paymentType: "cong_no", warehouseId: KC, items: [
      { productId: OC010, unit: "kg", qty: 5 }, { productId: DD025, unit: "mét", qty: 50 }, { productId: LD010, unit: "con", qty: 200 },
    ] }, daysAgo(3, 9));
    // Trả lại 1 kg ốc còn nguyên → trừ công nợ
    const si = db.prepare("SELECT id FROM sale_items WHERE sale_id = ? AND product_id = ?").get(s3.id, OC010) as { id: number };
    createReturn(db, LAN, { saleId: s3.id, method: "tru_no", reason: "Mua dư", items: [{ saleItemId: si.id, qty: 1, intact: true }] }, daysAgo(1, 16));
    void s1;

    // Bán lẻ / bán thầu rải rác 50 ngày gần đây
    for (let d = 50; d >= 1; d--) {
      for (let k = 0; k < 3; k++) {
        const thau = rnd(4) === 0;
        const cust = thau ? [HP, SAU][rnd(2)] : KL;
        const items = Array.from({ length: 1 + rnd(3) }, () => {
          const [productId, unit, q] = menu[rnd(menu.length)];
          return { productId, unit, qty: 1 + rnd(q) };
        }).filter((it, i, arr) => arr.findIndex((y) => y.productId === it.productId && y.unit === it.unit) === i);
        try {
          createSale(db, [LAN, MAI][rnd(2)], {
            customerId: cust, paymentType: thau ? "cong_no" : "tien_mat", warehouseId: KC, items,
          }, daysAgo(d, 8 + k * 3));
        } catch { /* hết hàng thì bỏ qua */ }
      }
    }

    // Đẩy dây điện 2x2.5 xuống dưới mức tồn tối thiểu (để có cảnh báo R4)
    const dd = stockOf(db, DD025, KC);
    if (dd > 60) createSale(db, MAI, { customerId: HP, paymentType: "cong_no", warehouseId: KC, items: [{ productId: DD025, unit: "mét", qty: dd - 60 }] }, daysAgo(6, 14));

    // ---- thu nợ
    const bal = (db.prepare("SELECT SUM(debit-credit) AS b FROM debt_entries WHERE customer_id = ?").get(HP) as { b: number }).b;
    if (bal > 0) createPayment(db, ADMIN, { customerId: HP, amount: Math.round(bal * 0.6 / 1000) * 1000, method: "Chuyển khoản", note: "Thanh toán đợt 1" }, daysAgo(20, 17));

    // ---- kiểm kê có chênh lệch
    const kk = createStocktake(db, BINH, KC, "Ốc vít", daysAgo(5, 17));
    const book = (pid: number) => stockOf(db, pid, KC);
    saveCounts(db, kk.id, [
      { productId: OC010, actual: book(OC010) - 50, note: "Rơi vãi" },
      { productId: OC011, actual: book(OC011) },
      { productId: LD010, actual: book(LD010) + 20 },
      { productId: BL999, actual: book(BL999) },
    ]);
    closeStocktake(db, kk.id, daysAgo(5, 18));
  })();
}

/**
 * CSDL trống để dùng thật: chỉ có 2 kho, khách "Khách lẻ" (KH000) và tài khoản chủ cửa hàng `admin`.
 * Hàng hóa, nhà cung cấp, khách thầu, nhân viên, tồn đầu kỳ (phiếu nhập) và nợ đầu kỳ do chủ cửa hàng tự khai báo.
 */
export function seedEmpty(db: DB, adminPassword = "admin123") {
  if (adminPassword.length < 6) throw new Error("Mật khẩu admin tối thiểu 6 ký tự");
  db.transaction(() => {
    db.prepare("INSERT INTO users (code, full_name, username, password_hash, role) VALUES ('NV00','Chủ cửa hàng','admin',?,'chu')")
      .run(hashPassword(adminPassword));
    db.prepare("INSERT INTO warehouses (name) VALUES ('Kho chính'), ('Kho phụ (quầy)')").run();
    saveCustomer(db, { name: "Khách lẻ", type: "le", credit_limit: 0, note: "Khách vãng lai" });
  })();
}
