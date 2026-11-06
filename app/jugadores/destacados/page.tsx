"use client";
/* eslint-disable @next/next/no-img-element */

import { currentClubSeason } from "@/lib/current-club";
import { PlayerActivityLink } from "@/app/components/player-activity-link";
import { PlayerNewsPanel } from "@/app/jugadores/[id]/player-news";
import type { PlayerNews } from "@/lib/player-news";
import { FeaturedOrderTable } from "@/app/destacados/featured-order-table";
import { compareFeaturedPlayers } from "@/app/destacados/featured-order";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { groupSearchNames, type ClubGroupMembership } from "@/app/lib/club-group-membership";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "@/lib/sport-navigation";
import { sportScope } from "@/lib/sport-routes";
import { ManagerMenu } from "@/app/components/manager-menu";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";

type Profile = { category: string | null; birth_year: number | null };
type ProfessionalClubRecord = { id: string; club_name: string; club_id: string | null; category: string; category_id?: string | null; season_label: string | null };
type Player = { club_groups?: ClubGroupMembership[]; id: string; first_name: string; last_name: string | null; published: boolean; version: number; profile?: Profile | null; participation_count?: number; milestone_count?: number; selected_federation_ids?: string[]; selected_federation_counts?: Record<string, number>; professional_clubs?: string[]; professional_club_records?: ProfessionalClubRecord[] };
type PlayerSeason = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null; playing_category?: string | null; competition_category?: string | null };
type ClubRef = { id: string; name: string; country: string | null; city?: string | null; region?: string | null; province?: string | null };
type State = { configured: boolean; admin: boolean; source?: string; players: Player[]; seasons?: PlayerSeason[]; clubs?: ClubRef[]; photos?: Record<string, string> };
type SummaryFilter = "all" | "professional" | "national" | "regional";

const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");
const playerPhotoUrl = (state: State, playerId: string) => state.source === "likidhub" ? `/api/jugadores/foto/${encodeURIComponent(playerId)}` : state.photos?.[playerId] ?? `/api/jugadores/foto/${playerId}`;
const genderLabel = (category?: string | null) => category === "F" ? "Femenino" : category === "M" ? "Masculino" : null;
const federationCount = (player: Player, id: string) => player.selected_federation_counts?.[id] ?? 0;
const seasonLabel = (year: number) => `${String(year - 1).slice(-2)}/${String(year).slice(-2)}`;
const compactSeasonLabel = (value?: string | null) => value?.replace(/(\d{4})\/(\d{2,4})/g, (_, start: string, end: string) => `${start.slice(-2)}/${end.slice(-2)}`) ?? null;
const categoryShieldUrl = (id?: string | null) => id ? `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo` : null;

