"use client";

export default function PrintButton({ label = "In" }: { label?: string }) {
  return <button type="button" onClick={() => window.print()}>{label}</button>;
}
