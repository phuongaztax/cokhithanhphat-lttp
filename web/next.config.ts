import type { NextConfig } from "next";

// Ứng dụng nội bộ: mọi trang đều đọc session + SQLite theo từng request,
// nên không bật cacheComponents / partialPrefetching (tránh prerender dữ liệu).
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
