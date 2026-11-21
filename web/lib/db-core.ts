import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed, seedEmpty } from "./seed";
import { migrate } from "./migrations";

export type DB = Database.Database;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ban_hang','thu_kho','chu')),
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warehouses (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL,
  base_unit TEXT NOT NULL,
  min_stock REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'dang_ban' CHECK (status IN ('dang_ban','ngung_nhap'))
);

-- UC17: đơn vị tính & hệ số quy đổi. factor = số đơn vị cơ sở trong 1 đơn vị này.
CREATE TABLE IF NOT EXISTS product_units (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  factor REAL NOT NULL CHECK (factor > 0),
  sale_price REAL NOT NULL DEFAULT 0,
  usage TEXT,
  UNIQUE (product_id, unit)
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  contact TEXT, phone TEXT, address TEXT, tax_code TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT, address TEXT,
  type TEXT NOT NULL CHECK (type IN ('le','thau')),
  credit_limit REAL NOT NULL DEFAULT 0,
  note TEXT
);

-- Lô hàng (UC10): mỗi dòng nhập tạo 1 lô, giữ giá nhập riêng. Tồn tính theo đơn vị cơ sở.
CREATE TABLE IF NOT EXISTS lots (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  lot_code TEXT NOT NULL,
  cost_per_base REAL NOT NULL,
  qty_base REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (lot_code, warehouse_id)
);

CREATE TABLE IF NOT EXISTS purchase_receipts (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  total REAL NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY,
  receipt_id INTEGER NOT NULL REFERENCES purchase_receipts(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  unit TEXT NOT NULL, factor REAL NOT NULL,
  qty REAL NOT NULL, price REAL NOT NULL, amount REAL NOT NULL,
  lot_id INTEGER NOT NULL REFERENCES lots(id)
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('tien_mat','cong_no')),
  subtotal REAL NOT NULL, discount REAL NOT NULL DEFAULT 0, total REAL NOT NULL,
  cash_given REAL, note TEXT
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  unit TEXT NOT NULL, factor REAL NOT NULL,
  qty REAL NOT NULL, price REAL NOT NULL, amount REAL NOT NULL,
  cost REAL NOT NULL DEFAULT 0
);
-- Phân bổ xuất kho theo lô (FIFO) để tính giá vốn và nhận lại đúng lô khi trả hàng.
CREATE TABLE IF NOT EXISTS sale_item_lots (
  id INTEGER PRIMARY KEY,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  lot_id INTEGER NOT NULL REFERENCES lots(id),
  qty_base REAL NOT NULL,
  cost_per_base REAL NOT NULL,
  returned_base REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  customer_id INTEGER REFERENCES customers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  method TEXT NOT NULL CHECK (method IN ('tru_no','hoan_tien')),
  total REAL NOT NULL, cost REAL NOT NULL, reason TEXT
);
CREATE TABLE IF NOT EXISTS return_items (
  id INTEGER PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES returns(id),
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  qty REAL NOT NULL, amount REAL NOT NULL, cost REAL NOT NULL
);

-- Sổ công nợ: debit = phát sinh nợ (bán ghi nợ), credit = giảm nợ (trả hàng / thu nợ).
CREATE TABLE IF NOT EXISTS debt_entries (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  date TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('ban','tra','thu')),
  doc_code TEXT NOT NULL,
  description TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount REAL NOT NULL, method TEXT NOT NULL, note TEXT
);

CREATE TABLE IF NOT EXISTS stocktakes (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  group_name TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','chot')),
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE TABLE IF NOT EXISTS stocktake_items (
  id INTEGER PRIMARY KEY,
  stocktake_id INTEGER NOT NULL REFERENCES stocktakes(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  book_qty REAL NOT NULL,
  actual_qty REAL,
  diff_value REAL NOT NULL DEFAULT 0,
  note TEXT,
  UNIQUE (stocktake_id, product_id)
);

CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  from_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  to_warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  note TEXT
);
CREATE TABLE IF NOT EXISTS transfer_items (
  id INTEGER PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES transfers(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  from_lot_id INTEGER NOT NULL REFERENCES lots(id),
  to_lot_id INTEGER NOT NULL REFERENCES lots(id),
  unit TEXT NOT NULL, factor REAL NOT NULL, qty REAL NOT NULL, qty_base REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lots_product ON lots(product_id, warehouse_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_debt_customer ON debt_entries(customer_id, date);
`;

export type InitMode = "mau" | "trong";

/**
 * Mở (tạo nếu chưa có) CSDL SQLite: tạo bảng gốc → nâng cấp lên phiên bản mới nhất (migrations.ts)
 * → nếu chưa có người dùng thì khởi tạo dữ liệu:
 *   - "mau": dữ liệu mẫu để thử (mặc định),
 *   - "trong": CSDL trống, chỉ có kho, khách lẻ và tài khoản chủ cửa hàng.
 */
export function openDb(file: string, init: InitMode | false = "mau", adminPassword?: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  migrate(db);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0 && init === "mau") seed(db);
  if (n === 0 && init === "trong") seedEmpty(db, adminPassword);
  return db;
}

export { SCHEMA as BASE_SCHEMA };
