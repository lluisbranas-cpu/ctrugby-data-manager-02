"use client";

import { DeleteButton } from "@/app/components/delete-button";
import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { ImageUploadEditor } from "@/app/components/image-upload-editor";
import { PlayerCoverEditor, type PlayerCoverSettings } from "@/app/components/player-cover-editor";

type Kind = "avatar" | "cover" | "shield";

export function StaffMediaActions({ id, name, onUpdated, avatar = true, cover = true, shield = false }: { id: string; name: string; onUpdated: () => void; avatar?: boolean; cover?: boolean; shield?: boolean }) {
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const shieldInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Kind | "">("");
  const [notice, setNotice] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [pendingShield, setPendingShield] = useState<File | null>(null);

  const uploadAvatar = async (file: File, prepared: Blob) => {
    setBusy("avatar"); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("prepared", prepared, "avatar.png");
      const response = await fetch(`/api/staff/foto/${id}`, { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la foto.");
      setPendingAvatar(null);
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la foto.");
      throw error;
    } finally {
      setBusy("");
    }
  };

  const uploadCover = async (file: File, prepared: Blob, settings: PlayerCoverSettings) => {
    setBusy("cover"); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("prepared", prepared, "cover.png");
      form.set("settings", JSON.stringify(settings));
      const response = await fetch(`/api/staff/portada/${id}`, { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la portada.");
      setPendingCover(null);
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la portada.");
      throw error;
    } finally {
      setBusy("");
    }
  };

  const uploadShield = async (file: File, prepared: Blob) => {
    setBusy("shield"); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("prepared", prepared, "shield.png");
      const response = await fetch(`/api/staff/escudo/${id}`, { method: "POST", body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar el escudo.");
      setPendingShield(null);
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar el escudo.");
      throw error;
    } finally {
      setBusy("");
    }
  };

  const remove = async (kind: Kind) => {
    setBusy(kind); setNotice("");
    try {
      const endpoint = kind === "avatar" ? `/api/staff/foto/${id}` : kind === "cover" ? `/api/staff/portada/${id}` : `/api/staff/escudo/${id}`;
      const response = await fetch(endpoint, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido eliminar la imagen.");
      onUpdated();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la imagen.");
    } finally {
      setBusy("");
    }
  };

  return <div className="player-cover-actions staff-media-actions">
    <input ref={avatarInput} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) setPendingAvatar(file); }} />
    <input ref={coverInput} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) setPendingCover(file); }} />
    <input ref={shieldInput} className="sr-only" tabIndex={-1} aria-hidden="true" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(busy)} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) setPendingShield(file); }} />
    {avatar && <button type="button" aria-label="Cambiar foto redonda de staff" title="Cambiar foto redonda" disabled={Boolean(busy)} onClick={() => avatarInput.current?.click()}><Camera size={17} aria-hidden="true" /><span className="sr-only">Foto</span></button>}
    {cover && <button type="button" aria-label="Cambiar foto de portada de staff" title="Cambiar portada" disabled={Boolean(busy)} onClick={() => coverInput.current?.click()}><Camera size={17} aria-hidden="true" /><span className="sr-only">Portada</span></button>}
    {shield && <button type="button" aria-label="Cambiar escudo asociado de staff" title="Cambiar escudo asociado" disabled={Boolean(busy)} onClick={() => shieldInput.current?.click()}><Camera size={17} aria-hidden="true" /><span className="sr-only">Escudo</span></button>}
    {avatar && <DeleteButton type="button" className="player-cover-delete" aria-label="Eliminar foto redonda de staff" title="Eliminar foto redonda" disabled={Boolean(busy)} onClick={() => void remove("avatar")} />}
    {cover && <DeleteButton type="button" className="player-cover-delete" aria-label="Eliminar portada de staff" title="Eliminar portada" disabled={Boolean(busy)} onClick={() => void remove("cover")} />}
    {shield && <DeleteButton type="button" className="player-cover-delete" aria-label="Eliminar escudo asociado de staff" title="Eliminar escudo asociado" disabled={Boolean(busy)} onClick={() => void remove("shield")} />}
    {notice && <p role="status">{notice}</p>}
    {pendingAvatar && <ImageUploadEditor file={pendingAvatar} title={`Foto redonda de ${name}`} outputWidth={600} outputHeight={600} initialFit="cover" allowRemoveBackground outputBackground="#e2e7ea" circularFrame onChooseFile={() => avatarInput.current?.click()} onClose={() => setPendingAvatar(null)} onSave={(prepared) => uploadAvatar(pendingAvatar, prepared)} />}
    {pendingCover && <PlayerCoverEditor file={pendingCover} name={name} onChooseFile={() => coverInput.current?.click()} onClose={() => setPendingCover(null)} onSave={(prepared, settings) => uploadCover(pendingCover, prepared, settings)} />}
    {pendingShield && <ImageUploadEditor file={pendingShield} title={`Escudo asociado de ${name}`} outputWidth={600} outputHeight={600} initialFit="contain" onChooseFile={() => shieldInput.current?.click()} onClose={() => setPendingShield(null)} onSave={(prepared) => uploadShield(pendingShield, prepared)} />}
  </div>;
}
