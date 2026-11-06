"use client";

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type Club = { id: string; name: string; country: string | null; region?: string | null };
type Season = { player_id: string; club_id: string | null };
type State = { configured: boolean; admin: boolean; seasons?: Season[]; clubs?: Club[] };
type Territory = { name: string; players: number; clubs: number };

export function TerritoryList({ kind }: { kind: "country" | "region" }) {
  const [state, setState] = useState<State | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Territory | null>(null);
  const [sort, setSort] = useState<{ key: "name" | "players" | "clubs"; direction: 1 | -1 }>({ key: "players", direction: -1 });
  const label = kind === "country" ? "Países" : "Comunidades autónomas";
  const singular = kind === "country" ? "país" : "comunidad autónoma";

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/jugadores", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(setState)
      .catch(() => { if (!controller.signal.aborted) setState({ configured: false, admin: false }); });
    return () => controller.abort();
  }, []);

  const territories = useMemo(() => {
    const clubs = new Map((state?.clubs ?? []).map((club) => [club.id, club]));
    const members = new Map<string, Set<string>>();
    const linkedClubs = new Map<string, Set<string>>();
    for (const season of state?.seasons ?? []) {
      if (!season.club_id) continue;
      const club = clubs.get(season.club_id);
      if (!club) continue;
      const name = kind === "country" ? club?.country : club?.region;
      if (!name || name === "—") continue;
      if (!members.has(name)) members.set(name, new Set());
      if (!linkedClubs.has(name)) linkedClubs.set(name, new Set());
      members.get(name)!.add(season.player_id);
      linkedClubs.get(name)!.add(club.id);
    }
    const text = query.trim().toLocaleLowerCase("es-ES");
    return [...members.entries()].map(([name, players]) => ({ name, players: players.size, clubs: linkedClubs.get(name)?.size ?? 0 }))
      .filter((entry) => !text || entry.name.toLocaleLowerCase("es-ES").includes(text))
      .sort((a, b) => {
        const comparison = sort.key === "name" ? a.name.localeCompare(b.name, "es") : a[sort.key] - b[sort.key];
        return comparison * sort.direction;
      });
  }, [kind, query, sort, state]);
  const order = (key: "name" | "players" | "clubs") => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : key === "name" ? 1 : -1 }));
  const sortMark = (key: "name" | "players" | "clubs") => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";

  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="players" /></header>
    <div className="catalog-shell"><section className="catalog-workspace"><div className="catalog-content territory-content">
      <header className="territory-heading"><p>RUGBY · JUGADORES</p><h1>{label}</h1><span>Consulta cuántos jugadores tienen un club vinculado en cada {singular}.</span></header>
      {!state && <div className="catalog-loading">Cargando territorios…</div>}
      {state?.configured === false && <section className="catalog-warning"><b>Acceso pendiente</b><span>Inicia sesión en Catálogos para consultar los datos privados de jugadores.</span></section>}
      {state?.configured && <><section className="catalog-stats territory-stats"><article><span>{label.toUpperCase()}</span><b>{territories.length}</b><small>con jugadores vinculados</small></article><article><span>JUGADORES</span><b>{territories.reduce((total, entry) => total + entry.players, 0)}</b><small>sumados por territorio</small></article><article><span>CLUBS</span><b>{territories.reduce((total, entry) => total + entry.clubs, 0)}</b><small>vinculados al listado</small></article></section><div className="territory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Buscar por ${singular}…`} /></div><div className="territory-layout"><section className="territory-table"><header className="directory-list-heading"><button type="button" onClick={() => order("name")}>{label.toUpperCase()} {sortMark("name")}</button><button type="button" onClick={() => order("players")}>JUGADORES {sortMark("players")}</button><button type="button" onClick={() => order("clubs")}>CLUBS {sortMark("clubs")}</button></header><ul>{territories.map((entry) => <li key={entry.name}><button className={selected?.name === entry.name ? "selected" : ""} onClick={() => setSelected(entry)}><b>{entry.name}</b><strong>{entry.players}</strong><small>{entry.clubs}</small></button></li>)}</ul>{!territories.length && <p>No hay resultados para esta búsqueda.</p>}</section><aside className="territory-detail">{selected ? <><p>{singular.toUpperCase()}</p><h2>{selected.name}</h2><b>{selected.players}</b><span>jugadores con club vinculado</span><small>{selected.clubs} clubs en el catálogo</small></> : <><p>LISTADO TERRITORIAL</p><h2>Selecciona un registro</h2><span>Verás el total de jugadores y clubs vinculados.</span></>}</aside></div></>}
    </div></section></div>
  </main>;
}
