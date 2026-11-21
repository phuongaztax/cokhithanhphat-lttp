/**
 * Khởi tạo / nâng cấp CSDL.
 *   npm run db:trong -- [--pass <mật khẩu admin>] [--force]   CSDL trống để dùng thật
 *   npm run db:mau   -- [--force]                              CSDL có dữ liệu mẫu để thử
 *   npm run db:nang-cap                                        chỉ nâng cấp CSDL hiện có lên phiên bản mới nhất
 * Biến môi trường DB_FILE đổi vị trí file (mặc định data/cuahang.db).
 * Có --force mà file đã tồn tại: file cũ được ĐỔI TÊN thành bản sao lưu, không bị xóa.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { openDb } from "../lib/db-core";
import { migrate, LATEST_VERSION } from "../lib/migrations";
import { nowLocal } from "../lib/util";

const args = process.argv.slice(2);
const mode = args[0];
const force = args.includes("--force");
const passIdx = args.indexOf("--pass");
const pass = passIdx >= 0 ? args[passIdx + 1] : undefined;
const file = process.env.DB_FILE ?? path.join(process.cwd(), "data", "cuahang.db");

function fail(msg: string): never {
  console.error("✗ " + msg);
  process.exit(1);
}

if (mode === "nang-cap") {
  if (!fs.existsSync(file)) fail(`Chưa có CSDL ${file}`);
  const db = new Database(file);
  const before = db.pragma("user_version", { simple: true });
  const done = migrate(db);
  db.close();
  console.log(done.length ? `✓ Đã nâng cấp từ phiên bản ${before} lên ${LATEST_VERSION} (bước: ${done.join(", ")})` : `✓ CSDL đã ở phiên bản mới nhất (${LATEST_VERSION})`);
  process.exit(0);
}

if (mode !== "trong" && mode !== "mau") fail("Dùng: init-db.ts trong|mau|nang-cap [--pass <mật khẩu>] [--force]");
if (pass !== undefined && pass.length < 6) fail("Mật khẩu admin tối thiểu 6 ký tự");

if (fs.existsSync(file)) {
  if (!force) fail(`Đã có CSDL ${file}. Thêm --force để thay (file cũ sẽ được đổi tên làm bản sao lưu).`);
  const stamp = nowLocal().replace(" ", "_").replace(/:/g, "-"); // giờ địa phương, VD 2026-11-21_16-14-35
  for (const ext of ["", "-wal", "-shm"]) {
    if (fs.existsSync(file + ext)) fs.renameSync(file + ext, `${file}.saoluu-${stamp}${ext}`);
  }
  console.log(`• Đã sao lưu CSDL cũ thành ${path.basename(file)}.saoluu-${stamp}`);
}

const db = openDb(file, mode, pass);
const n = (t: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
console.log(`✓ Đã tạo ${file} (phiên bản ${db.pragma("user_version", { simple: true })})`);
console.log(`  người dùng: ${n("users")}, kho: ${n("warehouses")}, hàng hóa: ${n("products")}, phiếu bán: ${n("sales")}`);
if (mode === "trong") {
  console.log(`  Đăng nhập: admin / ${pass ?? "admin123"} – hãy đổi mật khẩu ngay ở Quản trị → Nhân viên.`);
}
db.close();
