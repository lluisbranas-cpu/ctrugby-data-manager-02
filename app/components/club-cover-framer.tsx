"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type CoverFrame = { zoom: number; x: number; y: number; aspect: number };
export function ClubCoverFramer({ file, aspect, busy, onSave, onCancel }: { file: File; aspect: number; busy: boolean; onSave: (frame: CoverFrame) => void; onCancel: () => void }) {
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(.5);
  const [y, setY] = useState(.5);
  const [failed, setFailed] = useState(false);
  useEffect(() => { const url = URL.createObjectURL(file); if (image.current) image.current.src = url; dialog.current?.showModal(); return () => URL.revokeObjectURL(url); }, [file]);
  const cropWidth = Math.min(size.width, size.height * aspect) / zoom;
  const cropHeight = cropWidth / aspect;
  const width = cropWidth ? size.width / cropWidth * 100 : 100;
  const left = cropWidth ? (size.width - cropWidth) * x / cropWidth * -100 : 0;
  const top = cropHeight ? (size.height - cropHeight) * y / cropHeight * -100 : 0;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  return createPortal(<dialog ref={dialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto max-h-[95dvh] w-[min(94vw,900px)] overflow-auto rounded-2xl border-0 bg-white p-5 text-neutral-900 shadow-2xl backdrop:bg-black/70">
    <h2 id={title} className="text-xl font-black">Ajustar fondo del club</h2>
    <p className="my-3 text-sm text-neutral-600">Arrastra la imagen para encajarla y ajusta la ampliación. La zona visible será la portada guardada.</p>
    <div ref={viewport} className="relative overflow-hidden rounded-lg bg-neutral-200" style={{ aspectRatio: aspect, touchAction: "none", cursor: busy ? "wait" : "grab" }}
      onPointerDown={event => { if (busy || !size.width) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, positionX: x, positionY: y }; }}
      onPointerMove={event => { const start = drag.current; if (!start || busy) return; const bounds = event.currentTarget.getBoundingClientRect(); const extraX = bounds.width * (size.width / cropWidth - 1); const extraY = bounds.height * (size.height / cropHeight - 1); if (extraX > 0) setX(clamp(start.positionX - (event.clientX - start.x) / extraX)); if (extraY > 0) setY(clamp(start.positionY - (event.clientY - start.y) / extraY)); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img ref={image} alt="Encuadre de la nueva portada" draggable={false} onLoad={event => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} onError={() => setFailed(true)} style={{ position: "absolute", width: `${width}%`, maxWidth: "none", height: "auto", left: `${left}%`, top: `${top}%`, pointerEvents: "none" }} />
    </div>
    <fieldset disabled={busy} className="my-4 grid gap-4 text-sm font-bold">
      <label className="grid gap-2">Ampliar / reducir · {Math.round(zoom * 100)} %<input type="range" min="1" max="4" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <label className="grid gap-2">Posición horizontal<input type="range" min="0" max="1" step="0.01" value={x} onChange={event => setX(Number(event.target.value))} /></label>
      <label className="grid gap-2">Posición vertical<input type="range" min="0" max="1" step="0.01" value={y} onChange={event => setY(Number(event.target.value))} /></label>
      <button type="button" onClick={() => { setZoom(1); setX(.5); setY(.5); }} className="justify-self-start rounded-lg border px-4 py-2">Restablecer y centrar</button>
    </fieldset>
    {failed && <p role="alert" className="mb-3 text-sm text-red-700">No se puede abrir esta imagen. Elige otra foto.</p>}
    <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 font-bold">Cancelar</button><button type="button" disabled={busy || !size.width || failed} onClick={() => onSave({ zoom, x, y, aspect })} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar encuadre"}</button></div>
  </dialog>, document.body);
}
