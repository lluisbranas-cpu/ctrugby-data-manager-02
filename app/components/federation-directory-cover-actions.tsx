"use client";

import { DeleteButton } from "@/app/components/delete-button";
import { useEffect, useRef, useState } from "react";
import { ImageUploadEditor } from "./image-upload-editor";

export function FederationDirectoryCoverActions({ endpoint = "/api/federaciones/portada/directorio", onUpdated }: { endpoint?: string; onUpdated?: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<File | null>(null);

  useEffect(() => { void fetch(`${endpoint}?meta=1`, { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setExists(Boolean(data?.exists))).catch(() => undefined); }, [endpoint]);
  const upload = async (file: Blob) => { setBusy(true); setNotice(""); try { const form = new FormData(); form.set("file", file, "cover.png"); const response = await fetch(endpoint, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la imagen."); setExists(true); setPending(null); setNotice("Imagen de cabecera actualizada."); onUpdated?.(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido guardar la imagen."); throw cause; } finally { setBusy(false); } };
  const remove = async () => { setBusy(true); setNotice(""); try { const response = await fetch(endpoint, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se ha podido borrar la imagen."); setExists(false); setNotice("Imagen de cabecera eliminada."); onUpdated?.(); } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido borrar la imagen."); } finally { setBusy(false); } };
  return <div className="federation-directory-cover-actions"><input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) setPending(file); }} /><button type="button" aria-label={busy ? "Procesando imagen de cabecera" : "Cambiar imagen de cabecera"} title="Cambiar imagen de cabecera" disabled={busy} onClick={() => input.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8.4 4.5 9.7 3h4.6l1.3 1.5H19A3 3 0 0 1 22 7.5v9A3 3 0 0 1 19 19.5H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3Z"/><circle cx="12" cy="12" r="3.5"/></svg></button>{exists && <DeleteButton type="button" className="federation-directory-cover-delete" disabled={busy} onClick={() => void remove()} aria-label="Borrar" />}{notice && <span role="status">{notice}</span>}{pending && <ImageUploadEditor file={pending} title="Imagen de cabecera" outputWidth={1920} outputHeight={1000} initialFit="cover" onChooseFile={() => input.current?.click()} onClose={() => setPending(null)} onSave={upload} />}</div>;
}
