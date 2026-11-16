"use client";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useState } from "react";

type Credential = { title: string; issuer?: string | null; date_label?: string | null };

export function StaffCredentialsEditor({ staffId, initialCredentials, admin }: { staffId: string; initialCredentials: Credential[]; admin: boolean }) {
  const [credentials, setCredentials] = useState(initialCredentials);
  const [draft, setDraft] = useState<Credential[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const beginEdit = () => {
    setDraft(credentials.map((credential) => ({ ...credential })));
    setEditing(true);
    setMessage("");
    setError("");
  };
  const updateCredential = (index: number, field: keyof Credential, value: string) => {
    setDraft((current) => current.map((credential, itemIndex) => itemIndex === index ? { ...credential, [field]: value } : credential));
  };
  const save = async () => {
    const cleaned = draft.map((credential) => ({ title: credential.title.trim(), issuer: credential.issuer?.trim() ?? "", date_label: credential.date_label?.trim() ?? "" }));
    if (cleaned.some((credential) => !credential.title)) {
      setError("Cada línea debe incluir la formación o acreditación.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-credentials", id: staffId, credentials: cleaned }),
      });
      const data = await response.json() as { error?: string; credentials?: Credential[] };
      if (!response.ok || !Array.isArray(data.credentials)) throw new Error(data.error ?? "No se han podido guardar las acreditaciones.");
      setCredentials(data.credentials);
      setDraft([]);
      setEditing(false);
      setMessage("Formación y acreditaciones guardadas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se han podido guardar las acreditaciones.");
    } finally {
      setSaving(false);
    }
  };

  if (!credentials.length && !admin) return null;

  return <article className="player-profile-history mt-4 rounded-2xl bg-white shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <h2>Formación y acreditaciones</h2>
      {admin && !editing && <button type="button" className="player-profile-participation-button" onClick={beginEdit} aria-label={credentials.length ? "Editar formación y acreditaciones" : "Añadir formación y acreditaciones"} title={credentials.length ? "Editar" : "Añadir"}>{credentials.length ? <Pencil size={15} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}</button>}
    </div>
    {editing ? <div className="mt-3 grid gap-3">
      {draft.map((credential, index) => <fieldset key={index} className="grid gap-2 rounded-xl border border-neutral-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(120px,0.7fr)_auto]">
        <legend className="sr-only">Acreditación {index + 1}</legend>
        <label className="text-xs font-semibold">Formación o acreditación<input required maxLength={240} className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-normal" value={credential.title} onChange={(event) => updateCredential(index, "title", event.target.value)} /></label>
        <label className="text-xs font-semibold">Entidad emisora<input maxLength={160} className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-normal" value={credential.issuer ?? ""} onChange={(event) => updateCredential(index, "issuer", event.target.value)} /></label>
        <label className="text-xs font-semibold">Fecha<input maxLength={80} className="mt-1 block w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm font-normal" value={credential.date_label ?? ""} onChange={(event) => updateCredential(index, "date_label", event.target.value)} /></label>
        <button type="button" className="staff-role-table-delete self-end" aria-label={`Eliminar línea de formación ${index + 1}`} title="Eliminar línea" disabled={saving} onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} aria-hidden="true" /></button>
      </fieldset>)}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => setDraft((current) => [...current, { title: "", issuer: "", date_label: "" }])}><Plus size={15} aria-hidden="true" /> Añadir línea</button>
        <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : <><Save size={15} aria-hidden="true" /> Guardar</>}</button>
        <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => { setEditing(false); setDraft([]); setError(""); }}><X size={15} aria-hidden="true" /> Cancelar</button>
      </div>
    </div> : credentials.length ? <ul className="mt-3 grid gap-2">{credentials.map((credential, index) => <li key={`${credential.title}-${index}`}><span><strong>{credential.title}</strong><small>{[credential.issuer, credential.date_label].filter(Boolean).join(" · ")}</small></span></li>)}</ul> : <p className="mt-3 text-sm text-neutral-500">Aún no hay formación o acreditaciones registradas.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm text-green-700">{message}</p>}
  </article>;
}
