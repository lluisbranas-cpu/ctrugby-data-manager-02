"use client";
/* eslint-disable @next/next/no-img-element */

import { currentClubSeason } from "@/lib/current-club";
import { DeleteButton } from "@/app/components/delete-button";
import Link from "@/app/components/sport-link";
import { groupSearchNames, type ClubGroupMembership } from "@/app/lib/club-group-membership";
import Image from "next/image";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import { ManagerMenu } from "@/app/components/manager-menu";
import { FederationDirectoryCoverActions } from "@/app/components/federation-directory-cover-actions";
import { Newspaper } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Profile = { category: string | null; birth_year: number | null };
type Player = { club_groups?: ClubGroupMembership[]; id: string; first_name: string; last_name: string | null; published: boolean; version: number; profile?: Profile | null; season_count?: number; linked_season_count?: number; club_history_count?: number; participation_count?: number; milestone_count?: number; selected_federation_ids?: string[]; news_count?: number };
type PlayerSeason = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type ClubRef = { id: string; name: string; country: string | null; city?: string | null; region?: string | null; province?: string | null; latitude?: number | null; longitude?: number | null; maps_url?: string | null; active?: boolean | null };
type State = { configured: boolean; admin: boolean; source?: string; players: Player[]; seasons?: PlayerSeason[]; clubs?: ClubRef[]; photos?: Record<string, string> };
type ClubHistory = { club_id: string; club_name: string; city: string | null; country: string | null; participation_count: number };
type DirectoryScope = "ctrugby" | "all";

