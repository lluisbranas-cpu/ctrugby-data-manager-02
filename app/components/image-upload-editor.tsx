"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Save, X } from "lucide-react";
import type { PhotoFrame, PreparedPhoto } from "@/app/lib/player-photo-processing";
import styles from "./player-cover-editor.module.css";

type Props = {
  file: File;
  title: string;
  outputWidth: number;
  outputHeight: number;
  initialFit?: "cover" | "contain";
  allowRemoveBackground?: boolean;
  outputBackground?: string;
  circularFrame?: boolean;
  onChooseFile?: () => void;
  onSave: (prepared: Blob) => Promise<void>;
  onClose: () => void;
};

function fitFrame(photo: PreparedPhoto, width: number, height: number, fit: "cover" | "contain") {
  const byHeight = photo.original.height * width / height;
  const size = fit === "cover" ? Math.min(photo.original.width, byHeight) : Math.max(photo.original.width, byHeight);
  return { x: photo.original.width / 2, y: photo.original.height / 2, size };
}

function removeConnectedBackground(data: ImageData) {
  const { width, height } = data;
  const source = data.data;
  const output = new ImageData(new Uint8ClampedArray(source), width, height);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const stack: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].filter((index) => index >= 0 && index < pixelCount);
  const reference = corners.reduce((sum, index) => {
    const offset = index * 4;
    return { r: sum.r + source[offset], g: sum.g + source[offset + 1], b: sum.b + source[offset + 2], a: sum.a + source[offset + 3] };
  }, { r: 0, g: 0, b: 0, a: 0 });
  const samples = Math.max(1, corners.length);
  reference.r /= samples; reference.g /= samples; reference.b /= samples; reference.a /= samples;
  const isBackground = (index: number) => {
    const offset = index * 4;
    const alpha = source[offset + 3];
    if (alpha < 12) return true;
    const r = source[offset], g = source[offset + 1], b = source[offset + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (min > 238 && max - min < 22) || Math.hypot(r - reference.r, g - reference.g, b - reference.b) < 46;
  };
  const push = (index: number) => {
    if (index < 0 || index >= pixelCount || visited[index] || !isBackground(index)) return;
    visited[index] = 1;
    stack.push(index);
  };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { push(y * width); push(y * width + width - 1); }
  while (stack.length) {
    const index = stack.pop()!;
    const x = index % width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (index >= width) push(index - width);
    if (index < pixelCount - width) push(index + width);
  }
  for (let index = 0; index < pixelCount; index++) if (visited[index]) output.data[index * 4 + 3] = 0;
  return output;
}

