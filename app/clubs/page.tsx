"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

type Club = { id: string; name: string; active: boolean; founded_text: string | null; city: string; province: string; region: string; country: string; latitude: number; longitude: number; maps_url: string; website: string | null; instagram: string | null };
type State = { configured: boolean; clubs: Club[] };

const markerStyle = (club: Club): CSSProperties => ({
  left: `${Math.min(96, Math.max(4, ((club.longitude + 180) / 360) * 100))}%`,
  top: `${Math.min(92, Math.max(8, ((90 - club.latitude) / 180) * 100))}%`,
});

export default function ClubsPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Club | null>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/clubs", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => setState(data))
      .catch(() => { if (!controller.signal.aborted) setNotice("No se han podido cargar los clubs publicados. Recarga para reintentar."); });
    return () => controller.abort();
  }, []);
  const clubs = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    return (state?.clubs ?? []).filter((club) => !text || [club.name, club.id, club.city, club.province, club.country].some((value) => value.toLocaleLowerCase("es-ES").includes(text)));
  }, [query, state]);
  const countries = new Set(state?.clubs.map((club) => club.country) ?? []).size;
  const regions = new Set((state?.clubs ?? []).filter((club) => club.country === "España").map((club) => club.region)).size;
  return <main className="min-h-screen bg-[#e9e8e5] text-[#171717]">
    <header className="relative flex items-center justify-between bg-[#101010] px-5 py-4 text-white sm:px-8">
      <Link href="/" className="text-xl font-black tracking-tight sm:text-2xl">CTRugby <span className="text-red-500">· Data Manager</span></Link>
      <button aria-label="Menú de navegación" aria-expanded={menu} onClick={() => setMenu(!menu)} className="rounded-lg border border-neutral-600 px-3 py-2 text-xl">{menu ? "×" : "☰"}</button>
      {menu && <nav className="absolute right-5 top-16 z-20 w-56 rounded-xl bg-neutral-900 p-4 shadow-2xl"><Link className="block rounded-lg px-3 py-2 hover:bg-neutral-800" href="/">Inicio</Link><Link className="block rounded-lg px-3 py-2 hover:bg-neutral-800" href="/catalogos">Administrar catálogos</Link></nav>}
    </header>
    <section className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-red-950 px-5 py-10 text-white sm:px-8 sm:py-14">
      <div className="mx-auto max-w-6xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-red-400">CTRugby · Directorio público</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">Clubs, territorio y rugby</h1><p className="mt-3 max-w-2xl text-neutral-300">El directorio muestra únicamente los clubs revisados y publicados por CTRugby.</p><p className="mt-6 text-sm font-semibold text-red-200">{state ? `${state.clubs.length} clubs publicados` : "Cargando clubs…"}</p></div>
    </section>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <p role="status" className="mb-4 min-h-6 font-medium text-red-800">{notice}</p>
      {state?.configured === false && <p className="rounded-xl border border-amber-300 bg-amber-50 p-5">El catálogo público todavía no está conectado.</p>}
      {state && <>
        <section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-semibold text-neutral-500">CLUBS PUBLICADOS</span><b className="mt-2 block text-3xl">{state.clubs.length}</b></div><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-semibold text-neutral-500">PAÍSES</span><b className="mt-2 block text-3xl">{countries}</b></div><div className="rounded-2xl bg-white p-5 shadow-sm"><span className="text-sm font-semibold text-neutral-500">COMUNIDADES AUTÓNOMAS</span><b className="mt-2 block text-3xl">{regions}</b></div></section>
        <label className="mt-7 block max-w-xl text-sm font-bold">Buscar club, ID o ubicación<input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder="Ej. Andorra, ARG0001…" className="mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base font-normal shadow-sm" /></label>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
          <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-baseline justify-between gap-3"><h2 className="text-xl font-black">Listado de clubs</h2><span className="text-sm text-neutral-500">{clubs.length} resultados</span></div><ul className="mt-4 divide-y divide-neutral-200">{clubs.map((club) => <li key={club.id}><button onClick={() => setSelected(club)} className={`flex w-full items-center gap-4 px-2 py-4 text-left ${selected?.id === club.id ? "rounded-lg bg-red-50" : "hover:bg-neutral-50"}`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-black text-neutral-600">{club.id.slice(-2)}</span><span><b className="block">{club.name}</b><small className="text-neutral-600">{club.id} · {club.city}, {club.country}{!club.active && " · Inactivo"}</small></span></button></li>)}</ul>{!clubs.length && <p className="py-10 text-center text-neutral-500">Todavía no hay clubs publicados para esta búsqueda.</p>}</section>
          <aside className="space-y-6"><section className="relative min-h-72 overflow-hidden rounded-2xl bg-[#18232a] p-5 text-white shadow-sm"><div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "44px 44px" }} /><p className="relative text-xs font-bold tracking-[.18em] text-neutral-300">MAPA DE CLUBS PUBLICADOS</p><div className="absolute inset-0 top-10">{clubs.map((club) => <button key={club.id} aria-label={`Ver ${club.name}`} title={club.name} onClick={() => setSelected(club)} style={markerStyle(club)} className={`absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${selected?.id === club.id ? "scale-150 bg-red-500" : "bg-red-400 hover:scale-125"}`} />)}</div><p className="absolute bottom-5 left-5 right-5 text-sm text-neutral-300">Selecciona un punto o un registro para abrir su ficha.</p></section>
          {selected ? <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[.16em] text-red-700">FICHA DE CLUB</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-neutral-600">{selected.id}</p></div><button aria-label="Cerrar ficha" onClick={() => setSelected(null)} className="rounded-lg bg-neutral-100 px-3 py-1">×</button></div><dl className="mt-5 grid gap-3 text-sm"><div><dt className="font-semibold text-neutral-500">Ubicación</dt><dd>{[selected.city, selected.province, selected.region, selected.country].filter((value) => value && value !== "—").join(" · ")}</dd></div>{selected.founded_text && <div><dt className="font-semibold text-neutral-500">Fundación</dt><dd>{selected.founded_text}</dd></div>}</dl><div className="mt-5 flex flex-wrap gap-3"><a className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-bold text-white" href={selected.maps_url} target="_blank" rel="noreferrer">Ver ubicación</a>{selected.website && <a className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white" href={selected.website} target="_blank" rel="noreferrer">Web del club</a>}</div></section> : <section className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">Selecciona un club para ver su ficha pública.</section>}</aside>
        </div>
      </>}
    </div>
  </main>;
}