const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");
const playerPhotoUrl = (state: State, playerId: string) => state.source === "likidhub" ? `/api/jugadores/foto/${encodeURIComponent(playerId)}` : state.photos?.[playerId] ?? `/api/jugadores/foto/${playerId}`;
const normalizeSearchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]/g, "");
const matchesPlayerId = (playerId: string, query: string) => {
  const match = query.trim().match(/^(?:ctr[\s-]*)?(\d{1,5})$/i);
  const idDigits = playerId.match(/\d+$/)?.[0];
  return Boolean(match && idDigits && Number(match[1]) === Number(idDigits));
};
export default function PlayersPage() {
  const pathname = usePathname();
  const isLikid = /^\/rugby\/likid(?:\/|$)/.test(pathname);
  const sportLabel = pathname.startsWith("/rugby/") ? "Rugby" : "Rugby";
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [edition, setEdition] = useState("all");
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [scope] = useState<DirectoryScope>("all");
  const [publicationFilter, setPublicationFilter] = useState<"all" | "published" | "hidden">("all");
  const [sort, setSort] = useState<{ key: "participation" | "player" | "club" | "national" | "regional" | "milestones" | "news" | "status"; direction: 1 | -1 }>({ key: "player", direction: 1 });
  const [, setBusy] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState<Player | null>(null);
  const [history, setHistory] = useState<ClubHistory[] | null>(null);
  const [directoryCoverVersion, setDirectoryCoverVersion] = useState(0);

  const load = async () => {
    const response = await fetch("/api/jugadores", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
  };
  useEffect(() => { const controller = new AbortController(); void fetch("/api/jugadores", { cache: "no-store", signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then((data) => setState(data)).catch(() => { if (!controller.signal.aborted) setNotice("No se han podido cargar los jugadores. Recarga para reintentar."); }); return () => controller.abort(); }, []);

  const changePublication = async (player: Player, published: boolean) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-publication", id: player.id, published, version: player.version }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await load(); setNotice(published ? `${fullName(player)} se ha publicado.` : `${fullName(player)} queda oculto al público.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido completar la operación."); }
    finally { setBusy(false); }
  };
  const updatePublication = async (player: Player, status: "published" | "hidden") => {
    const published = status === "published";
    if (player.published === published) return;
    if (!published) {
      const confirmed = window.confirm(`¿Ocultar a ${fullName(player)} de la vista pública? La ficha seguirá disponible para administración.`);
      if (!confirmed) return;
    }
    await changePublication(player, published);
  };
  const deleteHiddenPlayer = async (player: Player) => {
    if (player.published) return;
    const confirmed = window.confirm(`¿Eliminar definitivamente el registro de ${fullName(player)}? Antes se comprobará que no tenga hitos ni participaciones. Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-player", id: player.id, version: player.version }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await load(); setNotice(`${fullName(player)} se ha eliminado del registro.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido eliminar el registro."); }
    finally { setBusy(false); }
  };  const showHistory = async (player: Player) => {
    if (historyPlayer?.id === player.id) { setHistoryPlayer(null); setHistory(null); return; }
    setBusy(true); setNotice(""); setHistoryPlayer(player); setHistory(null);
    try { const response = await fetch(`/api/jugadores?history=${encodeURIComponent(player.id)}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setHistory(data.clubs ?? []); }
    catch (error) { setHistoryPlayer(null); setNotice(error instanceof Error ? error.message : "No se ha podido leer el historial privado de clubs."); } finally { setBusy(false); }
  };

  const seasonsByPlayer = useMemo(() => {
    const rows = new Map<string, PlayerSeason[]>();
    for (const season of state?.seasons ?? []) rows.set(season.player_id, [...(rows.get(season.player_id) ?? []), season]);
    return rows;
  }, [state?.seasons]);
  const clubsById = useMemo(() => new Map((state?.clubs ?? []).map((club) => [club.id, club])), [state?.clubs]);
  const editions = [2026, 2025, 2024, 2023, 2022];
  const playerRows = useMemo(() => (state?.players ?? []).map((player) => {
    const seasons = [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year);
    const clubs = seasons.map((season) => season.club_id ? clubsById.get(season.club_id) : undefined).filter((club): club is ClubRef => Boolean(club));
    const currentSeason = currentClubSeason(seasons);
    const currentClub = currentSeason?.club_id ? clubsById.get(currentSeason.club_id) ?? null : null;
    const currentClubName = currentClub?.name ?? currentSeason?.legacy_club_name ?? null;
    return { player, seasons, clubs, currentClub, currentClubName, positionText: currentSeason?.position_text ?? null };
  }).filter(({ player, clubs }) => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    const searchable = [...groupSearchNames(player.club_groups, edition), player.id, fullName(player), player.profile?.category ?? "", ...(seasonsByPlayer.get(player.id) ?? []).map((season) => season.legacy_club_name ?? ""), ...clubs.map((club) => `${club.name} ${club.country ?? ""}`)].join(" ").toLocaleLowerCase("es-ES");
    const normalizedText = normalizeSearchText(text);
    return !text || searchable.includes(text) || matchesPlayerId(player.id, text) || Boolean(normalizedText) && normalizeSearchText(searchable).includes(normalizedText);
  }).filter(({ player, seasons }) => {
    const inScope = isLikid || scope === "all" || (player.participation_count ?? 0) > 0;
    const publication = publicationFilter === "all" || (publicationFilter === "published" ? player.published : !player.published);
    return publication && inScope && (edition === "all" || seasons.some((season) => String(season.season_year) === edition)) && (gender === "all" || player.profile?.category === gender);
  }).sort((a, b) => {
    const sortValue = (row: typeof a) => sort.key === "participation" ? row.player.participation_count ?? 0 : sort.key === "club" ? row.currentClubName ?? "" : sort.key === "national" ? Number(row.player.selected_federation_ids?.some((id) => id.startsWith("FN"))) : sort.key === "regional" ? Number(row.player.selected_federation_ids?.some((id) => id.startsWith("FT"))) : sort.key === "milestones" ? row.player.milestone_count ?? 0 : sort.key === "news" ? row.player.news_count ?? 0 : sort.key === "status" ? row.player.published ? "Publicado" : "Pendiente" : fullName(row.player);
    const aValue = sortValue(a); const bValue = sortValue(b);
    const comparison = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue), "es");
    return comparison * sort.direction;
  }), [clubsById, edition, gender, isLikid, publicationFilter, query, scope, seasonsByPlayer, sort, state?.players]);
  const order = (key: typeof sort.key) => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : key === "player" || key === "club" ? 1 : -1 }));
  const sortMark = (key: typeof sort.key) => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  const rows = playerRows;
  const scopeCounts = useMemo(() => ({
    all: state?.players.length ?? 0,
    ctrugby: state?.players.filter((player) => (player.participation_count ?? 0) > 0).length ?? 0,
  }), [state?.players]);
  const filteredPlayersExportUrl = useMemo(() => {
    const params = new URLSearchParams({ formato: "listado", year: edition, gender, scope, status: publicationFilter });
    if (query.trim()) params.set("q", query.trim());
    return `/api/jugadores/hoja?${params.toString()}`;
  }, [edition, gender, publicationFilter, query, scope]);
  const yearLabel = edition === "all" ? "Todos los años" : edition;
  const genderLabel = gender === "all" ? "Todos los géneros" : gender === "M" ? "Masculino" : "Femenino";

  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong><small>Base de datos</small></span></Link><ManagerMenu current="players"/></header>
    <div className="catalog-shell"><section className="catalog-workspace">
      <section className="players-directory-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(250,251,251,.98) 0%, rgba(250,251,251,.92) 50%, rgba(250,251,251,.58) 100%), url(/api/jugadores/portada/directorio?v=${directoryCoverVersion})`, backgroundSize: "cover", backgroundPosition: "center" }}>{state?.admin && <><Link href="/api/jugadores/hoja" download="ctrugby-jugadores-privado.xlsx" className="federation-excel-action" title="Descargar base de datos en Excel" aria-label="Descargar base de datos de jugadores en Excel"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2"/></svg></Link><FederationDirectoryCoverActions endpoint="/api/jugadores/portada/directorio" onUpdated={() => setDirectoryCoverVersion(Date.now())}/></>}<div className="players-directory-cover-copy"><p className="players-directory-eyebrow"><i/><span className="players-directory-sport">{sportLabel}</span><span>· DIRECTORIO DE JUGADORES</span></p><h1>JUGADORES{scope === "ctrugby" && <strong>RUGBY</strong>}</h1><div className="players-directory-summary"><div><b>{rows.length}</b><span>Jugadores en el listado</span></div><div><small>EDICIÓN</small><strong>{yearLabel}</strong></div><div><small>GÉNERO</small><strong>{genderLabel}</strong></div></div></div>{state?.admin && <div className="directory-cover-actions"><Link href="/jugadores/editar">+ Añadir jugador</Link></div>}<div className="players-directory-diagonals" aria-hidden="true"><span/><span/><span/></div></section>
      <div className="catalog-content players-directory-content">
        {notice && <p className="catalog-notice" role="status">{notice}</p>}
        {!state && !notice && <div className="catalog-loading">Cargando jugadores…</div>}
        {state && !state.configured && <section className="catalog-warning"><b>Conexión pendiente</b><span>La pantalla está lista, pero no encuentra las variables de Supabase.</span></section>}
        {state?.configured && <>
          {!state.admin && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Revisión de jugadores</h2><span>Inicia sesión en Catálogos para consultar las fichas, las temporadas y los datos privados.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
          <section className="directory-filter-toolbar player-directory-toolbar">{!isLikid && null}<label className="player-year-filter player-year-select selected"><select value={edition} onChange={(event) => setEdition(event.target.value)} aria-label="Filtrar por año"><option value="all">Todos los años</option>{editions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label className="player-year-filter player-gender-select selected"><select value={gender} onChange={(event) => setGender(event.target.value as "all" | "M" | "F")} aria-label="Filtrar por género"><option value="all">Todos los géneros</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>{state.admin && <label className="player-year-filter player-publication-select selected"><select value={publicationFilter} onChange={(event) => setPublicationFilter(event.target.value as "all" | "published" | "hidden")} aria-label="Filtrar por publicación"><option value="all">Todos los estados</option><option value="published">Públicos</option><option value="hidden">Ocultos</option></select></label>}{state.admin && <Link href={filteredPlayersExportUrl} download="ctrugby-jugadores-filtrados.xlsx" className="player-filter-excel-action" title="Exportar jugadores filtrados a Excel" aria-label="Exportar jugadores filtrados a Excel"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2"/></svg></Link>}<label className="directory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={state.admin ? "Buscar jugador, JUG ID o club…" : "Buscar jugador o club…"} aria-label="Buscar jugador o club" /></label></section>
          <section className={`player-directory-list federation-profile-players ${state.admin ? "is-admin" : "is-public"}${isLikid ? " is-likid" : ""}`}>
            <div className="player-directory-columns federation-profile-players-columns grid gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500 shadow-sm sm:px-6">
              <span aria-hidden="true" /><button type="button" className="player-directory-sort text-left" onClick={() => order("player")}><span>JUGADOR</span><small aria-hidden="true">{sortMark("player")}</small></button><button type="button" className="player-directory-sort text-left" onClick={() => order("club")}><span>CLUB</span><small aria-hidden="true">{sortMark("club")}</small></button><button type="button" className="player-directory-sort text-center" onClick={() => order("national")}><span>NAC.</span><small aria-hidden="true">{sortMark("national")}</small></button><button type="button" className="player-directory-sort text-center" onClick={() => order("regional")}><span>REG.</span><small aria-hidden="true">{sortMark("regional")}</small></button><button type="button" className="player-directory-sort text-center" onClick={() => order("milestones")}><span>HITOS</span><small aria-hidden="true">{sortMark("milestones")}</small></button><button type="button" className="player-directory-sort text-center" onClick={() => order("news")}><span>NEWS</span><small aria-hidden="true">{sortMark("news")}</small></button>{state.admin && <button type="button" className="player-directory-sort text-center" onClick={() => order("status")}><span>ESTADO</span><small aria-hidden="true">{sortMark("status")}</small></button>}<span aria-hidden="true" />
            </div>
            <ul className="divide-y divide-neutral-200">{rows.map(({ player, currentClub, currentClubName, positionText }) => {
              const regionalFederation = player.selected_federation_ids?.find((id) => id.startsWith("FT"));
              const milestoneCount = player.milestone_count ?? 0;
              return <li key={player.id} className="player-directory-columns grid items-center gap-2 px-5 py-3 sm:px-6"><span className="image-hover-preview player-photo relative flex h-10 w-10 items-center justify-center overflow-visible rounded-full bg-neutral-100 text-xs font-black text-neutral-500"><i aria-hidden="true" className="not-italic">{player.first_name.slice(0, 1)}</i><img src={playerPhotoUrl(state, player.id)} alt={`Foto de ${fullName(player)}`} className="image-hover-preview-image absolute inset-0 h-full w-full rounded-full object-cover" onLoad={(event) => { event.currentTarget.parentElement?.classList.add("has-photo", "has-image"); }} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.remove("has-photo", "has-image"); }} /></span><div className="min-w-0"><Link href={`/jugadores/${player.id}`} className="block truncate leading-tight font-bold hover:text-red-700">{player.first_name}{player.last_name && <> <span data-client-surname>{player.last_name}</span></>}{state.admin && <span className="ml-2 font-mono text-xs font-semibold text-neutral-500">{player.id}</span>}</Link><small className="mt-1 block truncate text-xs text-neutral-500">{[player.profile?.category, rugbyPositionLabel(positionText)].filter(Boolean).join(" · ")}</small></div><span className="player-directory-club-cell">{currentClub ? <>{clubShieldUrl(currentClub.id) && <Link href={`/clubs/${currentClub.id}`} className="club-player-selection image-hover-preview shrink-0" title={currentClub.name}><img src={clubShieldUrl(currentClub.id)!} alt={`Escudo de ${currentClub.name}`} className="image-hover-preview-image" /></Link>}<span className="player-directory-club-detail"><Link href={`/clubs/${currentClub.id}`} className="block truncate font-semibold hover:text-red-700">{currentClub.name}</Link><small>{currentClub.city ?? currentClub.province ?? currentClub.country ?? ""}</small></span></> : currentClubName ? <span className="player-directory-club-detail"><b className="block truncate font-semibold">{currentClubName}</b><small>Club de referencia</small></span> : "—"}</span><span className="club-player-federation">{player.selected_federation_ids?.includes("FN003") ? <Link href="/federaciones/FN003" className="club-player-selection national image-hover-preview" title="Seleccionado por la Federación Española"><img src={federationShieldUrl("FN003") ?? ""} alt="Federación nacional" className="image-hover-preview-image" /></Link> : "—"}</span><span className="club-player-federation">{regionalFederation ? <Link href={`/federaciones/${regionalFederation}`} className="club-player-selection territorial image-hover-preview" title="Seleccionado por una federación regional"><img src={federationShieldUrl(regionalFederation) ?? ""} alt="Federación regional" className="image-hover-preview-image" /></Link> : "—"}</span><span className="flex justify-center">{milestoneCount > 0 ? <span role="img" aria-label={`${milestoneCount} hito${milestoneCount === 1 ? "" : "s"} asociado${milestoneCount === 1 ? "" : "s"}`} title={`${milestoneCount} hito${milestoneCount === 1 ? "" : "s"} asociado${milestoneCount === 1 ? "" : "s"}`} className="text-red-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] stroke-current" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></svg></span> : "—"}</span><span className="flex justify-center">{player.news_count ? <span role="img" aria-label={`${player.news_count} noticia${player.news_count === 1 ? "" : "s"}`} title={`${player.news_count} noticia${player.news_count === 1 ? "" : "s"}`} className="text-red-600"><Newspaper size={18} aria-hidden="true" /></span> : "—"}</span><span className="player-publication-status">{state.admin ? <select className={player.published ? "player-publication-select is-public" : "player-publication-select"} value={player.published ? "published" : "hidden"} aria-label={`Estado de publicación de ${fullName(player)}`} onChange={(event) => void updatePublication(player, event.target.value as "published" | "hidden")}><option value="published">Público</option><option value="hidden">Oculto</option></select> : <span className={player.published ? "player-publication-badge is-public" : "player-publication-badge"}>{player.published ? "Público" : "Oculto"}</span>}</span><span className="player-publication-actions">{state.admin ? player.published ? null : <DeleteButton type="button" className="delete" title={`Eliminar ${fullName(player)}`} aria-label={`Eliminar ${fullName(player)}`} onClick={() => void deleteHiddenPlayer(player)} confirmationHandled /> : <Link href={`/jugadores/${player.id}`} aria-label={`Abrir ficha de ${fullName(player)}`}>↗</Link>}</span></li>;
            })}</ul>
            {!rows.length && <div className="catalog-empty">No hay jugadores que coincidan con estos filtros.</div>}
          </section>
          {historyPlayer && <section className="player-history-panel"><header><div><p>HISTORIAL PRIVADO DE CLUBS</p><h2>{fullName(historyPlayer)}</h2></div><button className="catalog-logout" onClick={() => { setHistoryPlayer(null); setHistory(null); }}>Cerrar</button></header>{history === null ? <p>Cargando historial…</p> : history.length ? <ul>{history.map((club) => <li key={club.club_id}><b>{club.club_name}</b><span>{[club.city, club.country].filter(Boolean).join(", ") || club.club_id}</span><small>{club.participation_count} participaciones registradas</small></li>)}</ul> : <p>No hay relaciones de club verificadas para esta ficha.</p>}</section>}
        </>}
      </div>
    </section></div>
  </main>;
}
