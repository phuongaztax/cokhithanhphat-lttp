import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cửa hàng cơ khí – Quản lý bán hàng, kho, công nợ",
  description: "Phần mềm quản lý cửa hàng đồ cơ khí",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
