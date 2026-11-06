"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { Check, Pencil, Save, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";

type Federation = { id: string; name: string; scope: "Nacional" | "Territorial" | string | null; territory: string | null; country: string | null; active?: boolean | null; website?: string | null };
type State = { configured: boolean; admin: boolean; canWrite: boolean; federations: Federation[] };
type Draft = { id: string; name: string; scope: "Nacional" | "Territorial"; territory: string; country: string; active: boolean; website: string };
type SelectionSortKey = "id" | "name" | "scope" | "territory" | "country" | "website" | "active";
type SortState<T extends string> = { key: T; direction: 1 | -1 };

const emptyDraft: Draft = { id: "", name: "", scope: "Nacional", territory: "", country: "", active: true, website: "" };
const inputClass = "rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500 disabled:bg-neutral-50 disabled:text-neutral-500";
const countryCodes: Record<string, string> = {
  andorra: "AND",
  argentina: "ARG",
  australia: "AUS",
  belgica: "BEL",
  "bélgica": "BEL",
  canada: "CAN",
  "canadá": "CAN",
  chile: "CHI",
  escocia: "SCO",
  espana: "ESP",
  "españa": "ESP",
  "estados unidos": "USA",
  france: "FRA",
  francia: "FRA",
  gales: "WAL",
  georgia: "GEO",
  irlanda: "IRL",
  italia: "ITA",
  japon: "JPN",
  "japón": "JPN",
  "nueva zelanda": "NZL",
  "paises bajos": "NED",
  "países bajos": "NED",
  polonia: "POL",
  portugal: "POR",
  rumania: "ROU",
  "rumanía": "ROU",
  samoa: "SAM",
  singapore: "SGP",
  sudafrica: "RSA",
  "sudáfrica": "RSA",
  suiza: "SUI",
  tonga: "TGA",
  uruguay: "URU",
};

function countryCode(country: string) {
  const normalized = country.trim().toLocaleLowerCase("es-ES");
  return countryCodes[normalized] ?? country.trim().slice(0, 3).toUpperCase();
}

function draftFromFederation(federation: Federation): Draft {
  return { id: federation.id, name: federation.name, scope: federation.scope === "Territorial" ? "Territorial" : "Nacional", territory: federation.territory ?? "", country: federation.country ?? "", active: federation.active !== false, website: federation.website ?? "" };
}

