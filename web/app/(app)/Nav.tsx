"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavGroup = { label: string; items: { href: string; label: string }[] };

export default function Nav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const match = (href: string) => {
    const p = href.split("?")[0];
    return p === "/" ? path === "/" : path === p || path.startsWith(p + "/");
  };
  return (
    <nav className="nav">
      <div className={`group ${path === "/" ? "active" : ""}`}>
        <span><Link href="/" style={{ color: "inherit" }}>Trang chính</Link></span>
      </div>
      {groups.map((g) => (
        <div key={g.label} className={`group ${g.items.some((i) => match(i.href)) ? "active" : ""}`} tabIndex={0}>
          <span>{g.label} ▾</span>
          <div className="menu">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className={match(i.href) ? "on" : ""}
                onClick={() => (document.activeElement as HTMLElement | null)?.blur()}>{i.label}</Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
