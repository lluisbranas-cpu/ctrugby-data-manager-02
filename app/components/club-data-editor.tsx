"use client";

import { DeleteButton } from "@/app/components/delete-button";
import Link from "@/app/components/sport-link";
import { useRef, useState } from "react";
import type { ClubPalette } from "@/app/lib/club-palette";
import { clubShieldUrl } from "@/app/lib/club-shields";

export type EditableClub = {
  id: string;
  name: string;
  active: boolean;
  founded_text: string | null; disappeared_text?: string | null;
  city: string;
  province: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  maps_url: string;
  website: string | null;
  instagram: string | null;
};

export function ClubDataEditor({
  club,
  admin,
  palette,
  onPaletteChange,
  onSaved,
  onShieldUpdated,
}: {
  club: EditableClub;
  admin: boolean;
  palette: ClubPalette;
  onPaletteChange: (index: number, color: string) => Promise<void>;
  onSaved: (club: EditableClub) => void;
  onShieldUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EditableClub>(club);
  const [saving, setSaving] = useState(false);
  const [uploadingShield, setUploadingShield] = useState(false);
  const [removeShieldBackground, setRemoveShieldBackground] = useState(true);
  const [shieldDeleted, setShieldDeleted] = useState(false);
  const [shieldVersion, setShieldVersion] = useState(0);
  const [error, setError] = useState("");
  const shieldInput = useRef<HTMLInputElement>(null);
  const shieldSrc = shieldDeleted ? null : clubShieldUrl(club.id, shieldVersion);

  const change = (key: keyof EditableClub, value: string | boolean) => setDraft((current) => ({ ...current, [key]: value }));

  const uploadShield = async (file: File) => {
    if (!admin) return;
    setUploadingShield(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("removeBackground", removeShieldBackground ? "1" : "0");
      const response = await fetch(`/api/clubs/escudo/${club.id}`, { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido guardar el escudo.");
      setShieldDeleted(false);
      setShieldVersion(Date.now());
      onShieldUpdated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido guardar el escudo.");
    } finally {
      setUploadingShield(false);
    }
  };

  const deleteShield = async () => {
    if (!admin) return;
    setUploadingShield(true);
    setError("");
    try {
      const response = await fetch(`/api/clubs/escudo/${club.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido borrar el escudo.");
      setShieldDeleted(true);
      setShieldVersion(Date.now());
      onShieldUpdated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se ha podido borrar el escudo.");
    } finally {
      setUploadingShield(false);
    }
  };

  const save = async () => {
    if (!admin) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/clubs/${club.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = await response.json() as { club?: EditableClub; error?: string };
      if (!response.ok || !result.club) throw new Error(result.error ?? "No se han podido guardar los datos.");
      onSaved(result.club);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se han podido guardar los datos.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <button type="button" className="club-data-edit" onClick={() => { setDraft(club); setError(""); setOpen(true); }}>Editar datos</button>
    {open && <div className="club-editor-backdrop" role="presentation" onMouseDown={() => !saving && !uploadingShield && setOpen(false)}>
      <section className="club-editor-modal" role="dialog" aria-modal="true" aria-labelledby="club-editor-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><p>CLUB</p><h2 id="club-editor-title">Editar datos</h2></div>
          <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)} disabled={saving || uploadingShield}>×</button>
        </header>
        <fieldset className="club-editor-fields" disabled={!admin}>
          <div className="club-editor-palette">
            <span>Colores de las franjas</span>
            <div className="club-color-buttons" role="group" aria-label="Colores de las franjas de la portada">
              {palette.map((color, index) => <input key={index} type="color" value={color} aria-label={`Color ${index + 1}`} onChange={(event) => void onPaletteChange(index, event.target.value)} />)}
            </div>
          </div>
          <div className="club-editor-shield-card">
            <div className="club-editor-shield-preview" aria-hidden="true">
              {shieldSrc ? <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shieldSrc} alt="" />
              </> : <span>{club.id.slice(-2)}</span>}
            </div>
            <div>
              <span>Escudo del club</span>
              <small>{removeShieldBackground ? "PNG cuadrado 300 × 300, fondo transparente" : "PNG cuadrado 300 × 300, conserva el fondo"}</small>
              <label className="club-editor-shield-option">
                <input type="checkbox" checked={removeShieldBackground} onChange={(event) => setRemoveShieldBackground(event.target.checked)} />
                Quitar fondo
              </label>
            </div>
            <input ref={shieldInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingShield} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadShield(file); }} />
            <button type="button" className="club-editor-camera" aria-label={uploadingShield ? "Guardando escudo" : "Cambiar escudo"} title={uploadingShield ? "Guardando escudo..." : "Cambiar escudo"} disabled={uploadingShield} onClick={() => shieldInput.current?.click()}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.4 4.5 9.7 3h4.6l1.3 1.5H19A3 3 0 0 1 22 7.5v9A3 3 0 0 1 19 19.5H5a3 3 0 0 1-3-3v-9A3 3 0 0 1 5 4.5h3.4ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 1.7a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Z" /></svg>
            </button>
            <DeleteButton type="button" className="club-editor-shield-delete" aria-label="Borrar escudo" title="Borrar escudo" disabled={uploadingShield} onClick={() => void deleteShield()} />
          </div>
          <label>Nombre<input value={draft.name} onChange={(event) => change("name", event.target.value)} /></label>
          <label>Ciudad<input value={draft.city} onChange={(event) => change("city", event.target.value)} /></label>
          <label>Provincia<input value={draft.province} onChange={(event) => change("province", event.target.value)} /></label>
          <label>Comunidad autónoma<input value={draft.region} onChange={(event) => change("region", event.target.value)} /></label>
          <label>País<input value={draft.country} onChange={(event) => change("country", event.target.value)} /></label>
          <label>Fundación<input value={draft.founded_text ?? ""} onChange={(event) => change("founded_text", event.target.value)} /></label>
          <label>Año de desaparición<input placeholder="Sin confirmar" inputMode="numeric" maxLength={4} value={draft.disappeared_text ?? ""} onChange={(event) => change("disappeared_text", event.target.value)} /></label>
          <label>Web<input type="url" value={draft.website ?? ""} onChange={(event) => change("website", event.target.value)} /></label>
          <label>Instagram<input value={draft.instagram ?? ""} onChange={(event) => change("instagram", event.target.value)} /></label>
          <label>Latitud<input type="number" step="any" value={draft.latitude} onChange={(event) => change("latitude", event.target.value)} /></label>
          <label>Longitud<input type="number" step="any" value={draft.longitude} onChange={(event) => change("longitude", event.target.value)} /></label>
          <label className="club-editor-wide">Enlace de Google Maps<input type="url" value={draft.maps_url} onChange={(event) => change("maps_url", event.target.value)} /></label>
          <label className="club-editor-check"><input type="checkbox" checked={draft.active} onChange={(event) => change("active", event.target.checked)} /> Club activo</label>
        </fieldset>
        {!admin && <p className="club-editor-access">Inicia sesión como administrador en <Link href="/catalogos">Catálogos</Link> para modificar y guardar estos datos.</p>}
        {error && <p className="club-editor-error">{error}</p>}
        <footer>
          <button type="button" onClick={() => setOpen(false)} disabled={saving || uploadingShield}>Cancelar</button>
          {admin && <button type="button" className="club-editor-save" onClick={() => void save()} disabled={saving || uploadingShield}>{saving ? "Guardando..." : "Guardar datos"}</button>}
        </footer>
      </section>
    </div>}
  </>;
}
