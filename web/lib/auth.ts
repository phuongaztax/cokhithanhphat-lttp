import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db";
import { verifyPassword } from "./services/master";
import { BizError, nowLocal } from "./util";

export type Role = "ban_hang" | "thu_kho" | "chu";
export type User = { id: number; code: string; full_name: string; username: string; role: Role };

const COOKIE = "chck_session";
const TTL_DAYS = 7;

export async function login(username: string, password: string): Promise<User> {
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase()) as
    (User & { password_hash: string; active: number }) | undefined;
  if (!row || !verifyPassword(password, row.password_hash)) throw new BizError("Sai tài khoản hoặc mật khẩu");
  if (!row.active) throw new BizError("Tài khoản đã bị khóa");
  const token = crypto.randomBytes(32).toString("hex");
  const exp = new Date(Date.now() + TTL_DAYS * 86400000);
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(nowLocal());
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)").run(token, row.id, nowLocal(exp));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", expires: exp, secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "1",
  });
  return { id: row.id, code: row.code, full_name: row.full_name, username: row.username, role: row.role };
}

export async function logout() {
  const jar = await cookies();
  const t = jar.get(COOKIE)?.value;
  if (t) getDb().prepare("DELETE FROM sessions WHERE token = ?").run(t);
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  const row = getDb().prepare(
    `SELECT u.id, u.code, u.full_name, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ? AND u.active = 1`,
  ).get(t, nowLocal()) as User | undefined;
  return row ?? null;
}

/** Dùng trong trang (Server Component): chưa đăng nhập → /login, sai vai trò → trang chính. */
export async function requireUser(roles?: Role[]): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role) && u.role !== "chu") redirect("/?denied=1");
  return u;
}

/** Quyền theo sơ đồ use case. Chủ cửa hàng được vào mọi màn hình. */
export const ACCESS = {
  traCuu: ["ban_hang", "thu_kho"] as Role[], // UC01 (UC02 báo giá: chỉ NV bán hàng)
  banHang: ["ban_hang"] as Role[], // UC02, UC03, UC07
  kho: ["thu_kho"] as Role[], // UC09, UC11, UC21
  congNo: ["ban_hang"] as Role[], // UC13, UC14, UC15
  quanTri: ["chu"] as Role[], // UC16, UC18, UC19, UC20
};

export function can(user: User, roles: Role[]) {
  return user.role === "chu" || roles.includes(user.role);
}
