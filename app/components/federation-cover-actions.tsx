"use client";

import { DeleteButton } from "@/app/components/delete-button";
import { useEffect, useRef, useState } from "react";

export function FederationCoverActions({ id, onUpdated }: { id: string; onUpdated?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => { void fetch(`/api/federaciones/portada/${id}?meta=1`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setExists(Boolean(data?.exists))).catch(() => undefined); }, [id]);
  const upload = async (file: File) => { setBusy(true); setNotice(""); try { const form = new FormData(); form.set("file", file); const response = await fetch(`/api/federaciones/portada/${id}`, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la imagen."); setExists(true); setNotice("Imagen de cabecera actualizada."); onUpdated?.(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido guardar la imagen."); } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); setNotice(""); try { const response = await fetch(`/api/federaciones/portada/${id}`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se ha podido borrar la imagen."); setExists(false); setNotice("Imagen de cabecera eliminada."); onUpdated?.(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido borrar la imagen."); } finally { setBusy(false); } };
  return <div className="mt-4 flex flex-wrap items-center gap-2"><input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} /><button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label={busy ? "Procesando imagen de cabecera" : "Cambiar imagen de cabecera"} title="Cambiar imagen de cabecera" disabled={busy} onClick={() => input.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.4 4.5 9.7 3h4.6l1.3 1.5H19A3 3 0 0 1 22 7.5v9A3 3 0 0 1 19 19.5H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z"/><circle cx="12" cy="12" r="3.5"/></svg></button>{exists && <DeleteButton type="button" className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-bold text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" disabled={busy} onClick={() => void remove()} aria-label="Borrar imagen" />}{notice && <span className="text-xs text-neutral-500" role="status">{notice}</span>}</div>;
}
