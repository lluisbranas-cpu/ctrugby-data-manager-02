"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { useRouter } from "@/lib/sport-navigation";
import { useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type StaffMilestone = {
  id: string;
  scope: string | null;
  category: string | null;
  season_label: string | null;
  club_text: string | null;
  position_text: string | null;
};
type StaffRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  milestone_count: number;
  latest_year: number;
  seasons: number[];
  scopes: { scope: string; count: number }[];
  latest_milestone: StaffMilestone | null;
  milestones: StaffMilestone[];
  profile: {
    section: string | null;
    associated_label: string | null;
    associated_url: string | null;
    associated_shield_url: string | null;
    linkedin_url: string | null;
    instagram_url: string | null;
  };
};
type State = {
  configured: boolean;
  admin: boolean;
  can_create: boolean;
  staff_role_categories: string[];
  summary: { staff: number; with_milestones: number; milestones: number; scopes: number };
  years: { year: number; staff: number; milestones: number }[];
  scopes: { scope: string; count: number }[];
  staff: StaffRow[];
};
type SortKey = "name" | "role";

function StaffSilhouette({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none">
    <circle cx="32" cy="24" r="12" fill="currentColor" opacity=".9" />
    <path d="M13 55c2.8-12 10-18 19-18s16.2 6 19 18" fill="currentColor" opacity=".9" />
  </svg>;
}
function SocialLogo({ href, type }: { href: string | null; type: "linkedin" | "instagram" }) {
  const label = type === "linkedin" ? "LinkedIn" : "Instagram";
  const icon = type === "linkedin"
    ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor"><path d="M6.94 8.98H3.72V20h3.22V8.98ZM5.33 4a1.86 1.86 0 1 0 0 3.72A1.86 1.86 0 0 0 5.33 4Zm14.95 9.68c0-3.14-1.68-4.6-3.92-4.6a3.37 3.37 0 0 0-3.05 1.68h-.04V8.98h-3.09V20h3.22v-5.45c0-1.44.27-2.83 2.05-2.83 1.75 0 1.78 1.64 1.78 2.92V20h3.22v-6.32h-.17Z" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke={href ? "url(#staff-list-instagram-gradient)" : "currentColor"} strokeWidth="1.9"><defs><linearGradient id="staff-list-instagram-gradient" x1="4" x2="20" y1="20" y2="4"><stop stopColor="#feda75" /><stop offset=".25" stopColor="#fa7e1e" /><stop offset=".5" stopColor="#d62976" /><stop offset=".75" stopColor="#962fbf" /><stop offset="1" stopColor="#4f5bd5" /></linearGradient></defs><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17.3" cy="6.7" r=".9" fill={href ? "#d62976" : "currentColor"} stroke="none" /></svg>;
  const className = href ? type === "linkedin" ? "text-[#0a66c2]" : "" : "text-neutral-300";
  if (!href) return <span className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-neutral-50 ${className}`} title={`${label} pendiente`} aria-label={`${label} pendiente`}>{icon}</span>;
  return <a href={href} target="_blank" rel="noreferrer" className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white ${className} hover:border-current`} title={`Abrir ${label}`} aria-label={`Abrir ${label}`}>{icon}</a>;
}
function StaffAssociatedShield({ row }: { row: StaffRow }) {
  const content = <>
    <svg viewBox="0 0 24 24" aria-hidden="true" className="staff-list-shield-placeholder" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 19 6v5c0 4.6-2.9 8.4-7 10-4.1-1.6-7-5.4-7-10V6Z" /></svg>
    {row.profile.associated_shield_url && <img src={row.profile.associated_shield_url} alt={`Escudo asociado de ${row.display_name}`} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add("is-empty"); }} onLoad={(event) => event.currentTarget.parentElement?.classList.remove("is-empty")} />}
  </>;
  const title = row.profile.associated_label ?? `Escudo asociado pendiente de ${row.display_name}`;
  if (row.profile.associated_url) return <Link href={row.profile.associated_url} className="staff-list-shield" title={title} aria-label={title}>{content}</Link>;
  return <span className="staff-list-shield is-empty" title={title} aria-label={title}>{content}</span>;
}

