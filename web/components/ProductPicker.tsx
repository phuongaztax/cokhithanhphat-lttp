"use client";

import { useId, useState } from "react";
import type { CatalogItem } from "@/lib/services/inventory";

/** Ô chọn hàng: gõ mã hoặc tên, chọn từ gợi ý (datalist). */
export default function ProductPicker({
  catalog, onPick, placeholder = "Gõ mã / tên hàng…", className = "lg", filter,
}: {
  catalog: CatalogItem[];
  onPick: (p: CatalogItem) => void;
  placeholder?: string;
  className?: string;
  filter?: (p: CatalogItem) => boolean;
}) {
  const id = useId();
  const [v, setV] = useState("");
  const list = filter ? catalog.filter(filter) : catalog;
  const label = (p: CatalogItem) => `${p.code} – ${p.name}`;
  const tryPick = (val: string) => {
    const t = val.trim().toLowerCase();
    const p = list.find((x) => label(x).toLowerCase() === t || x.code.toLowerCase() === t);
    if (p) { onPick(p); setV(""); return true; }
    return false;
  };
  return (
    <>
      <input
        className={className} list={id} value={v} placeholder={placeholder}
        onChange={(e) => { setV(e.target.value); tryPick(e.target.value); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!tryPick(v)) {
              const t = v.trim().toLowerCase();
              const hits = list.filter((x) => label(x).toLowerCase().includes(t));
              if (hits.length === 1) { onPick(hits[0]); setV(""); }
            }
          }
        }}
      />
      <datalist id={id}>
        {list.map((p) => <option key={p.id} value={label(p)} />)}
      </datalist>
    </>
  );
}
