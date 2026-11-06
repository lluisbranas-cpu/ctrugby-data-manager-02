/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { groupSearchNames, type ClubGroupMembership } from "@/app/lib/club-group-membership";
import { Pencil } from "lucide-react";
import { useParams } from "@/lib/sport-navigation";
import { useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { JerseyGallery } from "@/app/components/jersey-gallery";
import { worldRugbyAffiliation } from "@/app/lib/world-rugby";
import { EntityPagination } from "@/app/components/entity-pagination";
import { countryFlagCode } from "@/app/lib/country-flag";
import { regionalFlagUrl } from "@/app/lib/regional-flag";
import { FederationCoverActions } from "@/app/components/federation-cover-actions";

type Federation = { id: string; name: string; scope: string; territory: string; country: string; sports?: string[]; world_rugby_affiliation?: "miembro" | "no_aplica" | "pendiente"; website: string | null; email?: string | null; player_count: number | null; participation_count: number | null; selection_player_count: number | null; club_count: number; ctrugby_club_count: number | null };
type FederationPlayer = { club_groups?: ClubGroupMembership[]; id: string; first_name: string; last_name: string | null; category: string | null; position_text: string | null; season_year: number | null; club_id: string | null; club_name: string | null; federation_id: string | null; federation_name: string | null; participation_count: number; milestone_count?: number; professional_club_count?: number; selected_federation_ids?: string[]; selected_federation_years?: Record<string, number[]> };

const fullName = (player: FederationPlayer) => [player.first_name, player.last_name].filter(Boolean).join(" ");
type PlayerSortKey = "participation" | "player" | "affiliation" | "national" | "regional" | "milestones";

export default function FederationProfilePage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const [federation, setFederation] = useState<Federation | null>(null);
  const [players, setPlayers] = useState<FederationPlayer[] | null>(null);
  const [federationEntries, setFederationEntries] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const [admin, setAdmin] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [playerScope] = useState<"ctrugby" | "all">("all");
  const [edition, setEdition] = useState("all");
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [sort, setSort] = useState<{ key: PlayerSortKey; direction: 1 | -1 }>({ key: "participation", direction: -1 });

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/federaciones?players=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "No se ha podido abrir la federación.");
        const item = (data.federations as Federation[]).find((candidate) => candidate.id === id) ?? null;
        if (!item) throw new Error("La federación no existe o ya no está publicada.");
        if (!controller.signal.aborted) { setFederation(item); setFederationEntries((data.federations as Federation[]).map(({ id: federationId, name }) => ({ id: federationId, name }))); setPlayers(data.federationPlayers ?? []); setAdmin(Boolean(data.admin)); }
      })
      .catch((cause: Error) => { if (!controller.signal.aborted) { setError(cause.message); setPlayers([]); } });
    return () => controller.abort();
  }, [id]);

  const editions = [2026, 2025, 2024, 2023, 2022];
  const selectedFederationId = federation?.scope === "Nacional" ? federation.id : id;
  const nationalCounterId = federation?.scope === "Nacional" ? federation.id : "FN003";
  const selectedYearsFor = (player: FederationPlayer, federationId: string) => player.selected_federation_years?.[federationId] ?? [];
  const selectedForCurrentFederation = (player: FederationPlayer) => player.selected_federation_ids?.includes(selectedFederationId) ?? false;
  const hasNationalSelection = (player: FederationPlayer) => player.selected_federation_ids?.some((selectionId) => selectionId.startsWith("FN")) ?? false;
  const nationalSelectionIdForPlayer = (player: FederationPlayer) => player.selected_federation_ids?.find((selectionId) => selectionId.startsWith("FN"));
  const filteredPlayers = (players ?? []).filter((player) => {
    const selectedForCurrent = selectedForCurrentFederation(player);
    if (playerScope === "ctrugby" && player.participation_count <= 0 && !selectedForCurrent && !(player.professional_club_count && player.professional_club_count > 0)) return false;
    if (edition !== "all") {
      const selectedInSelectedYear = selectedForCurrent && selectedYearsFor(player, selectedFederationId).includes(Number(edition));
      if (String(player.season_year ?? "") !== edition && !selectedInSelectedYear) return false;
    }
    if (gender !== "all" && player.category !== gender) return false;
    const text = query.trim().toLocaleLowerCase("es-ES");
    return !text || [...groupSearchNames(player.club_groups, edition), player.id, player.first_name, player.last_name ?? "", player.category ?? "", player.club_name ?? "", player.federation_name ?? ""].join(" ").toLocaleLowerCase("es-ES").includes(text);
  });
  const visiblePlayers = [...filteredPlayers].sort((a, b) => {
    const sortValue = (player: FederationPlayer) => sort.key === "participation" ? player.participation_count : sort.key === "player" ? `${player.last_name ?? ""} ${player.first_name}` : sort.key === "national" ? Number(hasNationalSelection(player)) : sort.key === "regional" ? Number(player.selected_federation_ids?.some((selectionId) => !selectionId.startsWith("FN"))) : sort.key === "milestones" ? player.milestone_count ?? 0 : player.club_name ?? "";
    const aValue = sortValue(a);
    const bValue = sortValue(b);
    const comparison = typeof aValue === "number" && typeof bValue === "number" ? aValue - bValue : String(aValue).localeCompare(String(bValue), "es");
    return comparison * sort.direction;
  });
  const playerScopeNote = "Los contadores y listados incluyen los jugadores vinculados a la federación.";
  const filteredCounterStats = filteredPlayers.reduce((totals, player) => {
    totals.players += 1;
    totals.participations += player.participation_count;
    if (player.club_id && (player.participation_count > 0 || (player.professional_club_count && player.professional_club_count > 0))) totals.clubIds.add(player.club_id);
    if (hasNationalSelection(player)) totals.nationalPlayers += 1;
    if (federation?.scope === "Territorial" && player.selected_federation_ids?.includes(federation.id)) totals.regionalPlayers += 1;
    return totals;
  }, { players: 0, participations: 0, clubIds: new Set<string>(), nationalPlayers: 0, regionalPlayers: 0 });
  const nationalCounterPlayers = filteredCounterStats.nationalPlayers;
  const regionalCounterPlayers = filteredCounterStats.regionalPlayers;
  const order = (key: PlayerSortKey) => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : key === "player" || key === "affiliation" ? 1 : -1 }));
  const sortMark = (key: PlayerSortKey) => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  return <main className="directory-app min-h-screen">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="federations" /></header>
    {error ? <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-8"><p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</p></div> : !federation ? <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-8"><p className="rounded-xl bg-white p-5 text-neutral-500 shadow-sm">Cargando ficha de federación…</p></div> : <>
      <section className="directory-cover" style={{ backgroundImage: `linear-gradient(90deg, rgba(250,251,251,.99) 0%, rgba(250,251,251,.94) 48%, rgba(250,251,251,.58) 100%), url(/api/federaciones/portada/${federation.id}?v=${coverVersion})`, backgroundSize: "cover", backgroundPosition: "center" }}>{admin && <Link href={`/federaciones/${federation.id}/editar`} aria-label="Editar ficha de federacion" title="Editar ficha" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><Pencil size={17} aria-hidden="true" /></Link>}<span className="directory-cover-world-rugby federation-profile-shield">{federationShieldUrl(federation.id) ? <img src={federationShieldUrl(federation.id)!} alt={`Escudo de ${federation.name}`} className="image-hover-preview-image" /> : null}</span><div className="directory-cover-copy min-w-0"><p><i className="ctrugby-marker"/><b>Rugby</b><i/>FICHA DE FEDERACIÓN</p><h1>{federation.name}</h1><span className="federation-profile-territory">{federation.scope === "Territorial" ? regionalFlagUrl(federation.territory) && <img src={regionalFlagUrl(federation.territory)!} alt="" /> : countryFlagCode(federation.country) && <img src={`https://flagcdn.com/w40/${countryFlagCode(federation.country)}.png`} alt="" />}{federation.scope === "Territorial" ? federation.territory : federation.country}</span><dl className="federation-profile-meta"><div><dt>Deporte</dt><dd>{federation.sports?.join(" · ") || "Rugby"}</dd></div><div>{federation.website && <div><dt>Web</dt><dd><Link href={`/federaciones/${federation.id}/web`}>{federation.website.replace(/^https?:\/\//, "")}</Link></dd></div>}{federation.scope === "Nacional" && <div><dt>Afiliación</dt><dd>{worldRugbyAffiliation(federation.id, federation.scope) === "miembro" ? <Link href="/world-rugby">World Rugby</Link> : "Pendiente de comprobar"}</dd></div>}</div>{admin && federation.email && <div><dt>Email</dt><dd>{federation.email}</dd></div>}</dl>{admin && <FederationCoverActions id={federation.id} onUpdated={() => setCoverVersion(Date.now())} />}</div></section>
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-8"><EntityPagination entries={federationEntries} currentId={federation.id} hrefPrefix="/federaciones"/>
          <article className="club-record-card club-record-counters federation-profile-counter-card shadow-sm">
            <p>CONTADORES</p>
            <div className={`club-record-counter-row federation-record-counter-row ${federation.scope === "Territorial" ? "has-regional" : ""}`}>
              <div className="club-record-counter-button">
                <small>JUG.</small>
                <b>{filteredCounterStats.players}</b>
              </div>
              <div className="club-record-counter-button">
                <small>PART.</small>
                <b>{filteredCounterStats.participations}</b>
              </div>
              <Link href="/clubs" className="club-record-counter-button"><small>CLUBS</small><b>{filteredCounterStats.clubIds.size}</b></Link>
              <Link href={`/federaciones/${nationalCounterId}`} className="club-record-counter-button federation-record-selection-counter">
                <img src={federationShieldUrl(nationalCounterId) ?? ""} alt="Federación nacional" className="image-hover-preview-image" />
                <span><b>{nationalCounterPlayers}</b></span>
              </Link>
              {federation.scope === "Territorial" && <Link href={`/federaciones/${federation.id}`} className="club-record-counter-button federation-record-selection-counter">
                {federationShieldUrl(federation.id) && <img src={federationShieldUrl(federation.id)!} alt="Federación regional" className="image-hover-preview-image" />}
                <span><b>{regionalCounterPlayers}</b></span>
              </Link>}
            </div>
            <small className="club-record-counter-note">JUG. y PART.: datos Rugby desde 2023 · {federation.scope === "Territorial" ? "FED. NAC. y FED. REG.: jugadores seleccionados." : "FED. NAC.: jugadores seleccionados."}</small>
          </article>
        <JerseyGallery id={federation.id} name={federation.name} admin={admin}/>
        <section className="federation-profile-players mt-5 rounded-2xl border border-neutral-200 bg-white shadow-sm"><header className="federation-profile-players-header border-b border-neutral-200 px-5 py-4 sm:px-6"><div><p className="text-xs font-black tracking-[.14em] text-neutral-700">JUGADORES</p></div><div className="directory-filter-toolbar player-directory-toolbar flex-col !items-stretch gap-3 sm:flex-row sm:!items-center">{null}<label className="player-year-filter player-year-select selected"><select value={edition} onChange={(event) => setEdition(event.target.value)} aria-label="Filtrar por año"><option value="all">Todos los años</option>{editions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label className="player-year-filter player-gender-select selected"><select value={gender} onChange={(event) => setGender(event.target.value as "all" | "M" | "F")} aria-label="Filtrar por género"><option value="all">Todos los géneros</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label><label className="directory-search !mt-0 flex-1"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={admin ? "Buscar jugador, JUG ID, género o club…" : "Buscar jugador, género o club…"} aria-label="Buscar jugadores" /></label></div><p className="mt-2 text-xs text-neutral-500">{playerScopeNote}</p></header>{players === null ? <p className="p-6 text-sm text-neutral-500">Cargando jugadores…</p> : visiblePlayers.length ? <><div className="player-directory-columns federation-profile-players-columns grid gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500 shadow-sm sm:px-6"><button type="button" className="text-center" onClick={() => order("participation")}>PART. {sortMark("participation")}</button><span>FOTO</span><button type="button" className="text-left" onClick={() => order("player")}>JUGADOR {sortMark("player")}</button><button type="button" className="text-left" onClick={() => order("affiliation")}>CLUB {sortMark("affiliation")}</button><button type="button" className="text-center" onClick={() => order("national")}>NAC. {sortMark("national")}</button><button type="button" className="text-center" onClick={() => order("regional")}>REG. {sortMark("regional")}</button><button type="button" className="text-center" onClick={() => order("milestones")}>HITOS {sortMark("milestones")}</button></div><ul className="divide-y divide-neutral-200">{visiblePlayers.map((player) => { const nationalFederation = nationalSelectionIdForPlayer(player); const regionalFederation = player.selected_federation_ids?.find((selectionId) => !selectionId.startsWith("FN")); const milestoneCount = player.milestone_count ?? 0; return <li key={player.id} className="player-directory-columns grid items-center gap-2 px-5 py-3 sm:px-6"><span className="text-center text-base font-normal text-red-600">{player.participation_count}</span><span className="image-hover-preview player-photo relative flex h-10 w-10 items-center justify-center overflow-visible rounded-full bg-neutral-100 text-xs font-black text-neutral-500"><i aria-hidden="true" className="not-italic">{player.first_name.slice(0, 1)}</i><img src={`/api/jugadores/foto/${player.id}`} alt={`Foto de ${fullName(player)}`} className="image-hover-preview-image absolute inset-0 h-full w-full rounded-full object-cover" onLoad={(event) => { event.currentTarget.parentElement?.classList.add("has-photo", "has-image"); }} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.remove("has-photo", "has-image"); }} /></span><div className="min-w-0"><Link href={`/jugadores/${player.id}`} className="block truncate leading-tight font-bold hover:text-red-700">{fullName(player)}</Link><small className="mt-1 block truncate text-xs text-neutral-500">{admin && player.id}{admin && player.id && (player.category || player.position_text) ? " · " : ""}{[player.category, player.position_text].filter(Boolean).join(" · ")}</small></div><span className="player-directory-club-cell">{player.club_id && clubShieldUrl(player.club_id) ? <><Link href={`/clubs/${player.club_id}`} className="club-player-selection image-hover-preview shrink-0" title={player.club_name ?? player.club_id}><img src={clubShieldUrl(player.club_id)!} alt={`Escudo de ${player.club_name ?? player.club_id}`} className="image-hover-preview-image" /></Link><span className="player-directory-club-detail"><Link href={`/clubs/${player.club_id}`} className="block truncate font-semibold hover:text-red-700">{player.club_name ?? player.club_id}</Link><small>{player.season_year ?? ""}</small></span></> : "—"}</span><span className="club-player-federation">{nationalFederation ? <Link href={`/federaciones/${nationalFederation}`} className="club-player-selection national image-hover-preview" title="Seleccionado por una federación nacional"><img src={federationShieldUrl(nationalFederation) ?? ""} alt="Federación nacional" className="image-hover-preview-image" /></Link> : "—"}</span><span className="club-player-federation">{regionalFederation ? <Link href={`/federaciones/${regionalFederation}`} className="club-player-selection territorial image-hover-preview" title="Seleccionado por una federación regional"><img src={federationShieldUrl(regionalFederation) ?? ""} alt="Federación regional" className="image-hover-preview-image" /></Link> : "—"}</span><span className="flex justify-center">{milestoneCount > 0 ? <span role="img" aria-label={`${milestoneCount} hito${milestoneCount === 1 ? "" : "s"} asociado${milestoneCount === 1 ? "" : "s"}`} title={`${milestoneCount} hito${milestoneCount === 1 ? "" : "s"} asociado${milestoneCount === 1 ? "" : "s"}`} className="text-red-600"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] stroke-current" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></svg></span> : "—"}</span></li>; })}</ul></> : <p className="p-6 text-sm text-neutral-500">{playerScope === "ctrugby" ? "No hay jugadores Rugby vinculados desde 2023." : "No hay jugadores vinculados para este filtro."}</p>}</section>
        {federation.website && <Link href={`/federaciones/${federation.id}/web`} className="mt-5 inline-block rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">Web de la federación</Link>}
      </div></>}
  </main>;
}





