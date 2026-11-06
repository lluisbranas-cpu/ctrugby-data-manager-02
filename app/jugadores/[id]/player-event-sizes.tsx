"use client";
import { Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { PrivateDataTable } from "./private-data-table";
import type { PlayerEventSizes } from "@/lib/player-event-sizes";

const blank: PlayerEventSizes = { technical_shirt: "", playing_shirt: "", playing_shorts: "", bermudas: "" };
const fields: [keyof PlayerEventSizes, string][] = [["playing_shirt", "Talla camiseta"], ["playing_shorts", "Talla pantalón"]];

export function PlayerEventSizesCard({ playerId, initial, canEdit = true }: { playerId: string; initial?: PlayerEventSizes | null; canEdit?: boolean }) {
  const [saved, setSaved] = useState({ ...blank, ...initial });
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/jugadores/${playerId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventSizes: draft }) });
      const result = await response.json() as { event_sizes?: PlayerEventSizes; error?: string };
      if (!response.ok || !result.event_sizes) throw new Error(result.error || "No se han podido guardar las tallas.");
      setSaved(result.event_sizes); setEditing(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se han podido guardar las tallas."); }
    finally { setSaving(false); }
  }
  return <section className="club-record-card player-profile-private-access player-profile-private-wide player-event-sizes"><div className="flex items-center justify-between gap-3"><div><h3>TALLAS</h3><p>Estos datos se deberán actualizar en cada evento.</p></div>{canEdit && !editing && <button type="button" className="player-profile-participation-button" aria-label="Editar tallas" title="Editar tallas" onClick={() => { setDraft(saved); setEditing(true); }}><Pencil size={15} aria-hidden="true" /></button>}</div>{editing ? <div className="player-profile-private-grid mt-3">{fields.map(([field, label]) => <label key={field}>{label}<input value={draft[field]} maxLength={30} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value.toUpperCase() }))} /></label>)}<div className="player-profile-private-actions"><button type="button" className="player-profile-participation-button" aria-label="Guardar tallas" title="Guardar tallas" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={saving} onClick={() => { setDraft(saved); setEditing(false); }}><X size={16} aria-hidden="true" /></button></div></div> : <PrivateDataTable fields={fields.map(([field, label]) => ({ label, value: saved[field], width: "50%" }))} />}{message && <p role="status">{message}</p>}</section>;
}