export default function StaffPage() {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState({ first_name: "", last_name: "", section: "" });
  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setCreateError("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-profile", ...draft }),
      });
      const data = await response.json();
      if (!response.ok || !data.id) throw new Error(data.error || "No se ha podido añadir el miembro del staff.");
      router.push(`/staff/${encodeURIComponent(data.id)}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "No se ha podido añadir el miembro del staff.");
      setSaving(false);
    }
  }
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [scope, setScope] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "name", direction: 1 });

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/staff", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then((data) => { if (!controller.signal.aborted) setState(data); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se han podido cargar los datos de staff."); });
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    return [...(state?.staff ?? [])].filter((row) => {
      const matchesYear = year === "all" || row.seasons.includes(Number(year));
      const matchesScope = scope === "all" || row.scopes.some((item) => item.scope === scope);
      const haystack = [row.id, row.display_name, row.profile.section ?? "", row.latest_milestone?.category ?? "", row.latest_milestone?.club_text ?? "", row.scopes.map((item) => item.scope).join(" "), row.seasons.join(" ")].join(" ").toLocaleLowerCase("es-ES");
      return matchesYear && matchesScope && (!text || haystack.includes(text));
    }).sort((a, b) => {
      const value = sort.key === "role"
        ? (a.profile.section ?? "").localeCompare(b.profile.section ?? "", "es") || a.display_name.localeCompare(b.display_name, "es")
        : a.display_name.localeCompare(b.display_name, "es");
      return value * sort.direction;
    });
  }, [query, scope, sort, state?.staff, year]);

  const filteredSummary = useMemo(() => {
    const scopeSet = new Set(rows.flatMap((row) => row.scopes.map((item) => item.scope)));
    return {
      staff: rows.length,
      with_milestones: rows.filter((row) => row.milestone_count > 0).length,
      milestones: rows.reduce((total, row) => total + row.milestone_count, 0),
      scopes: scopeSet.size,
    };
  }, [rows]);
  const years = state?.years ?? [];
  const scopes = state?.scopes ?? [];
  const order = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : 1 }));
  const mark = (key: SortKey) => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";

  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="staff"/></header>
    <section className="directory-cover participations-cover">
      <a href="/api/staff/hoja" download="ctrugby-staff-estructura-fichas.xlsx" className="federation-excel-action" title="Descargar tabla de staff en Excel" aria-label="Descargar tabla de staff en Excel"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2"/></svg></a>
      <span className="directory-cover-world-rugby" aria-hidden="true"><svg className="h-full w-full text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="3"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M17 8h4M19 6v4"/><path d="M16 16h5M18.5 13.5v5"/></svg></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker"/><b>Rugby</b><i/>GESTION DE STAFF</p><h1>STAFF<strong className="ctrugby-title">RUGBY</strong></h1><span>Equipo tecnico y personal vinculado</span></div>
      <div className="directory-cover-actions">{state?.can_create && <button type="button" onClick={() => { setAdding(true); setCreateError(""); }} aria-expanded={adding} aria-controls="staff-create-form" className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">+ Añadir miembro del staff</button>}<Link href="/hitos">Ver hitos</Link><Link href="/participaciones">Ver participaciones</Link></div>
    </section>
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-2 sm:px-8">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando staff...</p>}
      {state?.can_create && adding && <form id="staff-create-form" onSubmit={createStaff} className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Añadir miembro del staff</h2>
        <p className="mt-1 text-sm text-neutral-500">Crea su ficha y completa después la foto y el resto de datos.</p>
        <fieldset disabled={saving} className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-semibold">Nombre <span aria-hidden="true">*</span><input autoFocus required maxLength={120} autoComplete="given-name" value={draft.first_name} onChange={(event) => setDraft({ ...draft, first_name: event.target.value })} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
          <label className="text-sm font-semibold">Apellidos<input maxLength={160} autoComplete="family-name" value={draft.last_name} onChange={(event) => setDraft({ ...draft, last_name: event.target.value })} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
          <label className="text-sm font-semibold">Rol Rugby<select value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"><option value="">Sin rol</option>{state.staff_role_categories.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        </fieldset>
        {createError && <p role="alert" className="mt-3 text-sm text-red-700">{createError}</p>}
        <div className="mt-4 flex gap-3"><button type="submit" disabled={saving || !draft.first_name.trim()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando..." : "Guardar y abrir ficha"}</button><button type="button" disabled={saving} onClick={() => { setAdding(false); setDraft({ first_name: "", last_name: "", section: "" }); setCreateError(""); }} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm">Cancelar</button></div>
      </form>}
      {state && <>
        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Staff</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.staff}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Con hitos</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.with_milestones}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Hitos</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.milestones}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Ambitos</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.scopes}</b></article>
        </section>
        <div className="directory-filter-toolbar"><label className="player-year-filter player-year-select selected"><select value={year} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar por año"><option value="all">Todos los años</option>{years.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}</select></label><label className="player-year-filter player-year-select selected"><select value={scope} onChange={(event) => setScope(event.target.value)} aria-label="Filtrar por ambito"><option value="all">Todos los ambitos</option>{scopes.map((item) => <option key={item.scope} value={item.scope}>{item.scope}</option>)}</select></label><label className="directory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, JUG ID, ambito o temporada..." aria-label="Buscar staff" /></label></div>
        <div className="mt-3 grid gap-6">
          <section className="participations-directory-list overflow-x-auto rounded-2xl bg-white shadow-sm">
            <header className="federation-directory-title participations-directory-title"><div><b>STAFF</b><small>Nombre, rol Rugby y perfiles sociales.</small></div></header>
            <div className="directory-list-heading participations-directory-head grid min-w-[700px] grid-cols-[minmax(0,1.25fr)_minmax(0,.9fr)_56px_56px_56px] border-y border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><button className="text-left" onClick={() => order("name")}>NOMBRE {mark("name")}</button><button className="text-left" onClick={() => order("role")}>ROL RUGBY {mark("role")}</button><span className="text-center">ESCUDO</span><span className="text-center">IN</span><span className="text-center">IG</span></div>
            <ul className="min-w-[700px] divide-y divide-neutral-200">{rows.map((row) => <li key={row.id}>
              <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,.9fr)_56px_56px_56px] items-center gap-2 px-3 py-3 text-neutral-900 hover:bg-red-50/60">
                <Link href={`/staff/${row.id}`} className="flex min-w-0 items-center gap-3 hover:text-red-700"><span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-transparent text-neutral-400 shadow-sm"><StaffSilhouette className="h-7 w-7" /><img src={`/api/staff/foto/${row.id}`} alt={`Foto de ${row.display_name}`} className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span><span className="min-w-0"><b className="block truncate text-sm">{row.display_name}</b><small className="mt-1 block truncate text-xs text-neutral-500">{row.id}</small></span></Link>
                <Link href={`/staff/${row.id}`} className="min-w-0 hover:text-red-700"><b className="block truncate text-sm">{row.profile.section ?? "Sin rol"}</b><small className="mt-1 block truncate text-xs text-neutral-500">Abrir ficha</small></Link>
                <span className="flex justify-center"><StaffAssociatedShield row={row} /></span>
                <span className="flex justify-center"><SocialLogo href={row.profile.linkedin_url} type="linkedin" /></span>
                <span className="flex justify-center"><SocialLogo href={row.profile.instagram_url} type="instagram" /></span>
              </div>
            </li>)}</ul>
            {!rows.length && <p className="p-8 text-center text-sm text-neutral-500">No hay staff que coincida con este filtro.</p>}
          </section>
        </div>
      </>}
    </div>
  </main>;
}
