"use client";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";
import { SponsorMark, type SponsorsData } from "../page";
import { useEffect, useState } from "react";

export default function SponsorProfilesPage() {
  const [data, setData] = useState<SponsorsData | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/patrocinadores", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se han podido cargar las fichas."); });
    return () => controller.abort();
  }, []);
  const query = search.trim().toLocaleLowerCase("es");
  const clubs = new Map(data?.clubs.map(club => [club.id, club.name]));
  const sponsors = data?.sponsors.filter(sponsor => `${sponsor.sponsor_code} ${sponsor.name}`.toLocaleLowerCase("es").includes(query)) ?? [];
  const season = (year: number) => `${year}/${String(year + 1).slice(-2)}`;
  return <main className="min-h-screen bg-neutral-100 p-4 text-neutral-900 sm:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold text-red-700">GESTIÓN</p><h1 className="text-2xl font-bold">Fichas de patrocinadores</h1></div><ManagerMenu current="sponsorProfiles" /></header><div className="mb-5 flex flex-wrap gap-3"><Link className="rounded-lg border bg-white px-4 py-2 font-bold" href="/patrocinadores">Tabla de patrocinadores</Link><Link className="rounded-lg border bg-white px-4 py-2 font-bold" href="/patrocinadores/club-temporada">Clubs y temporadas</Link></div><label className="mb-5 block max-w-md">Buscar patrocinador<input className="mt-1 w-full rounded-lg border bg-white p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="SPN001 o nombre" /></label>{error ? <p role="alert" className="rounded-lg border bg-white p-4">{error}</p> : !data ? <p role="status">Cargando fichas…</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sponsors.map(sponsor => { const relations = data.assignments.filter(item => item.sponsor_id === sponsor.id); return <article key={sponsor.id} className="rounded-xl border bg-white p-5 shadow-sm"><header className="flex items-center gap-3"><SponsorMark sponsor={sponsor} /><div><code className="text-xs text-neutral-500">{sponsor.sponsor_code}</code><h2 className="font-bold">{sponsor.name}</h2></div></header><p className="mt-3 text-sm">{sponsor.website ? <a className="text-blue-700 underline" href={sponsor.website} target="_blank" rel="noopener noreferrer">Visitar web</a> : "Web pendiente"}</p><p className="mt-3 text-xs font-bold tracking-wide text-neutral-500">{relations.length} RELACIONES</p><ul className="mt-2 space-y-1 text-sm">{relations.slice(0, 5).map(item => <li key={`${item.club_id}-${item.season_year}`}><b>{clubs.get(item.club_id) ?? item.club_id}</b> · {season(item.season_year)}</li>)}{relations.length > 5 && <li>+ {relations.length - 5} más</li>}</ul><Link className="mt-4 inline-block text-sm font-bold text-red-700 underline" href={`/patrocinadores?buscar=${encodeURIComponent(sponsor.sponsor_code)}`}>Abrir en la tabla</Link></article>; })}{!sponsors.length && <p>No hay fichas para esta búsqueda.</p>}</div>}</div></main>;
}
