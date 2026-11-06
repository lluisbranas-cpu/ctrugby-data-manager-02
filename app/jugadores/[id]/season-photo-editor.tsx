"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Save, X } from "lucide-react";
import type { PhotoFrame, PreparedPhoto } from "@/app/lib/player-photo-processing";
import styles from "./season-photo-editor.module.css";

export function SeasonPhotoEditor({ file, season, onSave, onClose }: { file: File; season: string; onSave: (prepared: Blob) => Promise<void>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const preview = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null); const [frame, setFrame] = useState<PhotoFrame | null>(null);
  const [removeBackground, setRemoveBackground] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const drag = useRef<{ pointer: number; x: number; y: number; frame: PhotoFrame; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const renderer = useRef<typeof import("@/app/lib/player-photo-processing") | null>(null);
  useEffect(() => {
    dialog.current?.showModal(); let cancelled = false;
    void import("@/app/lib/player-photo-processing").then(async (module) => {
      renderer.current = module; const result = await module.preparePlayerPhoto(file);
      if (!cancelled) { setPhoto(result); setFrame(result.frame); setRemoveBackground(Boolean(result.cutout)); }
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se ha podido leer la imagen."); });
    return () => { cancelled = true; };
  }, [file]);
  useEffect(() => { if (preview.current && photo && frame) renderer.current?.drawPlayerPortrait(preview.current, photo, frame, removeBackground); }, [photo, frame, removeBackground]);
  const save = async () => {
    if (!preview.current) return; setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => preview.current!.toBlob((value) => value ? resolve(value) : reject(new Error("No se ha podido preparar la foto.")), "image/png"));
      await onSave(blob);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se ha podido guardar la foto."); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="season-photo-title">
    <div className={styles.header}><h3 id="season-photo-title">Foto de {season}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar" title="Cerrar"><X size={20} /></button></div>
    {!photo && !error && <p role="status">Preparando foto...</p>}
    {photo && frame && <><canvas ref={preview} width={1200} height={1200} className={styles.preview} style={{ touchAction: "none", cursor: dragging ? "grabbing" : "grab" }} tabIndex={0} aria-label={`Vista previa de la foto de ${season}`} onPointerDown={(event) => {
      if (busy || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, frame, width: event.currentTarget.getBoundingClientRect().width }; setDragging(true);
    }} onPointerMove={(event) => {
      const start = drag.current; if (!start || start.pointer !== event.pointerId) return;
      const scale = start.frame.size / start.width;
      setFrame({ ...start.frame, x: Math.max(0, Math.min(photo.original.width, start.frame.x - (event.clientX - start.x) * scale)), y: Math.max(0, Math.min(photo.original.height, start.frame.y - (event.clientY - start.y) * scale)) });
    }} onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }} onLostPointerCapture={() => { drag.current = null; setDragging(false); }} onKeyDown={(event) => {
      if (busy || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault(); const step = frame.size / 100;
      setFrame({ ...frame, x: Math.max(0, Math.min(photo.original.width, frame.x + (event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0))), y: Math.max(0, Math.min(photo.original.height, frame.y + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0))) });
    }} />
      {photo.warning && <p className={styles.notice} role="status">{photo.warning}</p>}
      {photo.faces.length > 1 && <div className={styles.faces} aria-label="Seleccionar jugador">{photo.faces.map((face, index) => <button key={index} type="button" disabled={busy} onClick={() => setFrame(face)}>Cara {index + 1}</button>)}</div>}
      <fieldset disabled={busy} className={styles.controls}>
        <label>Zoom<input type="range" min="0.5" max="4" step="0.01" value={photo.frame.size / frame.size} onChange={(event) => setFrame({ ...frame, size: photo.frame.size / Number(event.target.value) })} /></label>
        <label>Horizontal<input type="range" min="0" max={photo.original.width} step="1" value={frame.x} onChange={(event) => setFrame({ ...frame, x: Number(event.target.value) })} /></label>
        <label>Vertical<input type="range" min="0" max={photo.original.height} step="1" value={frame.y} onChange={(event) => setFrame({ ...frame, y: Number(event.target.value) })} /></label>
        <label className={styles.checkbox}><input type="checkbox" checked={removeBackground} disabled={!photo.cutout} onChange={(event) => setRemoveBackground(event.target.checked)} />Quitar fondo</label>
      </fieldset>
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>{photo && <button type="button" disabled={busy} onClick={() => { setFrame(photo.frame); setRemoveBackground(Boolean(photo.cutout)); }} title="Restablecer encuadre" aria-label="Restablecer encuadre"><RotateCcw size={18} /></button>}<button type="button" disabled={busy} onClick={onClose} title="Cancelar" aria-label="Cancelar"><X size={18} /></button><button type="button" disabled={!photo || busy} className={styles.save} onClick={() => void save()} title="Guardar" aria-label="Guardar"><Save size={18} />{busy ? "Guardando..." : "Guardar"}</button></div>
  </dialog>;
}
