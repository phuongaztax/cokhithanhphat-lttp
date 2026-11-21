import crypto from "node:crypto";
import type { DB } from "../db-core";
import { BizError } from "../util";
import { balanceOf } from "./debt";
import { getUnits, stockOf, type Product } from "./inventory";

const req = (v: string | undefined | null, label: string) => {
  const s = (v ?? "").trim();
  if (!s) throw new BizError(`${label} không được để trống`);
  return s;
};

function uniqueErr(e: unknown, msg: string): never {
  if (e instanceof Error && /UNIQUE/.test(e.message)) throw new BizError(msg);
  throw e;
}

// ------------------------------------------------------------ UC16 + UC17 hàng hóa
export type ProductInput = {
  id?: number; code: string; name: string; group_name: string; base_unit: string; min_stock: number;
  status: "dang_ban" | "ngung_nhap";
  units: { unit: string; factor: number; sale_price: number; usage?: string }[];
};

export function listProducts(db: DB, q = "", group = "") {
  const like = `%${q.trim()}%`;
  const rows = db.prepare(
    "SELECT * FROM products WHERE (code LIKE ? OR name LIKE ?) AND (? = '' OR group_name = ?) ORDER BY code",
  ).all(like, like, group, group) as Product[];
  return rows.map((p) => ({ ...p, stock: stockOf(db, p.id) }));
}

export function getProductFull(db: DB, id: number) {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Product | undefined;
  return p ? { ...p, units: getUnits(db, id) } : null;
}

export function saveProduct(db: DB, input: ProductInput) {
  const code = req(input.code, "Mã hàng").toUpperCase();
  const name = req(input.name, "Tên hàng");
  const group = req(input.group_name, "Nhóm hàng");
  const base = req(input.base_unit, "Đơn vị cơ sở");
  if (!(input.min_stock >= 0)) throw new BizError("Tồn tối thiểu không hợp lệ");
  const units = input.units.filter((u) => u.unit.trim());
  const seen = new Set<string>();
  for (const u of units) {
    u.unit = u.unit.trim();
    if (seen.has(u.unit)) throw new BizError(`Đơn vị "${u.unit}" bị trùng`);
    seen.add(u.unit);
    if (!(u.factor > 0)) throw new BizError(`Hệ số quy đổi của "${u.unit}" phải > 0`);
    if (!(u.sale_price >= 0)) throw new BizError(`Giá bán của "${u.unit}" không hợp lệ`);
  }
  const baseRow = units.find((u) => u.unit === base);
  if (!baseRow) units.unshift({ unit: base, factor: 1, sale_price: 0, usage: "Bán lẻ" });
  else if (baseRow.factor !== 1) throw new BizError("Đơn vị cơ sở phải có hệ số = 1");

  return db.transaction(() => {
    let id = input.id;
    try {
      if (id) {
        const old = db.prepare("SELECT base_unit FROM products WHERE id = ?").get(id) as { base_unit: string };
        if (old.base_unit !== base && stockOf(db, id) !== 0)
          throw new BizError("Không đổi được đơn vị cơ sở khi hàng còn tồn kho");
        db.prepare("UPDATE products SET code=?, name=?, group_name=?, base_unit=?, min_stock=?, status=? WHERE id=?")
          .run(code, name, group, base, input.min_stock, input.status, id);
      } else {
        id = Number(db.prepare("INSERT INTO products (code, name, group_name, base_unit, min_stock, status) VALUES (?,?,?,?,?,?)")
          .run(code, name, group, base, input.min_stock, input.status).lastInsertRowid);
      }
    } catch (e) { uniqueErr(e, `Mã hàng ${code} đã tồn tại`); }
    db.prepare("DELETE FROM product_units WHERE product_id = ?").run(id);
    const ins = db.prepare("INSERT INTO product_units (product_id, unit, factor, sale_price, usage) VALUES (?,?,?,?,?)");
    for (const u of units) ins.run(id, u.unit, u.factor, u.sale_price, u.usage ?? null);
    return id!;
  })();
}

// ------------------------------------------------------------ UC13 khách hàng
export type CustomerInput = {
  id?: number; name: string; phone?: string; address?: string; type: "le" | "thau"; credit_limit: number; note?: string;
};

export function listCustomers(db: DB, q = "", type = "") {
  const like = `%${q.trim()}%`;
  const rows = db.prepare(
    "SELECT * FROM customers WHERE (name LIKE ? OR COALESCE(phone,'') LIKE ? OR code LIKE ?) AND (? = '' OR type = ?) ORDER BY code",
  ).all(like, like, like, type, type) as (CustomerInput & { id: number; code: string })[];
  return rows.map((c) => ({ ...c, balance: balanceOf(db, c.id) }));
}

export function saveCustomer(db: DB, input: CustomerInput) {
  const name = req(input.name, "Tên khách");
  if (!(input.credit_limit >= 0)) throw new BizError("Hạn mức nợ không hợp lệ");
  if (input.id) {
    const cur = db.prepare("SELECT type FROM customers WHERE id = ?").get(input.id) as { type: string } | undefined;
    if (!cur) throw new BizError("Không tìm thấy khách hàng");
    if (cur.type === "thau" && input.type === "le" && balanceOf(db, input.id) > 0)
      throw new BizError("Khách đang còn nợ, không chuyển sang khách lẻ được");
    db.prepare("UPDATE customers SET name=?, phone=?, address=?, type=?, credit_limit=?, note=? WHERE id=?")
      .run(name, input.phone ?? null, input.address ?? null, input.type, input.credit_limit, input.note ?? null, input.id);
    return input.id;
  }
  const n = (db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number }).n;
  const code = `KH${String(n).padStart(3, "0")}`;
  return Number(db.prepare("INSERT INTO customers (code, name, phone, address, type, credit_limit, note) VALUES (?,?,?,?,?,?,?)")
    .run(code, name, input.phone ?? null, input.address ?? null, input.type, input.credit_limit, input.note ?? null).lastInsertRowid);
}

