"use client";

import { DeleteButton } from "@/app/components/delete-button";
import { useRef, useState } from "react";
import { PlayerCoverEditor, type PlayerCoverSettings } from "./player-cover-editor";

export function PlayerCoverActions({ id, name = "", onUpdated }: { id: string; name?: string; onUpdated: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<{ file: File; settings?: PlayerCoverSettings | null } | null>(null);

  const chooseFile = () => {
    setNotice("");
    input.current?.click();
  };

  const upload = async (file: File, prepared: Blob, settings: PlayerCoverSettings) => {
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("prepared", prepared, "cover.png");
      form.set("settings", JSON.stringify(settings));
      const response = await fetch(`/api/jugadores/portada/${id}`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la foto.");
      onUpdated();
      setPending(null);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la foto.");
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/jugadores/portada/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido eliminar la foto.");
      onUpdated();
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la foto.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="player-cover-actions">
    <input ref={input} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = "";
      if (file) setPending({ file });
    }} />
    <button type="button" aria-label={busy ? "Guardando foto de portada" : "Cambiar foto de portada"} title="Cambiar foto de portada" onClick={chooseFile} disabled={busy}>
      <CameraIcon />
      <span className="sr-only">{busy ? "Guardando foto de portada" : "Cambiar foto de portada"}</span>
    </button>
    <DeleteButton type="button" className="player-cover-delete" aria-label="Eliminar foto de portada" title="Eliminar foto de portada" onClick={() => void remove()} disabled={busy} />
    {notice && <p role="status">{notice}</p>}
    {pending && <PlayerCoverEditor file={pending.file} name={name} initialSettings={pending.settings} onChooseFile={() => input.current?.click()} onClose={() => setPending(null)} onSave={(prepared, settings) => upload(pending.file, prepared, settings)} />}
  </div>;
}

function CameraIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 4.5 9.7 3h4.6l1.3 1.5H19A3 3 0 0 1 22 7.5v9A3 3 0 0 1 19 19.5H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h3.4ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z" /></svg>;
}
