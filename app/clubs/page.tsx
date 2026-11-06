"use client";
import { usePathname } from "next/navigation";
/* eslint-disable @next/next/no-img-element */

import Link from "@/app/components/sport-link";
import Image from "next/image";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { ManagerMenu } from "@/app/components/manager-menu";
import { ClubFinderMap, type ClubMapEntry } from "@/app/components/club-finder-map";
import { FederationDirectoryCoverActions } from "@/app/components/federation-directory-cover-actions";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type ClubTeam = { name: string; gender: "M" | "F"; category: string; league: string; source_url: string };
type Club = { id: string; name: string; active: boolean; founded_text: string | null; disappeared_text?: string | null; city: string; province: string; region: string; country: string; latitude: number; longitude: number; maps_url: string; website: string | null; instagram: string | null; teams?: ClubTeam[]; has_shield?: boolean; player_count: number; participation_count: number };
type State = { configured: boolean; admin?: boolean; clubs: Club[] };
type Federation = { id: string; scope: string; territory: string; country: string; player_count: number | null; participation_count: number | null; club_count: number; ctrugby_club_count: number | null };
type ClubSummary = { name: string; players: number; participations: number; clubs: number; federation?: Federation };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
const displayCountry = (country: string) => ({ France: "Francia", Singapore: "Singapur" }[country] ?? country);
const nextClubId = (clubs: Club[]) => {
  const next = clubs.reduce((highest, club) => {
    const match = /^ESP(\d{4})$/.exec(club.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `ESP${String(next).padStart(4, "0")}`;
};

function ClubSummaryDirectory({ title, label, rows, federations, scope, onClose }: { title: string; label: string; rows: ClubSummary[]; federations: Federation[]; scope: "Nacional" | "Territorial"; onClose: () => void }) {
  const [sort, setSort] = useState<{ key: "players" | "participations" | "name" | "clubs"; direction: 1 | -1 }>({ key: "players", direction: -1 });
  const ordered = [...rows].sort((left, right) => (sort.key === "name" ? left.name.localeCompare(right.name, "es") : left[sort.key] - right[sort.key]) * sort.direction);
  const order = (key: typeof sort.key) => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : key === "name" ? 1 : -1 }));
  const mark = (key: typeof sort.key) => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  const regional = scope === "Territorial";
  const className = regional ? "region-directory club-territory-directory" : "country-directory club-territory-directory";
  const headClass = regional ? "region-directory-head" : "country-directory-head";
  return <section className={className} aria-label={`Listado de ${title.toLocaleLowerCase("es-ES")}`}><header><div><b>{title}</b><small>JUG: jugadores únicos desde 2023 · PART: total participaciones Rugby desde 2023.</small></div><button type="button" aria-label="Cerrar listado" onClick={onClose}>×</button></header><div className={headClass}><button onClick={() => order("players")}>JUG. {mark("players")}</button><button onClick={() => order("participations")}>PART. {mark("participations")}</button><span aria-hidden="true"/><button className="text-left" onClick={() => order("name")}>{label} {mark("name")}</button><button className="text-left" onClick={() => order("clubs")}>CLUBS {mark("clubs")}</button></div><ul>{ordered.map((row) => { const federation = row.federation ?? federations.find((item) => item.scope === scope && normalize(scope === "Nacional" ? item.country : item.territory) === normalize(row.name)); const shield = federation ? federationShieldUrl(federation.id) : null; return <li key={row.name}><span className={regional ? "players" : "country-directory-count players"}>{row.players || "—"}</span><span className={regional ? "" : "country-directory-count"}>{row.participations || "—"}</span><span className="image-hover-preview flex h-10 w-12 items-center justify-center">{federation && shield ? <Link href={`/federaciones/${federation.id}`} aria-label={`Ficha de ${row.name}`}><img src={shield} alt={`Escudo de ${row.name}`} className="image-hover-preview-image h-10 w-10 object-contain" /></Link> : "—"}</span>{federation ? <Link href={`/federaciones/${federation.id}`} className="min-w-0 truncate font-bold hover:text-red-700">{row.name}</Link> : <b>{row.name}</b>}<span className={regional ? "" : "country-directory-count"}>{row.clubs}</span></li>; })}</ul>{!rows.length && <p>No hay resultados para este filtro.</p>}</section>;
}

