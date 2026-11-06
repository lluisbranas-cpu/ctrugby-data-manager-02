"use client";

import { useState } from "react";
import { useRouter } from "@/lib/sport-navigation";

export function AccessReturnActions({ onBack, disabled = false }: { onBack?: () => void; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function back() {
    if (onBack) { onBack(); return; }
    if (window.history.length > 1) router.back();
    else window.location.assign("https://ctrugby.net");
  }
  async function exit() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
      if (!response.ok) throw new Error("No se ha podido cerrar la sesión. Vuelve a intentarlo.");
      window.location.assign("https://ctrugby.net");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido salir."); setBusy(false); }
  }
  return <div className="mt-6"><div className="flex items-center justify-center gap-8"><button type="button" disabled={busy || disabled} onClick={back} className="text-sm font-bold text-neutral-600 disabled:opacity-50">Volver</button><button type="button" disabled={busy || disabled} onClick={() => void exit()} className="text-sm font-bold text-neutral-600 disabled:opacity-50">{busy ? "Saliendo…" : "Salir"}</button></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</div>;
}