export default function SelectionTablePage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rowDrafts, setRowDrafts] = useState<Record<string, Draft>>({});
  const [selectionSort, setSelectionSort] = useState<SortState<SelectionSortKey>>({ key: "id", direction: 1 });

  const loadData = (clearNotice = true) => {
    if (clearNotice) setNotice("");
    return fetch("/api/hitos/convocatorias", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then(setState)
      .catch((error) => setNotice(error instanceof Error ? error.message : "No se han podido cargar las selecciones."));
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hitos/convocatorias", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then((data) => { if (!controller.signal.aborted) setState(data); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se han podido cargar las selecciones."); });
    return () => controller.abort();
  }, []);

  const federations = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    const rows = (state?.federations ?? [])
      .filter((federation) => !text || [federation.id, federation.name, federation.scope ?? "", federation.territory ?? "", federation.country ?? "", federation.website ?? ""].join(" ").toLocaleLowerCase("es-ES").includes(text));
    const value = (federation: Federation) => selectionSort.key === "id"
      ? federation.id
      : selectionSort.key === "name"
        ? federation.name
        : selectionSort.key === "scope"
          ? federation.scope ?? ""
          : selectionSort.key === "territory"
            ? federation.territory ?? ""
            : selectionSort.key === "country"
              ? federation.country ?? ""
              : selectionSort.key === "website"
                ? federation.website ?? ""
                : federation.active === false ? "0" : "1";
    return [...rows].sort((a, b) => {
      const result = value(a).localeCompare(value(b), "es", { numeric: true }) * selectionSort.direction;
      return result || a.id.localeCompare(b.id, "es", { numeric: true });
    });
  }, [query, selectionSort, state?.federations]);
  const sortMark = (key: SelectionSortKey) => selectionSort.key !== key ? "↕" : selectionSort.direction === 1 ? "↑" : "↓";
  const nextSort = (key: SelectionSortKey) => setSelectionSort((current) => current.key === key && current.direction === 1 ? { key, direction: -1 } : { key, direction: 1 });

  const updateDraft = (field: keyof Draft, value: string | boolean) => setDraft((current) => ({ ...current, [field]: value }));
  const updateRowDraft = (id: string, field: keyof Draft, value: string | boolean) => setRowDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
  const startEdit = (federation: Federation) => { setEditingId(federation.id); setRowDrafts((current) => ({ ...current, [federation.id]: draftFromFederation(federation) })); setNotice(""); };
  const cancelEdit = () => setEditingId(null);

  async function saveFederation(payload: Draft, originalId?: string) {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/hitos/convocatorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert-federation", original_id: originalId, ...payload }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(originalId ? "Selección actualizada." : "Selección añadida.");
      setDraft(emptyDraft);
      setEditingId(null);
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la selección.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveFederation(draft);
  }

  async function deleteFederation(federation: Federation) {
    if (!window.confirm(`¿Eliminar ${federation.name}? No se podrá borrar si tiene convocatorias asociadas.`)) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/hitos/convocatorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-federation", id: federation.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Selección eliminada.");
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la selección.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="selectionTable" /></header>
    <section className="directory-cover participations-cover">
      <span className="directory-cover-world-rugby" aria-hidden="true"><svg className="h-full w-full text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 18V9l7-5 7 5v9M8 18v-6M12 18v-6M16 18v-6" /></svg></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker" />ADMIN</p><h1>SELECCIONES</h1><span>Tabla maestra para el desplegable de convocatorias</span></div>
      <div className="directory-cover-actions !gap-1">{state?.canWrite && <a href="#selection-table-editor">+Añadir selecciones</a>}</div>
    </section>
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-4 sm:px-8">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando selecciones...</p>}
      {state && <>
        {!state.canWrite && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Tabla de selecciones</h2><span>Inicia sesión como administrador para añadir, editar o eliminar selecciones.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
        {state.canWrite && <form id="selection-table-editor" onSubmit={submit} className="selection-table-editor grid gap-2 rounded-2xl bg-white p-4 shadow-sm lg:grid-cols-[68px_minmax(180px,1.2fr)_76px_minmax(112px,.7fr)_68px_minmax(135px,1fr)_50px_auto] sm:p-5">
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">ID<input value={draft.id} onChange={(event) => updateDraft("id", event.target.value.toUpperCase())} maxLength={5} placeholder="Auto" className={inputClass} /></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Nombre<input required value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="Federación..." className={inputClass} /></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Ámbito<select value={draft.scope} onChange={(event) => updateDraft("scope", event.target.value as Draft["scope"])} className={inputClass}><option value="Nacional">Nac.</option><option value="Territorial">Terr.</option></select></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Territorio<input required value={draft.territory} onChange={(event) => updateDraft("territory", event.target.value)} placeholder="España" className={inputClass} /></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">País<input required value={draft.country} onChange={(event) => updateDraft("country", event.target.value)} placeholder="ESP" className={inputClass} /></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Web<input value={draft.website} onChange={(event) => updateDraft("website", event.target.value)} placeholder="https://..." className={inputClass} /></label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Activa<select value={draft.active ? "true" : "false"} onChange={(event) => updateDraft("active", event.target.value === "true")} className={`${inputClass} ${draft.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}><option value="true">✓</option><option value="false">X</option></select></label>
          <div className="flex items-end"><button disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-red-600 text-white disabled:opacity-60" aria-label="Añadir selección" title="Añadir selección">{busy ? <span className="text-xs font-black">...</span> : <Save size={17} aria-hidden="true" />}</button></div>
        </form>}
        <section className={`selection-callups-table mt-4 rounded-2xl bg-white shadow-sm ${state.canWrite ? "selection-table-with-editor" : ""}`}>
          <div className="selection-table-sticky-head">
            <header className="federation-directory-title selection-table-title"><div><b>TABLA DE SELECCIONES</b><small>{federations.length} de {state.federations.length} selección{state.federations.length === 1 ? "" : "es"} disponible{state.federations.length === 1 ? "" : "s"}.</small></div><label className="directory-search max-w-sm"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar selección..." aria-label="Buscar selección" /></label></header>
            <div className="selection-table-head grid min-w-[820px] grid-cols-[58px_76px_minmax(230px,1.35fr)_80px_140px_58px_minmax(170px,1fr)_50px_80px] gap-[3px] border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><span>ESC.</span><button type="button" onClick={() => nextSort("id")}>ID {sortMark("id")}</button><button type="button" onClick={() => nextSort("name")}>NOMBRE {sortMark("name")}</button><button type="button" onClick={() => nextSort("scope")}>ÁMBITO {sortMark("scope")}</button><button type="button" onClick={() => nextSort("territory")}>TERRITORIO {sortMark("territory")}</button><button type="button" onClick={() => nextSort("country")}>PAÍS {sortMark("country")}</button><button type="button" onClick={() => nextSort("website")}>WEB {sortMark("website")}</button><button type="button" onClick={() => nextSort("active")}>ACT. {sortMark("active")}</button><span></span></div>
          </div>
          <div className="overflow-x-auto">
            <ul className="min-w-[820px] divide-y divide-neutral-200">{federations.map((federation) => {
              const isEditing = editingId === federation.id;
              const rowDraft = rowDrafts[federation.id] ?? draftFromFederation(federation);
              return <li key={federation.id} className="grid grid-cols-[58px_76px_minmax(230px,1.35fr)_80px_140px_58px_minmax(170px,1fr)_50px_80px] items-center gap-[3px] px-3 py-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100">{federationShieldUrl(federation.id) ? <img src={federationShieldUrl(federation.id)!} alt={`Escudo de ${federation.name}`} className="h-9 w-9 object-contain" /> : <b className="text-xs">{federation.id.slice(0, 2)}</b>}</span>
                <input disabled value={rowDraft.id} className={inputClass} />
                <input disabled={!isEditing} value={rowDraft.name} onChange={(event) => updateRowDraft(federation.id, "name", event.target.value)} className={inputClass} />
                <select disabled={!isEditing} value={rowDraft.scope} onChange={(event) => updateRowDraft(federation.id, "scope", event.target.value as Draft["scope"])} className={inputClass}><option value="Nacional">Nac.</option><option value="Territorial">Terr.</option></select>
                <input disabled={!isEditing} value={rowDraft.territory} onChange={(event) => updateRowDraft(federation.id, "territory", event.target.value)} className={inputClass} />
                <input disabled={!isEditing} value={isEditing ? rowDraft.country : countryCode(rowDraft.country)} onChange={(event) => updateRowDraft(federation.id, "country", event.target.value)} className={inputClass} />
                <input disabled={!isEditing} value={rowDraft.website} onChange={(event) => updateRowDraft(federation.id, "website", event.target.value)} className={inputClass} />
                {isEditing ? <select value={rowDraft.active ? "true" : "false"} onChange={(event) => updateRowDraft(federation.id, "active", event.target.value === "true")} className={inputClass}><option value="true">Si</option><option value="false">No</option></select> : <span className={`flex h-10 items-center justify-center rounded-[8px] border ${rowDraft.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`} aria-label={rowDraft.active ? "Activa" : "Inactiva"} title={rowDraft.active ? "Activa" : "Inactiva"}>{rowDraft.active ? <Check size={17} strokeWidth={2.4} aria-hidden="true" /> : <X size={17} strokeWidth={2.4} aria-hidden="true" />}</span>}
                <span className="flex justify-end gap-[3px]">{isEditing ? <><button type="button" disabled={busy} onClick={() => void saveFederation(rowDraft, federation.id)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Guardar ${federation.name}`} title="Guardar"><Save size={15} aria-hidden="true" /></button><button type="button" disabled={busy} onClick={cancelEdit} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50" aria-label="Cancelar edición" title="Cancelar"><X size={15} aria-hidden="true" /></button></> : <><button type="button" disabled={busy || !state.canWrite} onClick={() => startEdit(federation)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50" aria-label={`Editar ${federation.name}`} title="Editar"><Pencil size={15} aria-hidden="true" /></button><DeleteButton type="button" disabled={busy || !state.canWrite} onClick={() => void deleteFederation(federation)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Eliminar ${federation.name}`} title="Eliminar" confirmationHandled /></>}</span>
              </li>;
            })}</ul>
          </div>
          {!federations.length && <p className="p-8 text-center text-sm text-neutral-500">No hay selecciones con este filtro.</p>}
        </section>
      </>}
    </div>
  </main>;
}