type TrajectoryGroup = { clubId: string | null; name: string; seasons: PlayerSeason[] };
function TrajectorySummary({ groups, playerId, professionalRecords }: { groups: TrajectoryGroup[]; playerId: string; professionalRecords: ProfessionalClubRecord[] }) {
  const categories = (seasons: PlayerSeason[], key: "playing_category" | "competition_category") => [...new Set(seasons.map((season) => season[key]).filter(Boolean))].join(" / ") || "Sin registrar";
  return <section className="mt-4 w-full min-w-0" aria-label="Trayectoria resumida">
    <h2 className="mb-2 text-[11px] font-black tracking-widest text-neutral-800">TRAYECTORIA</h2>
    {groups.length ? <ul className="grid gap-2">{groups.map((group) => {
      const latest = group.seasons[0].season_year;
      const earliest = group.seasons[group.seasons.length - 1].season_year;
      const shield = group.clubId ? clubShieldUrl(group.clubId) : null;
      const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
      const professionalShields = [...new Map(professionalRecords.filter((record) => {
        const sameClub = record.club_id && group.clubId ? record.club_id === group.clubId : normalize(record.club_name) === normalize(group.name);
        const season = compactSeasonLabel(record.season_label);
        return sameClub && group.seasons.some((item) => seasonLabel(item.season_year) === season);
      }).filter((record) => record.category_id).map((record) => [record.category_id!, record])).values()];
      return <li key={latest}><Link href={`/jugadores/${playerId}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 hover:border-red-300">
        <span className="grid w-24 shrink-0 gap-1 text-[11px] leading-snug"><b>{earliest === latest ? seasonLabel(latest) : `${seasonLabel(earliest)} – ${seasonLabel(latest)}`}</b><span title="Categoría">{categories(group.seasons, "playing_category")}</span><span className="text-neutral-500" title="Categoría profesional">{categories(group.seasons, "competition_category")}</span></span>
        <span className="flex shrink-0 flex-wrap items-center justify-center gap-1">
          {professionalShields.map((record) => <img key={record.category_id} src={categoryShieldUrl(record.category_id)!} alt={"Escudo de " + record.category} title={record.category} className="h-7 w-7 shrink-0 object-contain" />)}
          {shield && <img src={shield} alt="" className="h-8 w-8 shrink-0 object-contain" />}
        </span>
        <b className="min-w-0 flex-1 break-words text-xs font-black">{group.name}</b><span aria-hidden="true">›</span>
      </Link></li>;
    })}</ul> : <p className="text-xs text-neutral-500">Sin temporadas registradas.</p>}
  </section>;
}

function FederationBadge({ id, count, playerId }: { id: string; count: number; playerId: string }) {
  return <PlayerActivityLink playerId={playerId} kind="convocatorias" federation={id} aria-label={"Ver " + count + " convocatorias de " + id} className="inline-flex h-12 w-fit items-center gap-2 rounded-full border border-neutral-300 bg-white px-2.5 py-2 shadow-sm">
    {federationShieldUrl(id) && <img src={federationShieldUrl(id)!} alt={`Escudo ${id}`} className="h-11 w-11 shrink-0 object-contain" />}
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-sm font-black text-white">{count}</span>
  </PlayerActivityLink>;
}

export default function SelectedPlayersPage() {
  const pathname = usePathname();
  const clientScope = sportScope(pathname);
  const isLikid = !clientScope || clientScope === "likid";
  const isCtrugby = clientScope === "ctrugby";
  const clientTerms = useMemo(() => (clientScope ?? "").split("-").filter((term) => term.length > 2 && !["rugby", "club", "likid", "ctrugby"].includes(term)), [clientScope]);
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [activeFilter, setActiveFilter] = useState<SummaryFilter>("all");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [featuredOrder, setFeaturedOrder] = useState<string[]>([]);
  const [publishedNews, setPublishedNews] = useState<PlayerNews[]>([]);
  const orderPositions = useMemo(() => new Map(featuredOrder.map((id, index) => [id, index])), [featuredOrder]);


  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    setNotice("Preparando PDF de destacados...");
    try {
      const response = await fetch("/api/seleccionados/pdf", { cache: "no-store" });
      if (!response.ok) throw new Error("No se ha podido preparar el PDF.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "ctrugby-destacados.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("");
    } catch {
      setNotice("No se ha podido descargar el PDF. Inténtalo de nuevo.");
    } finally {
      setPdfBusy(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load<T>(url: string): Promise<T> {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se han podido cargar los destacados Rugby. Recarga para reintentar.");
      return data as T;
    }
    void load<State>("/api/jugadores?view=public&trajectory=summary")
      .then((data) => { if (!controller.signal.aborted) setState(data); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error.message); });
    void Promise.allSettled([
      load<{ order: string[] }>("/api/destacados/order").then((data) => { if (!controller.signal.aborted) setFeaturedOrder(data.order); }),
      load<{ news: PlayerNews[] }>("/api/noticias?view=published").then((data) => { if (!controller.signal.aborted) setPublishedNews(data.news); }),
    ]).then((results) => {
      if (!controller.signal.aborted && results.some((result) => result.status === "rejected")) {
        setNotice((previous) => previous || "No se han podido cargar las noticias o el orden personalizado. Recarga para reintentar.");
      }
    });
    return () => controller.abort();
  }, []);

  const newsByPlayer = useMemo(() => {
    const result = new Map<string, PlayerNews[]>();
    for (const item of publishedNews) if (item.published) result.set(item.player_id, [...(result.get(item.player_id) ?? []), item]);
    return result;
  }, [publishedNews]);
  const seasonsByPlayer = useMemo(() => {
    const rows = new Map<string, PlayerSeason[]>();
    for (const season of state?.seasons ?? []) rows.set(season.player_id, [...(rows.get(season.player_id) ?? []), season]);
    return rows;
  }, [state?.seasons]);
  const clubsById = useMemo(() => new Map((state?.clubs ?? []).map((club) => [club.id, club])), [state?.clubs]);
  const scopedPlayers = useMemo(() => (state?.players ?? []).filter((player) => {
    if (isLikid) return true;
    if (isCtrugby) return (player.participation_count ?? 0) > 0;
    const seasons = seasonsByPlayer.get(player.id) ?? [];
    const clubs = [
      ...groupSearchNames(player.club_groups),
      ...seasons.map((season) => season.club_id ? clubsById.get(season.club_id)?.name ?? "" : season.legacy_club_name ?? ""),
    ].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
    return clientTerms.length > 0 && clientTerms.some((term) => clubs.includes(term));
  }), [clientTerms, clubsById, isCtrugby, isLikid, seasonsByPlayer, state?.players]);
  const allSelected = useMemo(() => scopedPlayers.filter((player) => (player.selected_federation_ids?.length ?? 0) > 0 || (player.milestone_count ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0), [scopedPlayers]);
  const summaryStats = useMemo(() => [
    { key: "all" as const, label: "Total", value: allSelected.length },
    { key: "professional" as const, label: "Clubs Pro.", value: allSelected.filter((player) => (player.professional_club_records?.length ?? 0) > 0).length },
    { key: "national" as const, label: "Fed. Nac.", value: allSelected.filter((player) => (player.selected_federation_ids ?? []).some((id) => id.startsWith("FN"))).length },
    { key: "regional" as const, label: "Fed. Reg.", value: allSelected.filter((player) => (player.selected_federation_ids ?? []).some((id) => id.startsWith("FT"))).length },
  ], [allSelected]);
  const hasGenderData = allSelected.some((player) => Boolean(player.profile?.category));
  const rows = useMemo(() => allSelected.map((player) => {
    const seasons = [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year);
    const currentSeason = currentClubSeason(seasons);
    const currentClub = currentSeason?.club_id ? clubsById.get(currentSeason.club_id) ?? null : null;
    const currentClubName = currentClub?.name ?? currentSeason?.legacy_club_name ?? null;
    const trajectoryGroups: TrajectoryGroup[] = [];
    for (const season of seasons) {
      const name = (season.club_id ? clubsById.get(season.club_id)?.name : null) ?? season.legacy_club_name ?? "Sin club";
      const previous = trajectoryGroups.at(-1);
      if (previous && previous.clubId === season.club_id && previous.name === name) previous.seasons.push(season);
      else trajectoryGroups.push({ clubId: season.club_id, name, seasons: [season] });
    }
    const professionalClubs = [...new Set((player.professional_clubs ?? []))].sort((a, b) => a.localeCompare(b, "es"));
    const nationalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FN"));
    const regionalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FT"));
    const nationalCount = nationalFederations.reduce((total, id) => total + federationCount(player, id), 0);
    const regionalCount = regionalFederations.reduce((total, id) => total + federationCount(player, id), 0);
    return { player, currentSeason, currentClub, currentClubName, trajectoryGroups, professionalClubs, professionalClubRecords: player.professional_club_records ?? [], nationalFederations, regionalFederations, nationalCount, regionalCount };
  }).filter((row) => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    const searchable = [...groupSearchNames(row.player.club_groups), row.player.id, fullName(row.player), genderLabel(row.player.profile?.category), row.currentClubName ?? "", ...row.professionalClubs, ...(row.player.selected_federation_ids ?? [])].join(" ").toLocaleLowerCase("es-ES");
    return !text || searchable.includes(text);
  }).filter((row) => {
    return gender === "all" || row.player.profile?.category === gender;
  }).filter((row) => {
    if (activeFilter === "professional") return row.professionalClubRecords.length > 0;
    if (activeFilter === "national") return row.nationalCount > 0;
    if (activeFilter === "regional") return row.regionalCount > 0;
    return true;
  }).sort((a, b) => {
    return compareFeaturedPlayers(a.player, b.player, orderPositions);
  }), [activeFilter, allSelected, clubsById, gender, query, seasonsByPlayer, orderPositions]);
  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand">{!isLikid && <Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority />}<span><strong>RUGBY - HUB</strong><small>Base de datos</small></span></Link><ManagerMenu current="selected" /></header>
    <div className="catalog-shell"><section className="catalog-workspace">
      <section className="players-directory-cover selected-players-cover">{isCtrugby && <span className="directory-cover-world-rugby"><img src="/ctrugby-player-logo.png" alt="CTRugby" /></span>}<a href="/api/destacados/hoja" download="ctrugby-destacados.xlsx" className="federation-excel-action selected-excel-download" title="Exportar destacados a Excel con foto" aria-label="Exportar destacados a Excel con foto"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2" /></svg></a><button type="button" onClick={downloadPdf} disabled={pdfBusy} className="federation-excel-action" title={pdfBusy ? "Preparando PDF" : "Descargar destacados en PDF"} aria-label={pdfBusy ? "Preparando PDF" : "Descargar destacados en PDF"}>{pdfBusy ? <span className="selected-pdf-loading">PDF</span> : <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M12 11v6" /><path d="m8.5 14.5 3.5 3.5 3.5-3.5" /></svg>}</button><div className="players-directory-cover-copy"><p className="players-directory-eyebrow"><i />Rugby - Jugadores destacados</p><h1>DESTACADOS<strong>RUGBY</strong></h1></div><div className="players-directory-diagonals" aria-hidden="true"><span /><span /><span /></div></section>
      <div className="catalog-content players-directory-content">
        {notice && <p className="catalog-notice" role="status">{notice}</p>}
        {!state && !notice && <div className="catalog-loading">Cargando destacados...</div>}
        {state && !state.configured && <section className="catalog-warning"><b>Conexión pendiente</b><span>La pantalla está lista, pero no encuentra las variables de Supabase.</span></section>}
        {state?.configured && <>
          {state.admin && <FeaturedOrderTable players={allSelected} order={featuredOrder} onSaved={setFeaturedOrder} />}
          <section className="grid grid-cols-4 gap-2">{summaryStats.map((item) => <button type="button" key={item.key} onClick={() => setActiveFilter(item.key)} aria-pressed={activeFilter === item.key} className={`rounded-[8px] border px-3 py-2 text-left shadow-sm ${activeFilter === item.key ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"}`}><b className="block text-xl font-black leading-none text-neutral-950">{item.value}</b><span className="mt-1 block truncate text-[10px] font-black uppercase tracking-[.08em] text-neutral-500">{item.label}</span></button>)}</section><p className="rounded-[8px] border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-600 shadow-sm">Jugadores que han sido convocados al menos una vez por una federación o que tienen registro en clubs profesionales.</p>
          <section className="directory-filter-toolbar player-directory-toolbar">{hasGenderData && <label className="player-year-filter player-gender-select selected"><select value={gender} onChange={(event) => setGender(event.target.value as "all" | "M" | "F")} aria-label="Filtrar por género"><option value="all">Todos los géneros</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>}<label className="directory-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugador, club o selección..." aria-label="Buscar destacado" /></label></section>
          <section className="grid gap-3 xl:grid-cols-2">{rows.map((row) => <article key={row.player.id} id={"player-activity-" + row.player.id} className="grid grid-cols-[minmax(0,1fr)_120px] gap-4 rounded-[8px] sm:grid-cols-[minmax(0,1fr)_160px] border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 flex-col items-start gap-3"><span className="relative flex aspect-square w-56 max-w-full items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-5xl font-black text-neutral-400"><i aria-hidden="true" className="not-italic">{row.player.first_name.slice(0, 1)}</i><img src={playerPhotoUrl(state, row.player.id)} alt={`Foto de ${fullName(row.player)}`} className="absolute inset-0 h-full w-full rounded-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span><div className="w-full min-w-0"><Link href={`/jugadores/${row.player.id}`} className="selected-player-name"><span>{row.player.first_name}</span>{row.player.last_name && <strong>{row.player.last_name}</strong>}</Link><p className="mt-1 text-xs font-semibold text-neutral-600">{[genderLabel(row.player.profile?.category), row.player.profile?.birth_year ? `Nac. ${row.player.profile.birth_year}` : null, rugbyPositionLabel(row.currentSeason?.position_text ?? null)].filter(Boolean).join(" · ")}</p>{state.admin && <div className="mt-3"><Link href={`/jugadores/${row.player.id}`} className="rounded-[8px] border border-neutral-300 px-3 py-1.5 text-xs font-black text-neutral-800">Editar ficha</Link> <span className="inline-flex flex-col items-center gap-1 align-top"><button type="button" disabled title="Próximamente: buscar noticias y convocatorias para revisar en el chat" className="inline-flex items-center gap-1 rounded-[8px] border border-neutral-200 px-3 py-1.5 text-xs font-black text-neutral-400 disabled:cursor-not-allowed"><span aria-hidden="true">♻</span> Actualizar</button><small className="text-[10px] font-normal text-neutral-500">Última actualización: 28/10/2026</small></span></div>}</div></div>
            <div className="flex flex-col items-center gap-2 border-l border-neutral-100 pl-3 text-center"><p className="mt-1 w-full text-center text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">Convocatorias</p>{row.nationalFederations.map((id) => <FederationBadge key={id} id={id} count={federationCount(row.player, id)} playerId={row.player.id} />)}{row.regionalFederations.map((id) => <FederationBadge key={id} id={id} count={federationCount(row.player, id)} playerId={row.player.id} />)}<p className="w-full text-center text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">Participaciones</p><PlayerActivityLink playerId={row.player.id} kind="participaciones" className="selected-participation-badge" aria-label={"Ver participaciones de " + fullName(row.player)}><span className="flex max-w-24 flex-wrap items-center justify-center gap-1">{[...new Map((newsByPlayer.get(row.player.id) ?? []).filter((item) => item.type === "participacion" && item.participation?.kind === "campus" && item.participation.campus_id).map((item) => [item.participation!.campus_id!, item])).values()].map((item) => <img key={item.participation!.campus_id} src={item.image_url ?? `/api/hitos/profesionales/categorias/${encodeURIComponent(item.participation!.campus_id!)}/escudo`} alt={`Escudo de ${item.title.replace(/ · \d{4}$/, "")}`} title={item.title.replace(/ · \d{4}$/, "")} className="!h-9 !w-9 !object-contain" />)}</span><b>{row.player.participation_count ?? 0}</b></PlayerActivityLink><PlayerNewsPanel playerId={row.player.id} admin={state.admin} initialNews={newsByPlayer.get(row.player.id) ?? []} /></div>
            <div className="col-span-full min-w-0 border-t border-neutral-100 pt-1"><TrajectorySummary groups={row.trajectoryGroups} playerId={row.player.id} professionalRecords={row.professionalClubRecords} /></div>
          </article>)}</section>
          {!rows.length && <div className="catalog-empty">No hay destacados Rugby que coincidan con estos filtros.</div>}
        </>}
      </div>
    </section></div>
  </main>;
}



