export function ImageUploadEditor({ file, title, outputWidth, outputHeight, initialFit = "contain", allowRemoveBackground = false, outputBackground, circularFrame = false, onChooseFile, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [frame, setFrame] = useState<PhotoFrame | null>(null);
  const [removeBackground, setRemoveBackground] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointer: number; x: number; y: number; frame: PhotoFrame; width: number } | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    void import("@/app/lib/player-photo-processing").then(async (module) => {
      const result = await module.preparePlayerPhoto(file);
      if (!cancelled) {
        setPhoto(result);
        setFrame(fitFrame(result, outputWidth, outputHeight, initialFit));
        setRemoveBackground(allowRemoveBackground);
      }
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se ha podido leer la imagen."); });
    return () => { cancelled = true; };
  }, [allowRemoveBackground, file, initialFit, outputHeight, outputWidth]);

  useEffect(() => {
    if (!preview.current || !photo || !frame) return;
    const canvas = preview.current;
    const context = canvas.getContext("2d")!;
    const scale = canvas.width / frame.size;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const source = removeBackground && photo.cutout ? photo.cutout : photo.original;
    context.save();
    if (circularFrame) {
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - 2, 0, Math.PI * 2);
      context.clip();
    }
    if (removeBackground && !photo.cutout) {
      const cutout = document.createElement("canvas");
      cutout.width = canvas.width;
      cutout.height = canvas.height;
      const cutoutContext = cutout.getContext("2d")!;
      cutoutContext.drawImage(photo.original, canvas.width / 2 - frame.x * scale, canvas.height / 2 - frame.y * scale, photo.original.width * scale, photo.original.height * scale);
      cutoutContext.putImageData(removeConnectedBackground(cutoutContext.getImageData(0, 0, canvas.width, canvas.height)), 0, 0);
      if (removeBackground && outputBackground) {
        context.fillStyle = outputBackground;
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(cutout, 0, 0);
      context.restore();
      if (circularFrame) {
        context.strokeStyle = "#fff";
        context.lineWidth = Math.max(8, Math.round(canvas.width * 0.018));
        context.beginPath();
        context.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - context.lineWidth / 2, 0, Math.PI * 2);
        context.stroke();
      }
      return;
    }
    if (removeBackground && outputBackground) {
      context.fillStyle = outputBackground;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(source, canvas.width / 2 - frame.x * scale, canvas.height / 2 - frame.y * scale, source.width * scale, source.height * scale);
    context.restore();
    if (circularFrame) {
      context.strokeStyle = "#fff";
      context.lineWidth = Math.max(8, Math.round(canvas.width * 0.018));
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2 - context.lineWidth / 2, 0, Math.PI * 2);
      context.stroke();
    }
  }, [circularFrame, photo, frame, outputBackground, removeBackground]);

  const save = async () => {
    if (!preview.current) return;
    setBusy(true); setError("");
    try {
      const blob = await new Promise<Blob>((resolve, reject) => preview.current!.toBlob((value) => value ? resolve(value) : reject(new Error("No se ha podido preparar la imagen.")), "image/png"));
      await onSave(blob);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No se ha podido guardar la imagen."); }
    finally { setBusy(false); }
  };

  return <dialog ref={dialog} className={styles.dialog} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="image-upload-editor-title">
    <div className={styles.header}><h3 id="image-upload-editor-title">{title}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar" title="Cerrar"><X size={20} /></button></div>
    {!photo && !error && <p role="status">Preparando imagen...</p>}
    {photo && frame && <>
      <div className={styles.previewWrap}>
        <canvas ref={preview} width={outputWidth} height={outputHeight} className={styles.preview} style={{ aspectRatio: `${outputWidth} / ${outputHeight}`, touchAction: "none", cursor: dragging ? "grabbing" : "grab" }} tabIndex={0} aria-label={title} onPointerDown={(event) => {
          if (busy || event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, frame, width: event.currentTarget.getBoundingClientRect().width }; setDragging(true);
        }} onPointerMove={(event) => {
          const start = drag.current; if (!start || start.pointer !== event.pointerId) return;
          const scale = start.frame.size / start.width;
          setFrame({ ...start.frame, x: Math.max(0, Math.min(photo.original.width, start.frame.x - (event.clientX - start.x) * scale)), y: Math.max(0, Math.min(photo.original.height, start.frame.y - (event.clientY - start.y) * scale)) });
        }} onPointerUp={() => { drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }} onLostPointerCapture={() => { drag.current = null; setDragging(false); }} />
      </div>
      {photo.warning && <p className={styles.notice} role="status">{photo.warning}</p>}
      <fieldset disabled={busy} className={styles.controls}>
        <label>Zoom<input type="range" min="0.5" max="4" step="0.01" value={fitFrame(photo, outputWidth, outputHeight, initialFit).size / frame.size} onChange={(event) => setFrame({ ...frame, size: fitFrame(photo, outputWidth, outputHeight, initialFit).size / Number(event.target.value) })} /></label>
        <label>Horizontal<input type="range" min="0" max={photo.original.width} step="1" value={frame.x} onChange={(event) => setFrame({ ...frame, x: Number(event.target.value) })} /></label>
        <label>Vertical<input type="range" min="0" max={photo.original.height} step="1" value={frame.y} onChange={(event) => setFrame({ ...frame, y: Number(event.target.value) })} /></label>
        {allowRemoveBackground && <label className={styles.checkbox}><input type="checkbox" checked={removeBackground} onChange={(event) => setRemoveBackground(event.target.checked)} />Quitar fondo</label>}
      </fieldset>
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div className={styles.actions}>{onChooseFile && <button type="button" disabled={busy} onClick={onChooseFile} aria-label="Cambiar foto" title="Cambiar foto"><Camera size={18} /></button>}<button type="button" disabled={busy} onClick={onClose} aria-label="Cancelar" title="Cancelar"><X size={18} /></button><button type="button" disabled={!photo || busy} className={styles.save} onClick={() => void save()} aria-label="Guardar" title="Guardar"><Save size={18} />{busy ? "Guardando..." : "Guardar"}</button></div>
  </dialog>;
}
