"use client";

import { AccessReturnActions } from "@/app/components/access-return-actions";
import { playerPdfFilename } from "@/lib/player-pdf-filename";
import { usePathname } from "@/lib/sport-navigation";
import { useEffect, useState, type ReactNode } from "react";

export function PrivateLinkEntry({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const token = pathname.split("/").filter(Boolean).at(-1) ?? "";
  const [entered, setEntered] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [playerName, setPlayerName] = useState("");
  useEffect(() => {
    if (!token) return;
    void fetch(`/api/revision-jugador/${token}?resumen=1`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ player_name?: string }> : null)
      .then((data) => setPlayerName(data?.player_name?.trim() || "Jugador Rugby"))
      .catch(() => setPlayerName("Jugador Rugby"));
  }, [token]);
  const downloadAndOpen = async () => {
    setDownloading(true);
    setError("");
    try {
      const response = await fetch(`/api/revision-jugador/${token}/pdf`, { cache: "no-store" });
      if (!response.ok) throw new Error("No se ha podido preparar la copia en PDF.");
      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = playerPdfFilename(response.headers.get("X-CTRugby-Player-Id") ?? "RUGBY");
      link.click();
      URL.revokeObjectURL(url);
      setEntered(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido preparar la copia en PDF.");
    } finally {
      setDownloading(false);
    }
  };
  const actions = <><button type="button" onClick={() => window.print()} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold hover:border-red-600 hover:text-red-700">Imprimir PDF</button><button type="button" onClick={() => window.dispatchEvent(new Event("ctrugby:show-public-preview"))} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold hover:border-red-600 hover:text-red-700">Ver modo público</button></>;
  if (entered) return <><aside aria-label="Modo de acceso" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-5 py-3"><strong className="text-sm text-red-800">Modo privado · enlace a tu ficha</strong><div className="flex flex-wrap items-center gap-3">{actions}</div></aside>{children}</>;
  return <main className="directory-app flex min-h-screen items-center justify-center px-5 py-10"><section className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm"><h1 className="text-2xl font-black uppercase tracking-normal">{playerName || "Cargando…"}</h1><p className="mt-5 text-sm leading-6 text-neutral-600">Antes de modificar tus datos, descarga un PDF de la ficha.</p><button type="button" onClick={() => void downloadAndOpen()} disabled={downloading || !token || !playerName} className="mt-6 w-full rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-60">{downloading ? "Preparando PDF…" : "Descargar PDF y abrir ficha"}</button>{error && <p role="alert" className="mt-4 text-sm font-semibold text-red-700">{error}</p>}<AccessReturnActions /></section></main>;
}
