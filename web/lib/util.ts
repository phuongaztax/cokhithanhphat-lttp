import type { DB } from "./db-core";

export class BizError extends Error {}

/** Ngày giờ địa phương dạng 'YYYY-MM-DD HH:MM:SS' (lưu trong SQLite). */
export function nowLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function today(): string {
  return nowLocal().slice(0, 10);
}

export function daysAgo(n: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return nowLocal(d);
}

export function daysBetween(fromDate: string, toDate: string = today()): number {
  const a = new Date(fromDate.slice(0, 10) + "T00:00:00");
  const b = new Date(toDate.slice(0, 10) + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Sinh mã chứng từ: PB-20261121-038 */
export function nextDocCode(db: DB, table: string, prefix: string, date: string): string {
  const ymd = date.slice(0, 10).replaceAll("-", "");
  const like = `${prefix}-${ymd}-%`;
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE code LIKE ?`).get(like) as { n: number };
  return `${prefix}-${ymd}-${String(row.n + 1).padStart(3, "0")}`;
}

export function round(n: number, d = 4): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

export const fmtMoney = (n: number | null | undefined) =>
  n == null ? "" : Math.round(n).toLocaleString("vi-VN");

export const fmtQty = (n: number | null | undefined) =>
  n == null ? "" : (Math.round(n * 1000) / 1000).toLocaleString("vi-VN");

export const fmtDate = (s: string | null | undefined) => {
  if (!s) return "";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const ROLE_LABEL: Record<string, string> = {
  ban_hang: "Nhân viên bán hàng",
  thu_kho: "Thủ kho",
  chu: "Chủ cửa hàng",
};
