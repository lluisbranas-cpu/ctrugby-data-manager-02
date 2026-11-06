"use client";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { FormEvent, useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import type { TemporaryClubGroup } from "@/lib/temporary-club-groups";
type Club = { id: string; name: string };
const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm";
const empty = { name: "", season: "", category: "", club_ids: [] as string[] };
export default function TemporaryClubGroupsPage() {
  const [data, setData] = useState<{ groups: TemporaryClubGroup[]; clubs: Club[] } | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TemporaryClubGroup | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [clubSearch, setClubSearch] = useState("");
  const [search, setSearch] = useState("");
  const [season, setSeason] = useState("");
  async function load() {
    const response = await fetch("/api/agrupaciones-temporales", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se han podido cargar las agrupaciones.");
    setData(result);
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load().catch(error => setNotice(error.message)); }, 0); return () => window.clearTimeout(timer); }, []);
  async function mutate(body: object) {
    const response = await fetch("/api/agrupaciones-temporales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se ha podido guardar.");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (form.club_ids.length < 2) { setNotice("Selecciona al menos dos clubes adscritos antes de guardar."); return; } setBusy(true); setNotice("");
    try {
      await mutate({ action: "save", ...form, id: editing?.id, version: editing?.version });
      setSearch(""); setSeason(""); setOpen(false); setEditing(null); setForm(empty); setNotice("Agrupación guardada."); await load();
    } catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  async function remove(row: TemporaryClubGroup) {
    if (!window.confirm(`¿Eliminar la agrupación «${row.name}» de la temporada ${row.season}?`)) return;
    setBusy(true); setNotice("");
    try { await mutate({ action: "delete", id: row.id, version: row.version }); setNotice("Agrupación eliminada."); await load(); }
    catch (error) { setNotice((error as Error).message); } finally { setBusy(false); }
  }
  const names = new Map(data?.clubs.map(club => [club.id, club.name]));
  const sortedClubIds = (ids: string[]) => [...ids].sort((a, b) => (names.get(a) || a).localeCompare(names.get(b) || b, "es", { sensitivity: "base" }) || a.localeCompare(b));
  const rows = (data?.groups ?? []).filter(row => (!season || row.season === season) && [row.name, row.category, ...row.club_ids.map(id => names.get(id) || id)].join(" ").toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))).sort((a, b) => b.season.localeCompare(a.season) || a.name.localeCompare(b.name, "es"));
  function start(row?: TemporaryClubGroup) {
    setEditing(row ?? null); setForm(row ? { name: row.name, season: row.season, category: row.category, club_ids: [...row.club_ids] } : empty); setClubSearch(""); setNotice(""); setOpen(true);
  }
  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="temporaryClubGroups" /></header>
    <section className="directory-cover participations-cover"><div className="directory-cover-copy"><p><i className="ctrugby-marker" />ADMIN</p><h1>AGRUPACIONES TEMPORALES DE CLUBS</h1><span>Clubes que comparten agrupación durante una temporada y categoría.</span></div></section>
    <section className="mx-auto max-w-7xl space-y-5 p-6">
      {notice && <p role="status" className="rounded-lg border bg-white p-3">{notice}</p>}
      {!data ? <div><p>{notice ? "No se ha podido abrir la tabla." : "Cargando agrupaciones…"}</p>{notice && <button type="button" onClick={() => { setNotice(""); void load().catch(error => setNotice(error.message)); }}>Reintentar</button>}</div> : <>
        <div className="flex flex-wrap items-end gap-3"><label className="flex-1">Buscar<input className={input} type="search" placeholder="Agrupación, categoría o club" value={search} onChange={e => setSearch(e.target.value)} /></label><label>Temporada<select className={input} value={season} onChange={e => setSeason(e.target.value)}><option value="">Todas</option>{[...new Set(data.groups.map(row => row.season))].sort().reverse().map(value => <option key={value}>{value}</option>)}</select></label><button type="button" disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => start()}>Añadir agrupación</button></div>
        {open && <form onInvalid={() => setNotice("Completa el nombre, la temporada y la categoría antes de guardar.")} onSubmit={save} className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-xl font-bold">{editing ? "Editar agrupación" : "Nueva agrupación"}</h2><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><label htmlFor="group-name">Nombre agrupación<input id="group-name" autoFocus required maxLength={160} list="group-names" autoComplete="off" placeholder="Escribe un nombre nuevo o elige uno existente" className={input} value={form.name} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /><datalist id="group-names">{[...new Set(data.groups.map(row => row.name))].sort((a, b) => a.localeCompare(b, "es")).map(name => <option key={name} value={name} />)}</datalist></label><label>Temporada<input required placeholder="26/27" className={input} value={form.season} onChange={e => setForm({ ...form, season: e.target.value })} /></label><label>Categoría<input required maxLength={80} list="group-categories" className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /><datalist id="group-categories">{[...new Set(["S6", "S8", "S10", "S12", "S14", "S16", "S17", "S18", "S20", "S23", "Sénior", ...data.groups.map(row => row.category)])].map(category => <option key={category} value={category} />)}</datalist></label></div>
          <fieldset><legend className="font-semibold">Clubes adscritos ({form.club_ids.length})</legend><p className="mb-2 text-sm text-neutral-600">Selecciona al menos dos clubes.</p><label>Buscar club<input className={input} type="search" value={clubSearch} onChange={e => setClubSearch(e.target.value)} /></label><div className="my-2 flex flex-wrap gap-2">{sortedClubIds(form.club_ids).map(id => <button type="button" className="rounded-full border px-3 py-1 text-sm" key={id} onClick={() => setForm({ ...form, club_ids: form.club_ids.filter(value => value !== id) })} aria-label={`Quitar ${names.get(id) || id}`}>{names.get(id) || id} ×</button>)}</div>{clubSearch.trim() && <div className="grid max-h-64 gap-2 overflow-y-auto rounded-lg border p-3 md:grid-cols-2">{data.clubs.filter(club => `${club.name} ${club.id}`.toLocaleLowerCase("es").includes(clubSearch.trim().toLocaleLowerCase("es"))).map(club => <label className="flex items-center gap-2" key={club.id}><input type="checkbox" checked={form.club_ids.includes(club.id)} onChange={e => setForm({ ...form, club_ids: e.target.checked ? [...form.club_ids, club.id] : form.club_ids.filter(id => id !== club.id) })} />{club.name} <small className="text-neutral-500">{club.id}</small></label>)}{!data.clubs.some(club => `${club.name} ${club.id}`.toLocaleLowerCase("es").includes(clubSearch.trim().toLocaleLowerCase("es"))) && <p className="text-sm text-neutral-500">No se han encontrado clubes.</p>}</div>}</fieldset>
          <div className="flex gap-3"><button disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50" type="submit">{busy ? "Guardando…" : "Guardar agrupación"}</button><button type="button" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</button></div></fieldset></form>}
        <p aria-live="polite">{rows.length} agrupaciones</p><div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-neutral-100"><tr>{["Nombre agrupación", "Temporada", "Categoría", "Clubes adscritos", "Acciones"].map(title => <th className="p-3" scope="col" key={title}>{title}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-t" key={row.id}><td className="p-3 font-semibold">{row.club_id ? <Link className="underline" href={"/clubs/" + row.club_id}>{row.name}</Link> : row.name}{row.club_id && <small className="block text-neutral-500">{row.club_id}</small>}</td><td className="p-3">{row.season}</td><td className="p-3">{row.category}</td><td className="p-3"><ul>{sortedClubIds(row.club_ids).map(id => <li key={id}><Link href={`/clubs/${encodeURIComponent(id)}`} className="underline">{names.get(id) || id}</Link></li>)}</ul></td><td className="p-3"><div className="flex gap-3"><button disabled={busy} onClick={() => start(row)} type="button" aria-label={`Editar ${row.name}`}>Editar</button><button disabled={busy} onClick={() => void remove(row)} type="button" className="text-red-700" aria-label={`Eliminar ${row.name}`}>Eliminar</button></div></td></tr>)}{!rows.length && <tr><td className="p-6 text-center text-neutral-500" colSpan={5}>{data.groups.length ? "No hay agrupaciones para estos filtros." : "Todavía no hay agrupaciones. Añade la primera agrupación."}</td></tr>}</tbody></table></div>
      </>}
    </section>
  </main>;
}
