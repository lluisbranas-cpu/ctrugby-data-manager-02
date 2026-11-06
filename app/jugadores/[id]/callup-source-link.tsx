"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";

export function CallupSourceLink({playerId, sourceKey, sourceUrl, admin, compact = false, field = false, showSummary = false, onSourceChange}: {playerId: string; sourceKey?: string; sourceUrl?: string | null; federationUrl?: string | null; admin: boolean; compact?: boolean; field?: boolean; showSummary?: boolean; onSourceChange?: (url: string) => void}) {
  const [url, setUrl] = useState(sourceUrl || "");
  const [draft, setDraft] = useState(sourceUrl || "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    if (!showSummary) return;
    if (!url || !sourceKey) {setSummary(""); return;}
    const controller = new AbortController();
    setSummary(null);
    void fetch("/api/jugadores/" + encodeURIComponent(playerId) + "/convocatorias/resumen?key=" + encodeURIComponent(sourceKey), {signal: controller.signal, cache: "no-store"})
      .then(async (response) => {if (!response.ok) throw new Error(); return response.json();})
      .then((data) => setSummary(data.summary || ""))
      .catch(() => {if (!controller.signal.aborted) setSummary("");});
    return () => controller.abort();
  }, [showSummary, url, sourceKey, playerId]);
  const saved = useRef(sourceUrl || "");
  const queue = useRef<Promise<void>>(Promise.resolve());
  function save(event?: FormEvent) {
    event?.preventDefault();
    const snapshot = draft.trim();
    const operation = async () => {
      if (snapshot === saved.current) return;
      setBusy(true); setNotice("Guardando…");
      try {
        const response = await fetch("/api/jugadores/" + encodeURIComponent(playerId) + "/convocatorias/enlace", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({key: sourceKey, url: snapshot})});
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        saved.current = data.url; setUrl(data.url); onSourceChange?.(data.url); setDraft((current) => current.trim() === snapshot ? data.url : current); setNotice("Guardado.");
      } catch (reason) {setNotice(reason instanceof Error ? reason.message : "No se ha podido guardar el enlace.");}
      finally {setBusy(false);}
    };
    queue.current = queue.current.then(operation, operation);
  }
  return <div className={compact ? "mt-2 text-left" : "mt-4"}>
    {showSummary && <section className="mb-4" aria-label="Resumen de la noticia"><h3 className="mb-2 text-sm font-bold text-neutral-800">Resumen de la noticia</h3>{summary === null ? <p role="status" className="text-sm text-neutral-500">Cargando resumen…</p> : <p className="whitespace-normal break-words text-sm leading-relaxed text-neutral-600">{summary || (url ? "La fuente no ofrece un resumen disponible. Puedes leer la noticia completa en el enlace original." : "Añade el enlace original de la convocatoria para consultar su resumen.")}</p>}</section>}
    {url ? <div className="min-w-0"><span className="mb-1 block text-xs font-bold text-neutral-500">URL original</span><a href={url} target="_blank" rel="noopener noreferrer" className="block whitespace-normal break-all text-sm font-semibold text-red-700 underline underline-offset-2">{url}</a></div> : <p className="text-sm text-neutral-500">URL original pendiente.</p>}
    {!compact && url && <p className="mt-2 text-xs text-neutral-500">Se abre en otra pestaña para conservar esta página.</p>}
    {admin && sourceKey && !field && !editing && <button type="button" className="mt-3 block text-xs font-bold text-red-700" onClick={() => setEditing(true)}>{url ? "Editar enlace original" : "Añadir enlace original"}</button>}
    {(editing || (field && admin && sourceKey)) && <form onSubmit={save} className="mt-2 grid gap-2"><label className="grid gap-1 text-xs font-bold">URL<input type="url" required maxLength={2048} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => save()} placeholder="https://…" className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" /></label>{!field && <button type="button" disabled={busy} onClick={() => {save(); setEditing(false);}} className="text-left text-xs font-bold text-red-700">Cerrar edición</button>}</form>}
    {(notice || busy) && <p role="status" className="mt-2 text-xs text-neutral-600">{notice}</p>}
  </div>;
}
