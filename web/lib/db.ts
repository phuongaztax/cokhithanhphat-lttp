import "server-only";
import path from "node:path";
import { openDb, type DB, type InitMode } from "./db-core";

export type { DB };

const DB_FILE = process.env.DB_FILE ?? path.join(process.cwd(), "data", "cuahang.db");

const g = globalThis as unknown as { __db?: DB };

export function getDb(): DB {
  // DB_INIT=trong → CSDL mới tạo sẽ trống (không dữ liệu mẫu); mặc định "mau"
  const init: InitMode = process.env.DB_INIT === "trong" ? "trong" : "mau";
  return (g.__db ??= openDb(DB_FILE, init, process.env.ADMIN_PASSWORD));
}
