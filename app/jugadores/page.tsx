"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Profile = { category: string | null; birth_year: number | null };
type Player = { id: string; first_name: string; last_name: string | null; published: boolean; version: number; profile?: Profile | null; season_count?: number; linked_season_count?: number };
type State = { configured: boolean; admin: boolean; players: Player[] };

const localImportEnabled = process.env.NODE_ENV !== "production";
const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");

export default function PlayersPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"pending" | "published" | "all">("pending");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const response = await fetch("/api/jugadores", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
  };
  useEffect(() => { const controller = new AbortController(); void fetch("/api/jugadores", { cache: "no-store", signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then((data) => setState(data)).catch(() => { if (!controller.signal.aborted) setNotice("No se han podido cargar los jugadores. Recarga para reintentar."); }); return () => controller.abort(); }, []);
  const players = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    return (state?.players ?? []).filter((player) => {
      const matches = !text || [player.id, fullName(player), player.profile?.category ?? ""].some((value) => value.toLocaleLowerCase("es-ES").includes(text));
      return matches && (!state?.admin || filter === "all" || (filter === "published" ? player.published : !player.published));
    });
  }, [filter, query, state]);
  const publish = async (player: Player) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-publication", id: player.id, published: !player.published, version: player.version }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      setNotice(player.published ? `${fullName(player)} se ha retirado de la vista pública.` : `${fullName(player)} se ha publicado.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido completar la operación."); }
    finally { setBusy(false); }
  };
  const importLocal = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores/importar-local", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await load();
      setNotice(`Se han cargado ${data.players} jugadores y ${data.seasons} temporadas para revisión privada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido importar la preparación local."); }
    finally { setBusy(false); }
  };
  const importMilestones = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/hitos/importar-local", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Se han cargado ${data.milestones} hitos y ${data.participants} participantes históricos para revisión privada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido importar los hitos."); }
    finally { setBusy(false); }
  };
  const importRwc2025 = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/hitos/importar-rwc-2025-local", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Se han cargado ${data.milestones} hitos RWC 2025, ${data.new_participants} participantes nuevos y ${data.uploaded_photos} fotografías para revisión privada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido importar la convocatoria RWC 2025."); }
    finally { setBusy(false); }
  };
  const importPhotos = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores/importar-fotos-local", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Se han cargado ${data.photos} fotografías de ficha para revisión privada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido importar las fotografías de ficha."); }
    finally { setBusy(false); }
  };
  const importPlayerClubs = async () => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores/importar-clubs-local", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(`Se han cargado ${data.affiliations} relaciones jugador–club verificadas y ${data.clubs} resúmenes de participación para revisión privada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido importar las relaciones jugador–club."); }
    finally { setBusy(false); }
  };
  const published = state?.players.filter((player) => player.published).length ?? 0;
  const seasons = state?.players.reduce((count, player) => count + (player.season_count ?? 0), 0) ?? 0;
  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><span className="catalog-brand-mark">CT</span><span><strong>CTRugby Data Manager</strong><small>Base de datos</small></span></Link><span className="catalog-topbar-title">Base de datos y publicación</span><Link className="catalog-menu-button" href="/catalogos">Catálogos</Link></header>
    <div className="catalog-shell"><aside className="catalog-sidebar"><p>GESTIÓN</p><Link className="catalog-nav" href="/catalogos">▦ Catálogos</Link><Link className="catalog-nav active" href="/jugadores">◉ Jugadores</Link><i/><p>PUBLICACIÓN</p><small><b/>Las fichas se revisan antes de publicarse.</small></aside><section className="catalog-workspace"><header className="catalog-heading"><div><p>BASE DE DATOS</p><h1>Jugadores</h1><span>Fichas y temporadas bajo revisión privada.</span></div><div><b className={state?.admin ? "admin" : ""}>{state?.admin ? "Administración" : "Vista pública"}</b></div></header><div className="catalog-content">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <div className="catalog-loading">Cargando jugadores…</div>}
      {state && !state.configured && <section className="catalog-warning"><b>Conexión pendiente</b><span>La pantalla está lista, pero no encuentra las variables de Supabase.</span></section>}
      {state?.configured && <><section className="catalog-stats"><article><span>JUGADORES</span><b>{state.players.length}</b><small>{published} publicados</small></article><article><span>TEMPORADAS</span><b>{seasons}</b><small>se incorporarán a cada ficha tras la importación</small></article><article><span>PENDIENTES</span><b>{state.players.length - published}</b><small>por revisar</small></article></section>
      {!state.admin && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Revisión de jugadores</h2><span>Inicia sesión en Catálogos para consultar las fichas, las temporadas y los datos privados.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
      <section className="catalog-panel"><header><div><p>REVISIÓN</p><h2>{state.admin ? "Fichas de jugadores" : "Jugadores publicados"}</h2><span>{state.admin ? "Las temporadas, medidas y año de nacimiento no pasan a la vista pública." : "La lista incorpora únicamente fichas revisadas."}</span></div>{localImportEnabled && state.admin && <div className="flex gap-2">{state.players.length === 0 && <button className="catalog-logout" disabled={busy} onClick={() => void importLocal()}>Cargar preparación local</button>}<button className="catalog-logout" disabled={busy} onClick={() => void importMilestones()}>Cargar hitos locales</button><button className="catalog-logout" disabled={busy} onClick={() => void importRwc2025()}>Cargar RWC 2025</button><button className="catalog-logout" disabled={busy} onClick={() => void importPhotos()}>Cargar fotos</button><button className="catalog-logout" disabled={busy} onClick={() => void importPlayerClubs()}>Cargar clubs</button></div>}</header>
      {state.admin && <div className="catalog-filters"><button onClick={() => setFilter("pending")} className={filter === "pending" ? "selected" : ""}>Pendientes</button><button onClick={() => setFilter("published")} className={filter === "published" ? "selected" : ""}>Publicados</button><button onClick={() => setFilter("all")} className={filter === "all" ? "selected" : ""}>Todos</button></div>}
      <div className="catalog-toolbar"><label>⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, ID o categoría" /></label><p>{players.length} resultado{players.length === 1 ? "" : "s"}</p></div>
      <div className="catalog-table"><div className="catalog-table-head"><span>JUGADOR</span><span>CATEGORÍA</span><span>ESTADO</span><span /></div><ul>{players.map((player, index) => <li key={player.id}><i>{String(index + 1).padStart(2, "0")}</i><div><b>{fullName(player)}</b><small>{player.id}{state.admin && player.season_count != null ? ` · ${player.season_count} temporada${player.season_count === 1 ? "" : "s"}` : ""}</small></div><div><b>{player.profile?.category ?? "Pendiente"}</b><small>{state.admin && player.profile?.birth_year ? `Nacimiento: ${player.profile.birth_year}` : ""}</small></div><span className={player.published ? "published" : ""}><i />{player.published ? "Publicado" : "Pendiente"}</span>{state.admin ? <button className={player.published ? "withdraw" : ""} disabled={busy} onClick={() => void publish(player)}>{player.published ? "Retirar" : "Publicar"}</button> : <strong>↗</strong>}</li>)}</ul>{!players.length && <div className="catalog-empty">{state.admin ? "Todavía no hay jugadores para este filtro." : "Todavía no hay jugadores publicados."}</div>}</div></section></>}
    </div></section></div>
  </main>;
}
