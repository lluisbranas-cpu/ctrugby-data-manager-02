"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import { useEffect, useRef, useState } from "react";

type GalleryResponse = { photos?: string[]; error?: string };
const types = new Set(["image/png", "image/jpeg", "image/webp"]);

function validImage(file: File) {
  if (!types.has(file.type)) throw new Error("Usa una imagen PNG, JPG o WebP.");
  if (file.size > 8_000_000) throw new Error("La foto original no puede superar 8 MB.");
  return file;
}

export function JerseyGallery({ id, name, admin }: { id: string; name: string; admin: boolean }) {
  const [photos, setPhotos] = useState<string[] | null>(null);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const active = photos?.[Math.min(index, Math.max(0, (photos?.length ?? 1) - 1))];
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/camisetas?id=${encodeURIComponent(id)}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as GalleryResponse;
      if (!response.ok) throw new Error(data.error ?? "No se han podido cargar las camisetas.");
      if (!cancelled) setPhotos(data.photos ?? []);
    }).catch((error: Error) => { if (!cancelled) setNotice(error.message); });
    return () => { cancelled = true; };
  }, [id]);
  const upload = async (file: File) => {
    setBusy(true); setNotice("");
    try {
      const form = new FormData();
      form.set("id", id); form.set("file", validImage(file));
      const response = await fetch("/api/camisetas", { method: "POST", body: form });
      const data = await response.json() as GalleryResponse;
      if (!response.ok) throw new Error(data.error ?? "No se ha podido subir la foto.");
      setPhotos(data.photos ?? []); setIndex((data.photos?.length ?? 1) - 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido subir la foto."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!active) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/camisetas?id=${encodeURIComponent(id)}&file=${encodeURIComponent(active.split("/").pop() ?? "")}`, { method: "DELETE" });
      const data = await response.json() as GalleryResponse;
      if (!response.ok) throw new Error(data.error ?? "No se ha podido eliminar la foto.");
      setPhotos(data.photos ?? []); setIndex(0);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la foto."); }
    finally { setBusy(false); }
  };
  if (photos !== null && !photos.length && !admin) return null;
  return <section id="camisetas" className="mt-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"><header className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-black tracking-[.14em] text-neutral-700">CAMISETAS</p><p className="mt-1 text-xs text-neutral-500">Galería de fotografías del club o federación.</p></div>{admin && <><input ref={input} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }}/><button type="button" className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-800 hover:border-red-700 hover:text-red-700 disabled:opacity-50" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Subiendo…" : "Añadir foto"}</button></>}</header>{active ? <div className="p-5"><div className="relative flex h-72 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 sm:h-80"><img src={active} alt={`Camiseta de ${name}, foto ${index + 1}`} className="h-full w-full object-contain p-3"/>{admin && <DeleteButton type="button" className="absolute right-3 top-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => void remove()} aria-label="Eliminar" />}</div>{photos && photos.length > 1 && <div className="mt-3 flex items-center justify-center gap-3"><button type="button" className="rounded-lg border border-neutral-300 px-3 py-1 disabled:opacity-40" disabled={photos.length < 2} onClick={() => setIndex((current) => (current - 1 + photos.length) % photos.length)}>←</button><span className="text-sm text-neutral-600">{index + 1} / {photos.length}</span><button type="button" className="rounded-lg border border-neutral-300 px-3 py-1 disabled:opacity-40" disabled={photos.length < 2} onClick={() => setIndex((current) => (current + 1) % photos.length)}>→</button></div>}</div> : <p className="px-5 py-7 text-sm text-neutral-500">Todavía no hay camisetas publicadas.</p>}{notice && <p className="border-t border-neutral-200 px-5 py-3 text-sm text-red-700">{notice}</p>}</section>;
}