import type Database from "better-sqlite3";

type DB = Database.Database;

/**
 * Nâng cấp CSDL theo phiên bản (PRAGMA user_version).
 * - Phiên bản 0 = schema gốc trong db-core.ts (SCHEMA, không bao giờ sửa).
 * - Mỗi thay đổi schema sau này = THÊM một phần tử mới vào cuối mảng MIGRATIONS (không sửa phần tử cũ),
 *   và ghi vào docs/kien-truc.md mục 3 + mục 9.
 * CSDL mới tạo cũng đi qua đủ các bước, nên CSDL cũ và mới luôn giống nhau.
 */
export const MIGRATIONS: { version: number; name: string; up: (db: DB) => void }[] = [
  {
    version: 1,
    name: "Hủy phiếu bán / phiếu nhập, phân bổ lô khi trả hàng, nợ đầu kỳ, nhật ký chỉnh sửa",
    up(db) {
      for (const t of ["sales", "purchase_receipts"]) {
        db.exec(`
          ALTER TABLE ${t} ADD COLUMN status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','huy'));
          ALTER TABLE ${t} ADD COLUMN cancelled_at TEXT;
          ALTER TABLE ${t} ADD COLUMN cancelled_by INTEGER REFERENCES users(id);
          ALTER TABLE ${t} ADD COLUMN cancel_reason TEXT;
        `);
      }

      // Trả hàng nhận lại vào lô nào (để tính lại giá vốn khi sửa giá nhập)
      db.exec(`
        CREATE TABLE return_item_lots (
          id INTEGER PRIMARY KEY,
          return_item_id INTEGER NOT NULL REFERENCES return_items(id),
          sale_item_lot_id INTEGER NOT NULL REFERENCES sale_item_lots(id),
          qty_base REAL NOT NULL
        );
        CREATE INDEX idx_ril_return_item ON return_item_lots(return_item_id);
      `);
      // Dựng lại dữ liệu cho các phiếu trả cũ: phát lại theo đúng thứ tự createReturn đã dùng (lô theo id tăng dần)
      const items = db.prepare("SELECT ri.id, ri.sale_item_id, ri.qty, si.factor FROM return_items ri JOIN sale_items si ON si.id = ri.sale_item_id ORDER BY ri.id").all() as {
        id: number; sale_item_id: number; qty: number; factor: number;
      }[];
      const used = new Map<number, number>(); // sale_item_lot_id → đã gán
      const ins = db.prepare("INSERT INTO return_item_lots (return_item_id, sale_item_lot_id, qty_base) VALUES (?,?,?)");
      for (const it of items) {
        let need = it.qty * it.factor;
        const allocs = db.prepare("SELECT id, qty_base FROM sale_item_lots WHERE sale_item_id = ? ORDER BY id").all(it.sale_item_id) as { id: number; qty_base: number }[];
        for (const a of allocs) {
          if (need <= 1e-9) break;
          const take = Math.min(a.qty_base - (used.get(a.id) ?? 0), need);
          if (take <= 0) continue;
          ins.run(it.id, a.id, take);
          used.set(a.id, (used.get(a.id) ?? 0) + take);
          need -= take;
        }
      }

      // Sổ công nợ: thêm loại 'dau_ky' (nợ đầu kỳ). SQLite không sửa được CHECK → dựng lại bảng.
      db.exec(`
        CREATE TABLE debt_entries_new (
          id INTEGER PRIMARY KEY,
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          date TEXT NOT NULL,
          doc_type TEXT NOT NULL CHECK (doc_type IN ('dau_ky','ban','tra','thu')),
          doc_code TEXT NOT NULL,
          description TEXT NOT NULL,
          debit REAL NOT NULL DEFAULT 0,
          credit REAL NOT NULL DEFAULT 0
        );
        INSERT INTO debt_entries_new SELECT id, customer_id, date, doc_type, doc_code, description, debit, credit FROM debt_entries;
        DROP TABLE debt_entries;
        ALTER TABLE debt_entries_new RENAME TO debt_entries;
        CREATE INDEX idx_debt_customer ON debt_entries(customer_id, date);
      `);

      // Nhật ký chỉnh sửa / hủy chứng từ
      db.exec(`
        CREATE TABLE change_log (
          id INTEGER PRIMARY KEY,
          date TEXT NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          action TEXT NOT NULL,
          doc_code TEXT NOT NULL,
          detail TEXT NOT NULL
        );
        CREATE INDEX idx_change_log_doc ON change_log(doc_code);
      `);
    },
  },
];

export const LATEST_VERSION = MIGRATIONS.at(-1)?.version ?? 0;

/** Chạy các bước nâng cấp còn thiếu, mỗi bước trong một transaction. Trả về danh sách bước đã chạy. */
export function migrate(db: DB): number[] {
  const current = db.pragma("user_version", { simple: true }) as number;
  const done: number[] = [];
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.transaction(() => {
      m.up(db);
      db.pragma(`user_version = ${m.version}`);
    })();
    done.push(m.version);
  }
  return done;
}
