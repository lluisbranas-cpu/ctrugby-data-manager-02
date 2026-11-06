"use client";
import { useState } from "react";
import { Check, X } from "lucide-react";
export function HitoPublicationButton({id, initialPublished, onChanged}: {id: string; initialPublished: boolean; onChanged: () => void}) {
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/hitos/convocatorias", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "set-publication", id, published: !published})});
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setPublished(result.published); onChanged();
    } catch (reason) {setError(reason instanceof Error ? reason.message : "No se ha podido guardar el estado.");}
    finally {setBusy(false);}
  }
  return <div><button type="button" onClick={() => void toggle()} disabled={busy} aria-pressed={published} aria-label={published ? "Publicado. Bloquear hito" : "Bloqueado. Publicar hito"} title={published ? "Publicado · pulsar para bloquear" : "Bloqueado · pulsar para publicar"} className={"flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-50 " + (published ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600")}>{published ? <Check size={19} strokeWidth={3} /> : <X size={19} strokeWidth={3} />}</button>{error && <p role="alert" className="max-w-40 text-xs text-red-700">{error}</p>}</div>;
}