// ------------------------------------------------------------ UC18 nhà cung cấp
export type SupplierInput = { id?: number; name: string; contact?: string; phone?: string; address?: string; tax_code?: string };

export function listSuppliers(db: DB, q = "") {
  const like = `%${q.trim()}%`;
  return db.prepare(
    `SELECT s.*, (SELECT MAX(date) FROM purchase_receipts pr WHERE pr.supplier_id = s.id AND pr.status = 'ok') AS last_purchase,
       (SELECT COALESCE(SUM(total),0) FROM purchase_receipts pr WHERE pr.supplier_id = s.id AND pr.status = 'ok') AS total_purchase
     FROM suppliers s WHERE s.name LIKE ? OR s.code LIKE ? ORDER BY s.code`,
  ).all(like, like) as (SupplierInput & { id: number; code: string; last_purchase: string | null; total_purchase: number })[];
}

export function saveSupplier(db: DB, input: SupplierInput) {
  const name = req(input.name, "Tên nhà cung cấp");
  const v = [name, input.contact ?? null, input.phone ?? null, input.address ?? null, input.tax_code ?? null];
  if (input.id) {
    db.prepare("UPDATE suppliers SET name=?, contact=?, phone=?, address=?, tax_code=? WHERE id=?").run(...v, input.id);
    return input.id;
  }
  const n = (db.prepare("SELECT COUNT(*) AS n FROM suppliers").get() as { n: number }).n;
  return Number(db.prepare("INSERT INTO suppliers (code, name, contact, phone, address, tax_code) VALUES (?,?,?,?,?,?)")
    .run(`NCC${String(n + 1).padStart(2, "0")}`, ...v).lastInsertRowid);
}

export function supplierReceipts(db: DB, supplierId: number) {
  return db.prepare(
    "SELECT id, code, date, total, status FROM purchase_receipts WHERE supplier_id = ? ORDER BY date DESC LIMIT 20",
  ).all(supplierId) as { id: number; code: string; date: string; total: number; status: string }[];
}

// ------------------------------------------------------------ UC19 nhân viên
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, salt, 32).toString("hex");
  return `${salt}:${h}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, h] = stored.split(":");
  const calc = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(calc, Buffer.from(h, "hex"));
}

export type UserInput = {
  id?: number; full_name: string; username: string; phone?: string;
  role: "ban_hang" | "thu_kho" | "chu"; active: boolean; password?: string;
};

export function listUsers(db: DB) {
  return db.prepare("SELECT id, code, full_name, username, role, phone, active FROM users ORDER BY code").all() as {
    id: number; code: string; full_name: string; username: string; role: string; phone: string | null; active: number;
  }[];
}

export function saveUser(db: DB, input: UserInput, currentUserId: number) {
  const name = req(input.full_name, "Họ tên");
  const username = req(input.username, "Tài khoản").toLowerCase();
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) throw new BizError("Tài khoản chỉ gồm chữ thường, số, _ . (3–30 ký tự)");
  if (input.id === currentUserId && (!input.active || input.role !== "chu"))
    throw new BizError("Không tự khóa hoặc tự hạ quyền tài khoản đang đăng nhập");
  try {
    if (input.id) {
      db.prepare("UPDATE users SET full_name=?, username=?, phone=?, role=?, active=? WHERE id=?")
        .run(name, username, input.phone ?? null, input.role, input.active ? 1 : 0, input.id);
      if (!input.active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(input.id);
      return input.id;
    }
    const pw = input.password?.trim();
    if (!pw || pw.length < 6) throw new BizError("Mật khẩu ban đầu tối thiểu 6 ký tự");
    const n = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
    return Number(db.prepare("INSERT INTO users (code, full_name, username, password_hash, role, phone, active) VALUES (?,?,?,?,?,?,?)")
      .run(`NV${String(n).padStart(2, "0")}`, name, username, hashPassword(pw), input.role, input.phone ?? null, input.active ? 1 : 0).lastInsertRowid);
  } catch (e) { uniqueErr(e, `Tài khoản ${username} đã tồn tại`); }
}

export function resetPassword(db: DB, userId: number, newPw: string) {
  if (newPw.length < 6) throw new BizError("Mật khẩu tối thiểu 6 ký tự");
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(newPw), userId);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export function suppliersMini(db: DB) {
  return db.prepare("SELECT id, code, name FROM suppliers ORDER BY name").all() as { id: number; code: string; name: string }[];
}

export function customersMini(db: DB) {
  return listCustomers(db).map((c) => ({ id: c.id, code: c.code, name: c.name, phone: c.phone ?? "", type: c.type, credit_limit: c.credit_limit, balance: c.balance }));
}
export type CustomerMini = ReturnType<typeof customersMini>[number];