export default function ClubsPage() {
  const pathname = usePathname();
  const isLikid = /^\/rugby\/likid(?:\/|$)/.test(pathname);
  const [state, setState] = useState<State | null>(null);
  const [federations, setFederations] = useState<Federation[]>([]);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Club | null>(null);
  const [shieldVersion, setShieldVersion] = useState(0);
  const [uploadingShield, setUploadingShield] = useState(false);
  const [showNewClub, setShowNewClub] = useState(false);
  const [newClubId, setNewClubId] = useState("ESP0001");
  const [newClubShield, setNewClubShield] = useState("");
  const [creatingClub, setCreatingClub] = useState(false);
  const [directoryScope] = useState<"ctrugby" | "all">("all");
  const [directoryView, setDirectoryView] = useState<"clubs" | "national" | "regional">("clubs");
  const [directoryCoverVersion, setDirectoryCoverVersion] = useState(0);
  const [sort, setSort] = useState<{ key: "name" | "location" | "players" | "participations" | "shield"; direction: 1 | -1 }>({ key: "name", direction: 1 });
  async function loadClubs(signal?: AbortSignal) {
    const response = await fetch("/api/clubs", { cache: "no-store", signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
    return data as State;
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/clubs", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => setState(data))
      .catch(() => { if (!controller.signal.aborted) setNotice("No se han podido cargar los clubs publicados. Recarga para reintentar."); });
    return () => controller.abort();
  }, []);
  useEffect(() => { void fetch("/api/federaciones", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setFederations(data?.federations ?? [])).catch(() => setFederations([])); }, []);
  const clubs = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    return (state?.clubs ?? []).filter((club) => directoryScope === "all" || club.player_count > 0).filter((club) => !text || [club.name, club.id, club.city, club.province, club.country, ...(club.teams ?? []).flatMap((team) => [team.name, team.category, team.league])].some((value) => value.toLocaleLowerCase("es-ES").includes(text))).sort((a, b) => {
      if (sort.key === "shield") return (Number(Boolean(a.has_shield)) - Number(Boolean(b.has_shield))) * sort.direction || a.name.localeCompare(b.name, "es");
      const aValue = sort.key === "name" ? a.name : sort.key === "location" ? [a.country, a.region, a.province, a.city].join(" ") : sort.key === "players" ? a.player_count : a.participation_count;
      const bValue = sort.key === "name" ? b.name : sort.key === "location" ? [b.country, b.region, b.province, b.city].join(" ") : sort.key === "players" ? b.player_count : b.participation_count;
      if (sort.key === "players" || sort.key === "participations") return (aValue as number - (bValue as number)) * sort.direction;
      return (aValue as string).localeCompare(bValue as string, "es") * sort.direction;
    });
  }, [directoryScope, query, sort, state]);
  const order = (key: "name" | "location" | "players" | "participations" | "shield") => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : key === "players" || key === "participations" || key === "shield" ? -1 : 1 }));
  const sortMark = (key: "name" | "location" | "players" | "participations" | "shield") => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  const scopedClubs = useMemo(() => (state?.clubs ?? []).filter((club) => directoryScope === "all" || club.player_count > 0), [directoryScope, state]);
  const scopeClubCount = scopedClubs.length;
  const suggestedClubId = useMemo(() => nextClubId(state?.clubs ?? []), [state]);
  const federationRows = useMemo(() => (scope: "Nacional" | "Territorial") => federations.filter((federation) => federation.scope === scope && (scope === "Nacional" || normalize(federation.country) === "espana") && (directoryScope === "all" || (federation.player_count ?? 0) > 0)).map((federation) => ({ name: scope === "Nacional" ? displayCountry(federation.country) : federation.territory, players: federation.player_count ?? 0, participations: federation.participation_count ?? 0, clubs: directoryScope === "ctrugby" ? federation.ctrugby_club_count ?? 0 : federation.club_count, federation })).sort((left, right) => left.name.localeCompare(right.name, "es")), [directoryScope, federations]);
  const nationalRows = federationRows("Nacional");
  const regionalRows = federationRows("Territorial");
  const uploadShield = async (file: File) => {
    if (!selected) return;
    setUploadingShield(true);
    setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/clubs/escudo/${selected.id}`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar el escudo.");
      setShieldVersion(Date.now());
      setNotice("Escudo guardado y preparado para la web.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar el escudo.");
    } finally { setUploadingShield(false); }
  };
  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get("id") ?? "").trim().toUpperCase();
    const name = String(form.get("name") ?? "").trim();
    const shield = form.get("shield");
    setCreatingClub(true);
    setNotice("");
    try {
      const response = await fetch("/api/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-club",
          id,
          name,
          active: form.get("active") === "on",
          founded_text: form.get("founded_text"),
          disappeared_text: form.get("disappeared_text"),
          city: form.get("city"),
          province: form.get("province"),
          region: form.get("region"),
          country: form.get("country"),
          latitude: form.get("latitude"),
          longitude: form.get("longitude"),
          maps_url: form.get("maps_url"),
          website: form.get("website"),
          instagram: form.get("instagram"),
          published: form.get("published") === "on",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido crear el club.");
      if (shield instanceof File && shield.size > 0) {
        const shieldForm = new FormData();
        shieldForm.set("file", shield);
        const shieldResponse = await fetch(`/api/clubs/escudo/${encodeURIComponent(id)}`, { method: "POST", body: shieldForm });
        const shieldData = await shieldResponse.json();
        if (!shieldResponse.ok) throw new Error(`${name || id} creado, pero el escudo no se ha podido guardar: ${shieldData.error ?? "imagen no válida"}`);
        setShieldVersion(Date.now());
      }
      event.currentTarget.reset();
      setNewClubShield("");
      setShowNewClub(false);
      setDirectoryView("clubs");
      setQuery(id);
      const fresh = await loadClubs();
      setSelected(fresh.clubs.find((club) => club.id === id) ?? null);
      setNewClubId(nextClubId(fresh.clubs));
      setNotice(`${name || "Club"} creado. Ya puedes revisarlo en el directorio.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido crear el club.");
    } finally {
      setCreatingClub(false);
    }
  }
  return <main className={`directory-app ${isLikid ? "clubs-likid" : ""}`}>
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="clubs"/></header>
    <section className="directory-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(250,251,251,.98) 0%, rgba(250,251,251,.92) 50%, rgba(250,251,251,.58) 100%), url(/api/clubs/portada/directorio?v=${directoryCoverVersion})`, backgroundSize: "cover", backgroundPosition: "center" }}>{state?.admin && <><a href="/api/clubs/hoja" download="ctrugby-clubs.xlsx" className="federation-excel-action" title="Descargar base de datos en Excel" aria-label="Descargar base de datos de clubs en Excel"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2"/></svg></a><FederationDirectoryCoverActions endpoint="/api/clubs/portada/directorio" onUpdated={() => setDirectoryCoverVersion(Date.now())}/></>}<div className="directory-cover-copy"><p><i className="ctrugby-marker"/><b>Rugby</b><i/>DIRECTORIO DE CLUBS</p><h1>CLUBS{directoryScope === "ctrugby" && <strong className="ctrugby-title">RUGBY</strong>}</h1><span>Clubs, territorio y rugby</span></div><div className="directory-cover-actions"><button type="button" onClick={() => { setShowNewClub((value) => !value); setNewClubId(suggestedClubId); }}>{showNewClub ? "Cerrar alta" : "+Añadir club"}</button></div><div className="directory-cover-diagonals" aria-hidden="true"><span/><span/><span/></div></section>
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-3 sm:px-8">
      {notice && <p role="status" className="mb-4 font-medium text-red-800">{notice}</p>}
      {state?.configured === false && <p className="rounded-xl border border-amber-300 bg-amber-50 p-5">El catálogo público todavía no está conectado.</p>}
      {state && <>
        {showNewClub && <section className="catalog-new-club-card directory-new-club-card">
          <header>
            <div><p>ALTA MANUAL</p><h2>Nuevo club</h2><span>Completa la ficha y, si ya tienes el archivo, añade el escudo antes de guardar.</span></div>
            <button type="button" className="catalog-logout" onClick={() => setShowNewClub(false)}>Ocultar formulario</button>
          </header>
          <form className="catalog-club-form" onSubmit={createClub}>
            <label className="catalog-club-field">ID<input name="id" value={newClubId} onChange={(event) => setNewClubId(event.target.value.toUpperCase())} placeholder="ESP0001" pattern="[A-Za-z]{3}[0-9]{4}" maxLength={7} required /></label>
            <label className="catalog-club-field catalog-club-field-wide">Nombre<input name="name" maxLength={160} required /></label>
            <label className="catalog-club-field">Activo<span><input name="active" type="checkbox" defaultChecked /> Sí</span></label>
            <label className="catalog-club-field">Publicado<span><input name="published" type="checkbox" /> Sí</span></label>
            <div className="catalog-club-field"><span className="catalog-club-field-title">Escudo</span><label className="club-shield-disk" title="Elegir escudo"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h8V3"/><path d="M8 15h8v6H8Z"/></svg><span>{newClubShield || "Elegir archivo"}</span><input name="shield" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setNewClubShield(event.currentTarget.files?.[0]?.name ?? "")} /></label></div>
            <label className="catalog-club-field">Fundación<input name="founded_text" maxLength={160} placeholder="Ej. 1998" /></label>
            <label className="catalog-club-field">Año de desaparición<input name="disappeared_text" inputMode="numeric" maxLength={4} /></label>
            <label className="catalog-club-field">Ciudad<input name="city" maxLength={120} required /></label>
            <label className="catalog-club-field">Provincia<input name="province" maxLength={120} required /></label>
            <label className="catalog-club-field">Región<input name="region" maxLength={120} required /></label>
            <label className="catalog-club-field">País<input name="country" maxLength={120} defaultValue="España" required /></label>
            <label className="catalog-club-field">Latitud<input name="latitude" type="number" min={-90} max={90} step="any" /></label>
            <label className="catalog-club-field">Longitud<input name="longitude" type="number" min={-180} max={180} step="any" /></label>
            <label className="catalog-club-field catalog-club-field-wide">URL de mapa<input name="maps_url" type="url" pattern="https://.*" placeholder="https://..." /></label>
            <label className="catalog-club-field">Web<input name="website" type="url" pattern="https://.*" placeholder="https://..." /></label>
            <label className="catalog-club-field">Instagram<input name="instagram" placeholder="@club" pattern="@\S+" /></label>
            <div className="catalog-club-form-actions"><button disabled={creatingClub}>{creatingClub ? "Guardando..." : "Guardar club"}</button></div>
          </form>
        </section>}
        <section className="grid grid-cols-3 gap-2 sm:gap-3"><button type="button" onClick={() => { setDirectoryView("clubs"); setQuery(""); setSelected(null); }} className={`min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5 ${directoryView === "clubs" ? "ring-2 ring-red-600" : ""}`}><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Clubs</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{scopeClubCount}</b></button><button type="button" onClick={() => setDirectoryView("national")} className={`min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5 ${directoryView === "national" ? "ring-2 ring-red-600" : ""}`}><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Fed. Nacionales</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{nationalRows.length}</b></button><button type="button" onClick={() => setDirectoryView("regional")} className={`min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5 ${directoryView === "regional" ? "ring-2 ring-red-600" : ""}`}><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Fed. Autonómicas</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{regionalRows.length}</b></button></section><div className="directory-filter-toolbar">{null}<div className="directory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} placeholder={state?.admin ? "Buscar por club, ID o ubicación…" : "Buscar por club o ubicación…"} /></div></div>{directoryView === "clubs" ? <div className="mt-0 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
          <section className="rounded-2xl bg-white shadow-sm"><div className="min-w-0"><div className="club-directory-sticky"><header className="club-directory-title"><div><b>CLUBS</b>{!isLikid && <small>JUG: jugadores únicos desde 2023 · PART: total participaciones Rugby desde 2023.</small>}</div></header><div className="club-directory-head directory-list-heading grid grid-cols-[52px_52px_64px_minmax(0,1fr)_104px] border-b border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500">{!isLikid && <><button type="button" onClick={() => order("players")} className="text-center">JUG. {sortMark("players")}</button><button type="button" onClick={() => order("participations")} className="text-center">PART. {sortMark("participations")}</button></>}<button type="button" onClick={() => order("shield")} aria-label={sort.key === "shield" && sort.direction === -1 ? "Ordenar: sin escudo primero" : "Ordenar: con escudo primero"} title="Alternar clubs con escudo y sin escudo" className="text-center">ESC. {sortMark("shield")}</button><button type="button" onClick={() => order("name")} className="text-left">CLUB {sortMark("name")}</button><button type="button" onClick={() => order("location")} className="text-left">UBICACIÓN {sortMark("location")}</button></div></div><ul className="divide-y divide-neutral-200">{clubs.map((club) => <li key={club.id}><button onClick={() => setSelected(club)} className={`grid w-full grid-cols-[52px_52px_64px_minmax(0,1fr)_104px] items-center px-3 py-[15px] text-left ${selected?.id === club.id ? "bg-red-50" : "hover:bg-neutral-50"}`}>{!isLikid && <><span className="text-center text-lg text-red-600">{club.player_count || "—"}</span><span className="text-center text-lg text-neutral-800">{club.participation_count || "—"}</span></>}<Link href={`/clubs/${club.id}`} className="image-hover-preview relative flex h-12 w-16 items-center justify-center overflow-visible"><span className="flex h-10 w-10 items-center justify-center overflow-visible text-xs font-black text-neutral-600">{clubShieldUrl(club.id, shieldVersion) ? <img src={clubShieldUrl(club.id, shieldVersion)!} alt="" className="image-hover-preview-image h-full w-full object-contain"/> : club.id.slice(-2)}</span></Link><span className="min-w-0"><Link href={`/clubs/${club.id}`} className="block leading-tight font-bold hover:text-red-700">{club.name}</Link><small className="mt-1 block text-neutral-600">{state?.admin && club.id}{state?.admin && !club.active && " · "}{!club.active && (club.disappeared_text ? "Desaparecido · " + club.disappeared_text : "Inactivo")}</small>{Boolean(club.teams?.length) && <span className="club-team-tags">{club.teams!.map((team) => <span key={`${club.id}-${team.name}`} title={team.league}>{team.category}</span>)}</span>}</span><span className="text-sm text-neutral-600">{[club.city, club.country].filter(Boolean).join(", ")}</span></button></li>)}</ul></div>{!clubs.length && <p className="py-10 text-center text-neutral-500">Todavía no hay clubs publicados para esta búsqueda.</p>}</section><aside className="space-y-6"><ClubFinderMap clubs={clubs as ClubMapEntry[]} selectedId={selected?.id} onSelect={(club) => setSelected(club as Club)} />
          {selected ? <section className="rounded-2xl bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="image-hover-preview flex h-16 w-16 shrink-0 items-center justify-center overflow-visible text-sm font-black text-neutral-600">{clubShieldUrl(selected.id, shieldVersion) ? <img src={clubShieldUrl(selected.id, shieldVersion)!} alt={`Escudo de ${selected.name}`} className="image-hover-preview-image h-full w-full object-contain p-2"/> : selected.id.slice(-2)}</span><div><p className="text-xs font-bold tracking-[.16em] text-red-700">FICHA DE CLUB</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2>{state?.admin && <p className="mt-1 text-sm text-neutral-600">{selected.id}</p>}</div></div><button aria-label="Cerrar ficha" onClick={() => setSelected(null)} className="rounded-lg bg-neutral-100 px-3 py-1">×</button></div><dl className="mt-5 grid gap-3 text-sm"><div><dt className="font-semibold text-neutral-500">Ubicación</dt><dd>{[selected.city, selected.province, selected.region, selected.country].filter((value) => value && value !== "—").join(" · ")}</dd></div>{!selected.active && <div><dt className="font-semibold text-neutral-500">Año de desaparición</dt><dd>{selected.disappeared_text || "Sin confirmar"}</dd></div>}{selected.founded_text && <div><dt className="font-semibold text-neutral-500">Fundación</dt><dd>{selected.founded_text}</dd></div>}</dl>{Boolean(selected.teams?.length) && <div className="club-team-panel"><b>Equipos</b>{selected.teams!.map((team) => <a key={team.name} href={team.source_url} target="_blank" rel="noreferrer"><span>{team.category}</span><small>{team.league}</small></a>)}</div>}<div className="mt-5 flex flex-wrap gap-3"><a className="rounded-lg bg-neutral-950 px-3 py-2 text-sm font-bold text-white" href={selected.maps_url} target="_blank" rel="noreferrer">Ver ubicación</a>{selected.website && <a className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white" href={selected.website} target="_blank" rel="noreferrer">Web del club</a>}{state?.admin && <label className="cursor-pointer rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold text-neutral-800">{uploadingShield ? "Guardando escudo…" : "Subir escudo"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingShield} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadShield(file); }} /></label>}</div></section> : <section className="rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600">Selecciona un club para ver su ficha pública.</section>}</aside></div> : directoryView === "national" ? <ClubSummaryDirectory title="FED. NACIONALES" label="PAÍS" rows={nationalRows} federations={federations} scope="Nacional" onClose={() => setDirectoryView("clubs")}/> : <ClubSummaryDirectory title="FED. AUTONÓMICAS" label="FEDERACIÓN" rows={regionalRows} federations={federations} scope="Territorial" onClose={() => setDirectoryView("clubs")}/>}
      </>}
    </div>
  </main>;
}















