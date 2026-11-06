"use client";
/* eslint-disable @next/next/no-img-element */

import { Camera, Landmark, LoaderCircle } from "lucide-react";
import { useRef, useState } from "react";
import { federationShieldUrl } from "@/app/lib/federation-shields";

export function FederationShieldEditor({ id, name, disabled, onBusyChange }: { id: string; name: string; disabled?: boolean; onBusyChange: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(true);

  async function upload(file: File) {
    setBusy(true);
    onBusyChange(true);
    setNotice("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("removeBackground", removeBackground ? "1" : "0");
      const response = await fetch(`/api/federaciones/escudo/${id}`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar el escudo.");
      setVersion(Date.now());
      setFailed(false);
      setNotice("Escudo guardado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido guardar el escudo.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return <div className="flex flex-wrap items-center gap-4 border-b border-neutral-200 pb-4 sm:col-span-2">
    <div className="flex h-24 w-24 shrink-0 items-center justify-center">
      {failed ? <Landmark size={40} className="text-neutral-400" /> : <img src={`${federationShieldUrl(id)}?v=${version}`} alt={`Escudo de ${name}`} className="h-full w-full object-contain" onError={() => setFailed(true)} />}
    </div>
    <div><b className="block text-sm">Escudo</b>
      <label className="mt-2 flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={removeBackground} disabled={disabled || busy} onChange={(event) => setRemoveBackground(event.target.checked)} className="h-4 w-4 accent-red-700" />Eliminar fondo al subir</label>
      <input ref={input} type="file" className="sr-only" aria-label="Seleccionar escudo" accept="image/png,image/jpeg,image/webp" disabled={disabled || busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file); }} />
      <button type="button" disabled={disabled || busy} onClick={() => input.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold disabled:opacity-60" title="Cambiar escudo">
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />}{busy ? "Guardando..." : "Cambiar escudo"}
      </button>
      {notice && <p role="status" className="mt-2 text-sm text-green-700">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  </div>;
}
