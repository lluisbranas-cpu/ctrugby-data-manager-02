"use client";

import { Camera, Pencil, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Association = { code: string; id: string; name: string; acronym: string; territory: string; summary: string; members: string[] };

export function RegionalAssociationsTable() {
  const [rows, setRows] = useState<Association[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [codeDraft, setCodeDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    void fetch("/api/confederaciones-regionales", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok || !data.admin) throw new Error(data.error ?? "Acceso de administrador requerido.");
      const associations = data.associations as Association[];
      setRows(associations);
      setPreviews(Object.fromEntries(associations.map((association) => [association.code, localStorage.getItem(`ctrugby-regional-shield-${association.code}`) ?? ""])));
      setAdmin(true);
    }).catch((error: Error) => { setRows([]); setNotice(error.message); });
  }, []);

  const update = (index: number, field: keyof Association, value: string) => setRows((current) => current?.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row) ?? null);
  function preview(code: string, file?: File) {
    if (!file || !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setNotice("Selecciona una imagen de hasta 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { const image = String(reader.result ?? ""); localStorage.setItem(`ctrugby-regional-shield-${code}`, image); setPreviews((current) => ({ ...current, [code]: image })); setNotice("Escudo guardado localmente hasta su traslado a la base de datos general."); };
    reader.readAsDataURL(file);
  }
  async function save() {
    if (!rows || editing === null) return;
    const nextRows = rows.map((row, index) => index === editing ? { ...row, code: codeDraft } : row);
    setBusy(true); setNotice("");
    try { const response = await fetch("/api/confederaciones-regionales", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextRows) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setRows(data.associations); setEditing(null); setNotice("Fila guardada localmente."); } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar."); } finally { setBusy(false); }
  }
  if (!rows) return <p className="p-6 text-neutral-500">Comprobando acceso…</p>;
  if (!admin) return <p className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">La tabla de Confederaciones Regionales solo está disponible en modo administrador.</p>;

  return <section className="overflow-hidden rounded-2xl bg-white shadow-sm" aria-label="Tabla de confederaciones regionales">
    <header className="border-b border-neutral-200 px-5 py-4 sm:px-6"><b className="text-sm font-black tracking-[.12em] text-neutral-700">TABLA DE CONFEDERACIONES REGIONALES</b>{notice && <small className="ml-4 text-sm text-neutral-600">{notice}</small>}</header>
    <div className="grid grid-cols-[68px_82px_minmax(0,1fr)_minmax(140px,.5fr)_72px] gap-3 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500 sm:px-6"><span>ESCUDO</span><span>ID</span><span>CONFEDERACIÓN</span><span>TERRITORIO</span><span>ACCIONES</span></div>
    <ul className="divide-y divide-neutral-200">{rows.map((row, index) => {
      const isEditing = editing === index;
      return <li key={`${row.code}-${index}`} className="grid grid-cols-[68px_82px_minmax(0,1fr)_minmax(140px,.5fr)_72px] items-center gap-3 px-5 py-3 sm:px-6">
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100"><img src={previews[row.code] || `/api/confederaciones-regionales/escudo/${row.code}`} alt={`Escudo de ${row.name}`} className="h-10 w-10 rounded-full object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /><input ref={(element) => { inputs.current[row.code] = element; }} type="file" accept="image/*" className="hidden" onChange={(event) => preview(row.code, event.target.files?.[0])} /><button type="button" disabled={busy} onClick={() => inputs.current[row.code]?.click()} className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-700 text-white" aria-label={`Previsualizar escudo de ${row.name}`}><Camera size={13} /></button></span>
        {isEditing ? <input value={codeDraft} onChange={(event) => setCodeDraft(event.target.value.toUpperCase())} onBlur={() => void save()} className="font-mono rounded border border-neutral-300 px-2 py-1 text-xs" /> : <span className="font-mono text-xs font-bold text-neutral-500">{row.code}</span>}
        {isEditing ? <input value={row.name} onChange={(event) => update(index, "name", event.target.value)} className="min-w-0 rounded border border-neutral-300 px-2 py-1 text-sm" /> : <span className="min-w-0"><b className="block truncate text-sm">{row.name}</b><small>{row.acronym}</small></span>}
        {isEditing ? <input value={row.territory} onChange={(event) => update(index, "territory", event.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" /> : <span className="truncate text-sm text-neutral-600">{row.territory}</span>}
        {isEditing ? <button type="button" disabled={busy} onClick={() => void save()} className="rounded border border-red-200 p-2 text-red-700"><Save size={14} /></button> : <button type="button" onClick={() => { setEditing(index); setCodeDraft(row.code); }} className="rounded border border-neutral-300 p-2"><Pencil size={14} /></button>}
      </li>;
    })}</ul>
  </section>;
}
