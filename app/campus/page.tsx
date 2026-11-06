"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { Camera, Save } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type Campus = { id: string; type: "COMP" | "FORM" | "CAMP"; label: string; siglas?: string | null; country: string | null; notes: string | null; updated_at: string; shield_version?: number | null };
type CampusEdition = { campus_id: string; campus: string; year: string; price_eur: number };
type State = { configured: boolean; admin: boolean; canWrite: boolean; categories: Campus[]; campusEditions: CampusEdition[] };

const inputClass = "rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500";
const campusGridClass = "grid min-w-[990px] grid-cols-[86px_minmax(220px,1.2fr)_100px_130px_88px_minmax(180px,1fr)_92px_88px] gap-2";
const campusLogoUrl = (id: string, version?: string | number | null) => `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo${version ? `?v=${encodeURIComponent(String(version))}` : ""}`;

export default function CampusAdminPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCampus, setAddingCampus] = useState(false);
  const [logoVersions, setLogoVersions] = useState<Record<string, number>>({});
  const campuses = useMemo(() => (state?.categories ?? []).filter((category) => category.type === "CAMP").sort((a, b) => a.id.localeCompare(b.id, "es")), [state?.categories]);
  const campusEditions = state?.campusEditions ?? [];

  const loadData = (clearNotice = true) => {
    if (clearNotice) setNotice("");
    return fetch("/api/hitos/profesionales", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then(setState)
      .catch((error) => setNotice(error instanceof Error ? error.message : "No se ha podido cargar la tabla campus."));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCampus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const response = await fetch("/api/hitos/profesionales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert-category", id: form.get("id"), type: "CAMP", label: form.get("label"), siglas: form.get("siglas"), country: form.get("country"), notes: form.get("notes") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Campus guardado.");
      target.reset();
      setAddingCampus(false);
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar el campus.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCampus(id: string) {
    if (!window.confirm("¿Borrar este campus?")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/hitos/profesionales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-category", id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Campus eliminado.");
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar el campus.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(campus: Campus, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("removeBackground", "1");
      const response = await fetch(campusLogoUrl(campus.id), { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setLogoVersions((current) => ({ ...current, [campus.id]: Date.now() }));
      setNotice("Logo de campus guardado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido subir el logo.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="campus" /></header>
    <section className="directory-cover participations-cover">
      <span className="directory-cover-world-rugby" aria-hidden="true"><Camera className="h-full w-full text-red-600" strokeWidth={1.7} /></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker" />ADMIN</p><h1>CAMPUS</h1><span>Tabla maestra de campus CTRugby</span></div>
      <div className="directory-cover-actions"><Link href="/participaciones">Participaciones</Link><Link href="/categorias">Categorías</Link></div>
    </section>
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-4 sm:px-8">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando tabla campus...</p>}
      {state && <>
        {!state.canWrite && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Tabla campus</h2><span>Inicia sesión como administrador para añadir, editar o eliminar campus.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
        {state.canWrite && <section className="campus-directory-table mt-2 overflow-hidden rounded-2xl bg-white shadow-sm">
          <header className="federation-directory-title"><div><b>TABLA CAMPUS</b><small>{campuses.length} campus registrado{campuses.length === 1 ? "" : "s"}.</small></div><button type="button" onClick={() => setAddingCampus((current) => !current)} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-700 hover:border-red-200 hover:text-red-700">{addingCampus ? "Cerrar alta" : "+ Añadir campus"}</button></header>
          {addingCampus && <form onSubmit={saveCampus} className="campus-quick-create border-y border-neutral-200 bg-neutral-50 p-3">
            <label>ID<input name="id" placeholder="CAM002" className={inputClass} /></label>
            <label>Campus<input name="label" required placeholder="CTRugby - Campus..." className={inputClass} /></label>
            <label>Siglas<input name="siglas" placeholder="H2" className={`${inputClass} uppercase`} /></label>
            <label>País<input name="country" placeholder="España" className={inputClass} /></label>
            <label>Tipo<input value="CAMP" readOnly className={`${inputClass} bg-neutral-50`} /></label>
            <label>Notas<input name="notes" placeholder="Notas internas" className={inputClass} /></label>
            <button disabled={busy} className="campus-quick-submit">Guardar</button>
          </form>}
          <div className="overflow-x-auto">
            <div className={`campus-table-head ${campusGridClass} border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500`}><span>ID</span><span>CAMPUS</span><span>SIGLAS</span><span>PAÍS</span><span>TIPO</span><span>NOTAS</span><span>LOGO</span><span>ACCIONES</span></div>
            <ul className="divide-y divide-neutral-200">{campuses.map((campus) => <li key={campus.id}><form onSubmit={saveCampus} className={`campus-table-row ${campusGridClass} items-center px-3 py-2`}>
              <input name="id" readOnly value={campus.id} className={`${inputClass} bg-neutral-50 text-xs`} />
              <input name="label" defaultValue={campus.label} className={inputClass} />
              <input name="siglas" defaultValue={campus.siglas ?? ""} className={`${inputClass} uppercase`} />
              <input name="country" defaultValue={campus.country ?? ""} className={inputClass} />
              <input value="CAMP" readOnly className={`${inputClass} bg-neutral-50`} />
              <input name="notes" defaultValue={campus.notes ?? ""} className={inputClass} />
              <label className="campus-logo-field" title={`Subir logo de ${campus.label}`}><span className="campus-logo-preview"><img src={campusLogoUrl(campus.id, logoVersions[campus.id] ?? campus.shield_version ?? campus.updated_at)} alt={`Logo de ${campus.label}`} /></span><span className="campus-logo-upload" aria-label={`Subir logo de ${campus.label}`}><Camera size={15} aria-hidden="true" /></span><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadLogo(campus, event)} /></label>
              <span className="flex gap-1"><button disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Guardar ${campus.label}`} title={`Guardar ${campus.label}`}><Save size={15} aria-hidden="true" /></button><DeleteButton type="button" disabled={busy} onClick={() => void deleteCampus(campus.id)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Borrar ${campus.label}`} title={`Borrar ${campus.label}`} confirmationHandled /></span>
            </form></li>)}</ul>
          </div>
        </section>}
        {state.canWrite && <section className="campus-directory-table mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <header className="federation-directory-title"><div><b>EDICIONES DE CAMPUS</b><small>Campus, año y precio de las ediciones detectadas.</small></div></header>
          {campusEditions.length === 0 ? <p className="px-4 py-5 text-sm text-neutral-500">Todavía no hay ediciones de campus registradas.</p> : <div className="overflow-x-auto">
            <div className="grid min-w-[560px] grid-cols-[minmax(250px,1fr)_130px_130px] gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><span>CAMPUS</span><span>AÑO</span><span>PRECIO</span></div>
            <ul className="divide-y divide-neutral-200">{campusEditions.map((edition) => <li key={`${edition.campus_id}-${edition.year}`} className="grid min-w-[560px] grid-cols-[minmax(250px,1fr)_130px_130px] items-center gap-2 px-4 py-3 text-sm"><strong className="text-neutral-900">{edition.campus}</strong><span className="font-semibold text-neutral-700">{edition.year}</span><span className="font-black text-red-700">{edition.price_eur.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</span></li>)}</ul>
          </div>}
        </section>}
      </>}
    </div>
  </main>;
}
