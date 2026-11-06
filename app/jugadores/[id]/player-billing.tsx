"use client";
import { normalizePhone, formatSpanishPhone } from "@/lib/phone-number";
import { useState, type FormEvent } from "react";
import { LockKeyhole, Pencil, Save, X } from "lucide-react";
import { PrivateDataTable } from "./private-data-table";
import type { PlayerBilling } from "@/lib/player-billing";
const fields = [["full_name", "Nombre y apellidos"], ["address", "Dirección"], ["postal_code", "Código postal"], ["city", "Población"], ["province", "Provincia"]] as const;
const blank: PlayerBilling = { full_name: "", dni: "", address: "", postal_code: "", city: "", province: "" };
type Contacts = { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null };
export function PlayerBillingCard({ playerId, initial, contacts, onContactsSaved }: { playerId: string; initial?: PlayerBilling | null; contacts: Contacts; onContactsSaved: (contacts: Contacts) => void }) {
  const [saved, setSaved] = useState(initial ?? blank);
  const [draft, setDraft] = useState(saved);
  const [email, setEmail] = useState(contacts.tutor1_email ?? "");
  const [phone, setPhone] = useState(formatSpanishPhone(contacts.tutor1_phone_e164));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.dni.trim()) { setMessage("Indica el DNI del titular de facturación."); return; }
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/jugadores/" + playerId, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billing: draft, billingContact: {email: email.trim() || null, phone: normalizePhone(phone)} }) });
      const result = await response.json();
      if (!response.ok || !result.billing) throw new Error(result.error || "No se han podido guardar los datos de facturación.");
      if (result.contacts) onContactsSaved(result.contacts);
      setSaved(result.billing); setEditing(false); setMessage("Datos de facturación guardados.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setSaving(false); }
  }
  return <section className="club-record-card player-profile-private-access player-profile-private-wide player-billing"><div className="flex items-center justify-between gap-3"><h3><LockKeyhole size={12} className="mr-1 inline-block" aria-hidden="true" />DATOS DE FACTURACIÓN</h3>{!editing && <button type="button" className="player-profile-participation-button" aria-label="Editar datos de facturación" onClick={() => { setDraft({ ...blank, ...saved, full_name: contacts.tutor1_name ?? saved.full_name ?? "" }); setEmail(contacts.tutor1_email ?? ""); setPhone(formatSpanishPhone(contacts.tutor1_phone_e164)); setMessage(""); setEditing(true); }}><Pencil size={15} aria-hidden="true" /></button>}</div>
    {editing ? <form onSubmit={save} className="player-profile-private-grid mt-3">{fields.slice(0, 1).map(([field, label]) => <label key={field}>{label}<input value={draft[field]} maxLength={160} autoComplete="name" onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}<label>DNI *<input required value={draft.dni ?? ""} maxLength={20} autoComplete="off" onChange={event => setDraft(current => ({ ...current, dni: event.target.value.toUpperCase() }))} /></label><label>Mail<input type="email" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Teléfono<input type="tel" onBlur={() => setPhone(formatSpanishPhone(phone))} value={phone} onChange={event => setPhone(event.target.value)} placeholder="+34 XXX XXX XXX" /></label>{fields.slice(1).map(([field, label]) => <label key={field}>{label}<input value={draft[field]} maxLength={field === "address" ? 300 : 160} autoComplete={field === "full_name" ? "name" : field === "address" ? "street-address" : field === "postal_code" ? "postal-code" : field === "city" ? "address-level2" : "address-level1"} onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))} /></label>)}<div className="player-profile-private-actions"><button type="submit" aria-label="Guardar datos de facturación" title="Guardar datos de facturación" className="player-profile-participation-button" disabled={saving}>{saving ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={saving} onClick={() => { setEditing(false); setMessage(""); }}><X size={16} aria-hidden="true" /></button></div></form> : <div className="player-billing-tables"><PrivateDataTable fields={[{ label: "Nombre y apellidos", value: contacts.tutor1_name ?? saved.full_name, width: "30%" }, { label: "DNI", value: saved.dni, width: "15%" }, { label: "Mail", value: contacts.tutor1_email, width: "35%" }, { label: "Teléfono", value: formatSpanishPhone(contacts.tutor1_phone_e164), width: "20%" }]} /><PrivateDataTable fields={[{ label: "Dirección", value: saved.address, width: "40%" }, { label: "Código postal", value: saved.postal_code, width: "12%" }, { label: "Población", value: saved.city, width: "24%" }, { label: "Provincia", value: saved.province, width: "24%" }]} /></div>}
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
