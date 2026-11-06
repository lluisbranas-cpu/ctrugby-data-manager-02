"use client";

import { useRouter } from "@/lib/sport-navigation";

export function ClubPageClose() {
  const router = useRouter();
  return <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 6%", background: "#fafafa", borderBottom: "1px solid #e5e5e5" }}><button type="button" aria-label="Cerrar y volver a la página anterior" title="Volver a la página anterior" onClick={() => { if (window.history.length > 1) router.back(); else router.push("/clubs"); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, border: "1px solid #d4d4d4", borderRadius: 8, background: "#fff", color: "#404040", fontSize: 30, lineHeight: 1, cursor: "pointer" }}>×</button></div>;
}