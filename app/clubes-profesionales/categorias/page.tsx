"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { ArrowDown, ArrowUp, ArrowUpDown, Camera, Save, X } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type ProfessionalCategory = { id: string; type: "COMP" | "FORM" | "CAMP"; label: string; country: string | null; notes: string | null; updated_at: string; shield_version?: number | null };
type State = { configured: boolean; admin: boolean; canWrite: boolean; categories: ProfessionalCategory[] };
type ShieldPreview = { category: ProfessionalCategory; file: File; removeBackground: boolean; previewUrl: string };
type TypeFilter = "all" | ProfessionalCategory["type"];
type SortColumn = "id" | "type" | "label" | "country" | "notes";

const inputClass = "rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500";
const categoryShieldUrl = (id: string, version?: string | number | null) => `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo${version ? `?v=${encodeURIComponent(String(version))}` : ""}`;

export default function ProfessionalCategoriesPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" } | null>(null);
  const [shieldVersions, setShieldVersions] = useState<Record<string, number>>({});
  const [shieldPreview, setShieldPreview] = useState<ShieldPreview | null>(null);
  const filteredCategories = useMemo(() => {
    const categories = (state?.categories ?? []).filter((category) => typeFilter === "all" || category.type === typeFilter);
    if (!sort) return categories;
    return categories.sort((a, b) => {
      const left = (a[sort.column] ?? "").trim();
      const right = (b[sort.column] ?? "").trim();
      if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id, "es", { numeric: true });
      const comparison = left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
      return comparison * (sort.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id, "es", { numeric: true });
    });
  }, [state?.categories, typeFilter, sort]);

  function sortHeader(column: SortColumn, label: string) {
    const active = sort?.column === column;
    const Icon = active ? sort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
    return <button type="button" onClick={() => setSort((current) => ({ column, direction: current?.column === column && current.direction === "asc" ? "desc" : "asc" }))} className={"flex w-full items-center gap-1 rounded text-left hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500 " + (active ? "text-red-700" : "")} aria-label={"Ordenar por " + label.toLocaleLowerCase("es") + ", " + (active && sort.direction === "asc" ? "descendente" : "ascendente")} title={"Ordenar por " + label.toLocaleLowerCase("es")}>
      {label}<Icon size={12} aria-hidden="true" className="shrink-0" />
      {active && <span className="sr-only">{sort.direction === "asc" ? "Orden ascendente" : "Orden descendente"}</span>}
    </button>;
  }
  const typeCounts = useMemo(() => {
    const categories = state?.categories ?? [];
    return {
      all: categories.length,
      COMP: categories.filter((category) => category.type === "COMP").length,
      FORM: categories.filter((category) => category.type === "FORM").length,
      CAMP: categories.filter((category) => category.type === "CAMP").length,
    };
  }, [state?.categories]);

  const loadData = (clearNotice = true) => {
    if (clearNotice) setNotice("");
    return fetch("/api/hitos/profesionales", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then(setState)
      .catch((error) => setNotice(error instanceof Error ? error.message : "No se han podido cargar las categorías profesionales."));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const response = await fetch("/api/hitos/profesionales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "upsert-category", id: form.get("id"), previous_id: form.get("previous_id"), type: form.get("type"), label: form.get("label"), country: form.get("country"), notes: form.get("notes") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Categoría profesional guardada.");
      target.reset();
      setAddingCategory(false);
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la categoría.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm("¿Borrar esta categoría profesional?")) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/hitos/profesionales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-category", id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Categoría eliminada.");
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la categoría.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareCategoryShieldPreview(category: ProfessionalCategory, file: File, removeBackground: boolean) {
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("removeBackground", removeBackground ? "1" : "0");
      form.set("preview", "1");
      const response = await fetch(categoryShieldUrl(category.id), { method: "POST", body: form });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error ?? "No se ha podido preparar la vista previa.");
      }
      const previewUrl = URL.createObjectURL(await response.blob());
      setShieldPreview((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return { category, file, removeBackground, previewUrl };
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido preparar la vista previa.");
    } finally {
      setBusy(false);
    }
  }

  async function selectCategoryShield(category: ProfessionalCategory, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";
    await prepareCategoryShieldPreview(category, file, true);
  }

  async function uploadCategoryShield() {
    if (!shieldPreview) return;
    setBusy(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", shieldPreview.file);
      form.set("removeBackground", shieldPreview.removeBackground ? "1" : "0");
      const response = await fetch(categoryShieldUrl(shieldPreview.category.id), { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setShieldVersions((current) => ({ ...current, [shieldPreview.category.id]: Date.now() }));
      URL.revokeObjectURL(shieldPreview.previewUrl);
      setShieldPreview(null);
      setNotice("Escudo de categoría guardado.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido subir el escudo.");
    } finally {
      setBusy(false);
    }
  }

  function closeShieldPreview() {
    setShieldPreview((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="professionalCategories" /></header>
    <section className="directory-cover participations-cover">
      <span className="directory-cover-world-rugby" aria-hidden="true"><Camera className="h-full w-full text-red-600" strokeWidth={1.7} /></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker" />ADMIN</p><h1>CATEGORÍAS</h1><span>Tabla maestra para clubs profesionales</span></div>
      <div className="directory-cover-actions"><Link href="/noticias?tipo=participacion">Participaciones</Link><Link href="/hitos">Hitos staff</Link></div>
    </section>
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-4 sm:px-8">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando categorías profesionales...</p>}
      {state && <>
        {!state.canWrite && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Tabla de categorías</h2><span>Inicia sesión como administrador para añadir, editar o eliminar categorías.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
        {state.canWrite && <section className="mt-2 rounded-2xl bg-white shadow-sm">
          <header className="federation-directory-title"><div><b>TABLA DE CATEGORÍAS</b><small>{state.categories.length} categoría{state.categories.length === 1 ? "" : "s"} profesional{state.categories.length === 1 ? "" : "es"}.</small></div><button type="button" onClick={() => setAddingCategory((current) => !current)} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-700 hover:border-red-200 hover:text-red-700">{addingCategory ? "Cerrar alta" : "+ Añadir categoría"}</button></header>
          <div className="flex flex-wrap gap-2 border-b border-neutral-200 px-3 py-3">
            {(["all", "COMP", "FORM", "CAMP"] as TypeFilter[]).map((filter) => {
              const label = filter === "all" ? "TODOS" : filter;
              const selected = typeFilter === filter;
              return <button key={filter} type="button" onClick={() => setTypeFilter(filter)} aria-pressed={selected} className={`rounded-[8px] border px-3 py-2 text-xs font-black ${selected ? "border-red-300 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-700 hover:border-red-200 hover:text-red-700"}`}>{label} <span className="ml-2 text-red-600">{typeCounts[filter]}</span></button>;
            })}
          </div>
          {addingCategory && <form onSubmit={saveCategory} className="grid gap-3 border-y border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_96px_minmax(140px,1fr)_minmax(120px,.7fr)_minmax(180px,1.2fr)_auto]">
            <input name="id" placeholder="ID opcional" className={inputClass} />
            <select name="type" defaultValue="COMP" className={inputClass} aria-label="Tipo de categoría"><option value="COMP">COMP</option><option value="FORM">FORM</option><option value="CAMP">CAMP</option></select>
            <input name="label" required placeholder="Categoría" className={inputClass} />
            <input name="country" placeholder="País" className={inputClass} />
            <input name="notes" placeholder="Notas" className={inputClass} />
            <button disabled={busy} className="rounded-[8px] border border-neutral-300 bg-white px-4 py-2.5 text-sm font-black text-neutral-800 disabled:opacity-60">Guardar</button>
          </form>}
          <div className="overflow-x-auto">
            <div className="grid min-w-[1000px] grid-cols-[64px_132px_96px_minmax(170px,1fr)_132px_minmax(180px,1fr)_56px_78px] gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><span>ESCUDO</span>{sortHeader("id", "ID")}{sortHeader("type", "TIPO")}{sortHeader("label", "CATEGORÍA")}{sortHeader("country", "PAÍS")}{sortHeader("notes", "NOTAS")}<span aria-label="Escudo" title="Subir escudo"><Camera size={16} aria-hidden="true" /></span><span>BORRAR</span></div>
            <ul className="min-w-[1000px] divide-y divide-neutral-200">{filteredCategories.map((category) => {
              return <li key={category.id}><form onSubmit={saveCategory} className="grid grid-cols-[64px_132px_96px_minmax(170px,1fr)_132px_minmax(180px,1fr)_56px_78px] items-center gap-2 px-3 py-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100"><img src={categoryShieldUrl(category.id, shieldVersions[category.id] ?? category.shield_version ?? category.updated_at)} alt={`Escudo de ${category.label}`} className="h-9 w-9 object-contain" /></span>
                <input type="hidden" name="previous_id" value={category.id} /><input name="id" defaultValue={category.id} required maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9-]{0,39}" aria-label={`ID de ${category.label}`} className={`${inputClass} text-xs`} />
                <select name="type" defaultValue={category.type} className={inputClass} aria-label={`Tipo de ${category.label}`}><option value="COMP">COMP</option><option value="FORM">FORM</option><option value="CAMP">CAMP</option></select>
                <input name="label" defaultValue={category.label} className={inputClass} />
                <input name="country" defaultValue={category.country ?? ""} className={inputClass} />
                <input name="notes" defaultValue={category.notes ?? ""} className={inputClass} />
                <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700" title={`Subir escudo de ${category.label}`} aria-label={`Subir escudo de ${category.label}`}><Camera size={18} aria-hidden="true" /><input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void selectCategoryShield(category, event)} /></label>
                <span className="flex gap-1"><button disabled={busy} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Guardar ${category.label}`} title={`Guardar ${category.label}`}><Save size={15} aria-hidden="true" /></button><DeleteButton type="button" disabled={busy} onClick={() => void deleteCategory(category.id)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Borrar ${category.label}`} title={`Borrar ${category.label}`} confirmationHandled /></span>
              </form></li>;
            })}</ul>
          </div>
        </section>}
      </>}
    </div>
    {shieldPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="category-shield-preview-title">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <header className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-red-700">Vista previa</p><h2 id="category-shield-preview-title" className="mt-1 text-xl font-black">{shieldPreview.category.label}</h2></div><button type="button" onClick={closeShieldPreview} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700" aria-label="Cerrar vista previa"><X size={18} aria-hidden="true" /></button></header>
        <div className="mt-5 grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-[linear-gradient(45deg,#eee_25%,transparent_25%),linear-gradient(-45deg,#eee_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#eee_75%),linear-gradient(-45deg,transparent_75%,#eee_75%)] bg-[length:18px_18px] bg-[position:0_0,0_9px,9px_-9px,-9px_0] p-6"><img src={shieldPreview.previewUrl} alt="Vista previa del escudo preparado" className="max-h-full max-w-full object-contain" /></div>
          <div className="flex flex-col justify-between gap-4"><label className="flex items-center gap-2 text-sm font-bold text-neutral-700"><input type="checkbox" checked={shieldPreview.removeBackground} onChange={(event) => void prepareCategoryShieldPreview(shieldPreview.category, shieldPreview.file, event.target.checked)} /> Eliminar fondo automáticamente</label><p className="text-sm leading-6 text-neutral-600">Comprueba que el escudo queda bien antes de guardarlo. Si el fondo queda raro, desactiva la eliminación automática.</p></div>
        </div>
        <footer className="mt-5 flex justify-end gap-2"><button type="button" onClick={closeShieldPreview} className="rounded-[8px] border border-neutral-300 px-4 py-2 text-sm font-black">Cancelar</button><button type="button" disabled={busy} onClick={() => void uploadCategoryShield()} className="rounded-[8px] bg-red-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{busy ? "Guardando..." : "Guardar escudo"}</button></footer>
      </section>
    </div>}
  </main>;
}
