"use client";
import { useRef, useState, type RefObject } from "react";

import { ClubCoverFramer, type CoverFrame } from "./club-cover-framer";

type Kind = "shield" | "cover";
export function ClubMediaActions({ id, onUpdated, coverOnly = false }: { id: string; onUpdated: () => void; coverOnly?: boolean }) {
  const shield = useRef<HTMLInputElement>(null); const cover = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Kind | null>(null); const [notice, setNotice] = useState("");
  const [pendingCover, setPendingCover] = useState<{ file: File; aspect: number } | null>(null);
  const upload = async (kind: Kind, file: File, frame?: CoverFrame) => {
    setBusy(kind); setNotice("");
    try { const form = new FormData(); form.set("file", file); if (frame) form.set("frame", JSON.stringify(frame)); const response = await fetch(kind === "shield" ? `/api/clubs/escudo/${id}` : `/api/clubs/portada/${id}`, { method: "POST", body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la imagen."); if (kind === "cover") setPendingCover(null); onUpdated(); setNotice(kind === "shield" ? "Escudo actualizado." : "Portada actualizada con el encuadre elegido."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar la imagen."); }
    finally { setBusy(null); }
  };
  const input = (ref: RefObject<HTMLInputElement | null>, kind: Kind) => <input ref={ref} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (kind === "shield") { void upload(kind, file); return; } if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) { setNotice("Elige una imagen PNG, JPG o WebP de hasta 8 MB."); return; } const bounds = event.currentTarget.closest(".club-profile-cover")?.getBoundingClientRect(); setNotice(""); setPendingCover({ file, aspect: bounds ? Math.max(1, Math.min(6, bounds.width / bounds.height)) : 3 }); }}/>;
  return <div className={coverOnly ? "club-media-actions club-cover-actions" : "club-media-actions"}>{input(shield, "shield")}{input(cover, "cover")}{coverOnly ? <button type="button" aria-label={busy === "cover" ? "Subiendo foto de cabecera" : "Cambiar foto de cabecera"} title="Cambiar foto de cabecera" onClick={() => cover.current?.click()} disabled={Boolean(busy)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 4.5 9.7 3h4.6l1.3 1.5H19A3 3 0 0 1 22 7.5v9A3 3 0 0 1 19 19.5H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h3.4ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z" /></svg><span className="sr-only">{busy === "cover" ? "Subiendo foto de cabecera" : "Cambiar foto de cabecera"}</span></button> : <><button type="button" onClick={() => shield.current?.click()} disabled={Boolean(busy)}>+Escudo</button><button type="button" onClick={() => cover.current?.click()} disabled={Boolean(busy)}>{busy === "cover" ? "Subiendo…" : "+Portada"}</button><a href="#camisetas">+Camiseta</a></>}{pendingCover && <ClubCoverFramer file={pendingCover.file} aspect={pendingCover.aspect} busy={Boolean(busy)} onCancel={() => setPendingCover(null)} onSave={frame => { void upload("cover", pendingCover.file, frame); }} />}{notice && <p role="status">{notice}</p>}</div>;
}
