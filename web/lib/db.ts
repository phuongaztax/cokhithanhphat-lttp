import "server-only";
import path from "node:path";
import { openDb, type DB, type InitMode } from "./db-core";

export type { DB };

/**
 * Vị trí CSDL:
 *  - DB_FILE nếu có;
 *  - trên Vercel (serverless, ổ đĩa chỉ ghi được ở /tmp và không giữ lâu) → /tmp/cuahang.db, chạy ở chế độ DEMO;
 *  - mặc định: web/data/cuahang.db.
 */
const ON_VERCEL = !!process.env.VERCEL;
const DB_FILE = process.env.DB_FILE ?? (ON_VERCEL ? "/tmp/cuahang.db" : path.join(process.cwd(), "data", "cuahang.db"));

/** Chế độ dùng thử: dữ liệu có thể tự khôi phục về dữ liệu mẫu bất cứ lúc nào. */
export const DEMO_MODE = process.env.DEMO_MODE === "1" || (ON_VERCEL && !process.env.DB_FILE);

const g = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  // DB_INIT=trong → CSDL mới tạo sẽ trống (không dữ liệu mẫu); mặc định "mau"
  const init: InitMode = process.env.DB_INIT === "trong" ? "trong" : "mau";
  return (g.__db ??= openDb(DB_FILE, init, process.env.ADMIN_PASSWORD));
}
