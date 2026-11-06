"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import type { ClubHistory } from "@/lib/club-history";
import { groupSearchNames, type ClubGroupMembership } from "@/app/lib/club-group-membership";
import { ClubPrivateAccess } from "@/app/components/club-private-access";
import Image from "next/image";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "@/lib/sport-navigation";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { ManagerMenu } from "@/app/components/manager-menu";
import { JerseyGallery } from "@/app/components/jersey-gallery";
import { ClubMediaActions } from "@/app/components/club-media-actions";
import { ClubDataEditor } from "@/app/components/club-data-editor";
import { ClubFinderMap } from "@/app/components/club-finder-map";
import { EntityPagination } from "@/app/components/entity-pagination";
import { defaultClubPalette, type ClubPalette } from "@/app/lib/club-palette";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";

type Club = {
  id: string;
  name: string;
  active: boolean;
  founded_text: string | null; disappeared_text?: string | null;
  city: string;
  province: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  maps_url: string;
  website: string | null;
  instagram: string | null;
  sports?: string[];
  history?: ClubHistory | null;
  is_temporary_group?: boolean;
  teams?: { name: string; gender: "M" | "F"; category: string; league: string; source_url: string }[];
};
type Player = {
  club_groups?: ClubGroupMembership[];
  id: string;
  first_name: string;
  last_name: string | null;
  category: string | null;
  birth_year?: number | null;
  position_text: string | null;
  roster_category?: string;
  current_club?: boolean;
  season_year?: number | null;
  club_seasons?: { season_year: number; position_text: string | null }[];
  participation_count: number;
  milestone_count: number;
  selected_federation_ids: string[];
};
type State = {
  admin: boolean;
  group_members?: { id: string; name: string }[];
  group_seasons?: string[];
  group_categories?: string[];
  club: Club;
  players: Player[];
  participation_count: number;
  selected_federation_ids: string[];
  selected_federations: { id: string; player_count: number }[];
};

export default function ClubProfilePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [state, setState] = useState<State | null>(null);
  const [clubEntries, setClubEntries] = useState<
    { id: string; name: string }[]
  >([]);
  const [query, setQuery] = useState("");
  const [groupSeason, setGroupSeason] = useState("all");
  const [groupCategory, setGroupCategory] = useState("all");
  const [playerSort, setPlayerSort] = useState<{
    key: "participation" | "player" | "national" | "regional" | "milestones";
    direction: 1 | -1;
  }>({ key: "participation", direction: -1 });
  const [failed, setFailed] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [palette, setPalette] = useState<ClubPalette>(defaultClubPalette);
  const [savingPalette, setSavingPalette] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clubs/${id}?${new URLSearchParams({ season: groupSeason, category: groupCategory })}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        return data;
      })
      .then(setState)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [id, groupSeason, groupCategory]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/clubs", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data: { clubs?: { id: string; name: string }[] }) => {
        if (!controller.signal.aborted) setClubEntries(data.clubs ?? []);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clubs/paleta/${id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data: { palette?: ClubPalette }) => {
        if (!controller.signal.aborted && data.palette)
          setPalette(data.palette);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);
  const updatePalette = async (index: number, color: string) => {
    if (!state?.admin) return;
    const next = palette.map((entry, entryIndex) =>
      entryIndex === index ? color : entry,
    ) as ClubPalette;
    setPalette(next);
    setSavingPalette(true);
    try {
      const response = await fetch(`/api/clubs/paleta/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ palette: next }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setPalette(palette);
    } finally {
      setSavingPalette(false);
    }
  };
  const players = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    return (state?.players ?? [])
      .filter(
        (player) =>
          !text ||
          `${groupSearchNames(player.club_groups, groupSeason, groupCategory).join(" ")} ${player.first_name} ${player.last_name ?? ""} ${player.category ?? ""}`
            .toLocaleLowerCase("es-ES")
            .includes(text),
      )
      .sort((a, b) => {
        const aValue =
          playerSort.key === "participation"
            ? a.participation_count
            : playerSort.key === "national"
              ? Number(a.selected_federation_ids.includes("FN003"))
              : playerSort.key === "regional"
                ? Number(
                    a.selected_federation_ids.some(
                      (federationId) => federationId !== "FN003",
                    ),
                  )
                : playerSort.key === "milestones"
                  ? a.milestone_count
                  : `${a.last_name ?? ""} ${a.first_name}`;
        const bValue =
          playerSort.key === "participation"
            ? b.participation_count
            : playerSort.key === "national"
              ? Number(b.selected_federation_ids.includes("FN003"))
              : playerSort.key === "regional"
                ? Number(
                    b.selected_federation_ids.some(
                      (federationId) => federationId !== "FN003",
                    ),
                  )
                : playerSort.key === "milestones"
                  ? b.milestone_count
                  : `${b.last_name ?? ""} ${b.first_name}`;
        const comparison =
          typeof aValue === "number" && typeof bValue === "number"
            ? aValue - bValue
            : String(aValue).localeCompare(String(bValue), "es");
        return comparison * playerSort.direction;
      });
  }, [query, state, playerSort, groupSeason, groupCategory]);
  const orderPlayers = (
    key: "participation" | "player" | "national" | "regional" | "milestones",
  ) =>
    setPlayerSort((current) => ({
      key,
      direction:
        current.key === key
          ? ((current.direction * -1) as 1 | -1)
          : key === "player"
            ? 1
            : -1,
    }));
  const playerSortMark = (key: typeof playerSort.key) =>
    playerSort.key !== key ? "↕" : playerSort.direction === 1 ? "↑" : "↓";
  const club = state?.club;
  const selectionCounters = (state?.selected_federations ?? []).filter(
    (federation) => federation.id === "FN003" || federation.id === "FT009",
  );
  if (
    club?.country === "España" &&
    !selectionCounters.some((federation) => federation.id === "FN003")
  )
    selectionCounters.unshift({ id: "FN003", player_count: 0 });
  const selectedFederationCount = selectionCounters.filter(
    (federation) => federation.player_count > 0,
  ).length;
  return (
    <main className="directory-app min-h-screen">
      <header className="catalog-topbar">
        <Link href="/" className="catalog-brand">
          <Image
            src="/ctrugby-logo-contrast.webp"
            alt="CTRugby"
            width={100}
            height={54}
            priority
          />
          <span>
            <strong>RUGBY - HUB</strong>
          </span>
        </Link>
        <ManagerMenu current="clubs" />
      </header>
      <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
        {failed ? (
          <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
            No se ha podido cargar esta ficha.
          </p>
        ) : !club ? (
          <p className="p-5 text-neutral-500">Cargando ficha de club…</p>
        ) : (
          <>
            {id === "ESP0022" && <Link href={`/clubs/${id}/equipos`} className="mb-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">Rugby Cabrera · Nuestros equipos →</Link>}
            {id === "ESP0023" && <Link href={`/clubs/${id}/equipos`} className="mb-4 inline-flex rounded-lg bg-sky-800 px-4 py-2 text-sm font-bold text-white">Rugby Badalona · Nuestros equipos →</Link>}
            {id === "ESP0010" && <Link href={`/clubs/${id}/equipos`} className="mb-4 inline-flex rounded-lg bg-green-900 px-4 py-2 text-sm font-bold text-white">Rugby Alella · Nuestros equipos →</Link>}
            <EntityPagination
              entries={clubEntries}
              currentId={club.id}
              hrefPrefix="/clubs"
            />
            <section
              className="club-profile-cover"
              style={
                {
                  "--club-cover-one": palette[0],
                  "--club-cover-two": palette[1],
                  "--club-cover-three": palette[2],
                  backgroundImage: `linear-gradient(90deg, rgba(255,255,255,.99) 0%, rgba(255,255,255,.95) 44%, rgba(255,255,255,.72) 76%, rgba(255,255,255,.32) 100%), url(/api/clubs/portada/${club.id}?v=${mediaVersion})`,
                } as CSSProperties
              }
            >
              <i className="club-profile-stripes" aria-hidden="true">
                <b />
                <b />
                <b />
              </i>
              <div>
                <p>
                  <i className="ctrugby-marker" />
                  RUGBY <em /> FICHA DEL CLUB
                </p>
                <h1>{club.name.toUpperCase()}</h1>
                <span>
                  {[
                    club.city,
                    ...(club.country === "España" && club.region
                      ? [club.region]
                      : []),
                    club.country,
                  ].join(" · ")}
                </span>
                {state.admin && (
                  <ClubMediaActions
                    id={club.id}
                    onUpdated={() => setMediaVersion(Date.now())}
                    coverOnly
                  />
                )}
              </div>
              {clubShieldUrl(club.id, mediaVersion) && (
                <span className="club-profile-shield image-hover-preview">
                  <img
                    src={clubShieldUrl(club.id, mediaVersion)!}
                    alt={`Escudo de ${club.name}`}
                    className="image-hover-preview-image"
                  />
                </span>
              )}
            </section>
            {club.is_temporary_group && <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">AGRUPACIÓN TEMPORAL · {club.id}</h2><p className="mt-2 text-sm">Sin filtros se muestran todos los jugadores de los clubes adscritos. Selecciona temporada o categoría para limitar los resultados.</p><ul className="mt-3 flex flex-wrap gap-3">{state.group_members?.map(member => <li key={member.id}><Link className="underline" href={"/clubs/" + member.id}>{member.name}</Link></li>)}</ul></section>}
            {club.history && <section className="club-record-card" style={{ marginBottom: 20 }}><header><h2>HISTORIA DEL CLUB</h2></header><p>{club.history.summary}</p><p>{club.history.date_note}</p><p>{club.history.location_note}</p><h3>Fuentes</h3><ul>{club.history.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></section>}
            <section className="club-record-grid">
              <div className="club-record-details">
                <article className="club-record-card club-record-data">
                  <header>
                    <div>
                      <h2>DATOS DEL CLUB</h2>
                      <div
                        className="club-color-buttons"
                        role="group"
                        aria-label="Colores de las franjas de la portada"
                      >
                        {palette.map((color, index) => (
                          <input
                            key={index}
                            type="color"
                            value={color}
                            aria-label={`Color ${index + 1}`}
                            disabled={!state.admin || savingPalette}
                            onChange={(event) =>
                              void updatePalette(index, event.target.value)
                            }
                          />
                        ))}
                      </div>
                    </div>
                    <ClubDataEditor
                      club={club}
                      admin={state.admin}
                      palette={palette}
                      onPaletteChange={updatePalette}
                      onShieldUpdated={() => setMediaVersion(Date.now())}
                      onSaved={(updated) =>
                        setState((current) =>
                          current ? { ...current, club: { ...current.club, ...updated } } : current,
                        )
                      }
                    />
                  </header>
                  <dl>
                    <div className="club-data-full">
                      <dt>Deporte</dt>
                      <dd>{club.sports?.join(" · ") || "Rugby"}</dd>
                    </div>
                    <div className="club-data-full">
                      <dt>Fundación</dt>
                      <dd>{club.founded_text ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Estado</dt><dd>{club.active ? "Activo" : "Desaparecido / inactivo"}</dd>
                    </div>
                    {!club.active && <div><dt>Año de desaparición</dt><dd>{club.disappeared_text || "Sin confirmar"}</dd></div>}
                    <div>
                      <dt>Ciudad</dt>
                      <dd>{club.city}</dd>
                    </div>
                    <div>
                      <dt>Provincia</dt>
                      <dd>{club.province}</dd>
                    </div>
                    <div>
                      <dt>Comunidad autónoma</dt>
                      <dd>{club.region}</dd>
                    </div>
                    <div>
                      <dt>País</dt>
                      <dd>{club.country}</dd>
                    </div>
                    <div>
                      <dt>Web</dt>
                      <dd>
                        {club.website ? (
                          <a
                            href={club.website}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {club.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Instagram</dt>
                      <dd>{club.instagram ?? "—"}</dd>
                    </div>
                  </dl>
                  {Boolean(club.teams?.length) && (
                    <div className="club-team-panel club-team-panel-profile">
                      <b>Equipos</b>
                      {club.teams!.map((team) => (
                        <a key={team.name} href={team.source_url} target="_blank" rel="noreferrer">
                          <span>{team.category}</span>
                          <small>{team.league}</small>
                        </a>
                      ))}
                    </div>
                  )}
                </article>
                <article className="club-record-card club-record-counters">
                  <p>CONTADORES</p>
                  <div
                    className={`club-record-counter-row ${selectedFederationCount > 1 ? "with-multiple-selections" : ""}`}
                  >
                    <div className="club-record-counter-button">
                      <small>JUG.</small>
                      <b>{state.players.length}</b>
                    </div>
                    <div className="club-record-counter-button">
                      <small>PART.</small>
                      <b>{state.participation_count}</b>
                    </div>
                    {selectedFederationCount <= 1 &&
                      selectionCounters.map((federation) => (
                        <Link
                          key={federation.id}
                          href={`/federaciones/${federation.id}`}
                          className={`club-record-counter-button club-record-federation-button image-hover-preview ${federation.id === "FN003" ? "national" : "territorial"}`}
                          title="Jugadores del club seleccionados por esta federación"
                        >
                          <img
                            src={federationShieldUrl(federation.id) ?? ""}
                            alt="Escudo de federación"
                            className="image-hover-preview-image"
                          />
                          <b>{federation.player_count}</b>
                        </Link>
                      ))}
                  </div>
                  {selectedFederationCount > 1 && (
                    <div className="club-record-federation-row">
                      {selectionCounters.map((federation) => (
                        <Link
                          key={federation.id}
                          href={`/federaciones/${federation.id}`}
                          className={`club-record-counter-button club-record-federation-button image-hover-preview ${federation.id === "FN003" ? "national" : "territorial"}`}
                          title="Jugadores del club seleccionados por esta federación"
                        >
                          <img
                            src={federationShieldUrl(federation.id) ?? ""}
                            alt="Escudo de federación"
                            className="image-hover-preview-image"
                          />
                          <b>{federation.player_count}</b>
                        </Link>
                      ))}
                    </div>
                  )}
                  <small className="club-record-counter-note">
                    JUG. y PART.: datos Rugby desde 2023 · Federaciones:
                    jugadores seleccionados al menos una vez.
                  </small>
                </article>
              </div>
              <div className="club-record-jerseys">
                <JerseyGallery
                  id={club.id}
                  name={club.name}
                  admin={state.admin}
                />
              </div>
            </section>
            <section className="club-record-bottom">
              <article className="federation-profile-players club-profile-players club-record-card">
                <header className="federation-profile-players-header border-b border-neutral-200 px-5 py-4 sm:px-6">
                  <div>
                    <p className="text-xs font-black tracking-[.14em] text-neutral-700">
                      JUGADORES
                    </p>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    {null}
                    {club.is_temporary_group && <><label className="text-xs font-bold">Temporada<select className="block rounded border p-2" value={groupSeason} onChange={event => setGroupSeason(event.target.value)}><option value="all">Todas</option>{state.group_seasons?.map(season => <option key={season}>{season}</option>)}</select></label><label className="text-xs font-bold">Categoría<select className="block rounded border p-2" value={groupCategory} onChange={event => setGroupCategory(event.target.value)}><option value="all">Todas</option>{state.group_categories?.map(category => <option key={category}>{category}</option>)}</select></label></>}
                    <label className="directory-search !mt-0 flex-1">
                      <span aria-hidden="true">⌕</span>
                      <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar jugador…"
                        aria-label="Buscar jugadores"
                      />
                    </label>
                  </div>
                </header>
                {players.length ? (
                  <>
                    <div className="federation-profile-players-columns grid grid-cols-[48px_42px_minmax(0,1fr)_46px_46px_54px] gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500 shadow-sm sm:px-6">
                      <button
                        type="button"
                        className="text-center"
                        onClick={() => orderPlayers("participation")}
                      >
                        PART. {playerSortMark("participation")}
                      </button>
                      <span>FOTO</span>
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => orderPlayers("player")}
                      >
                        JUGADOR {playerSortMark("player")}
                      </button>
                      <button
                        type="button"
                        className="text-center"
                        onClick={() => orderPlayers("national")}
                      >
                        NAC. {playerSortMark("national")}
                      </button>
                      <button
                        type="button"
                        className="text-center"
                        onClick={() => orderPlayers("regional")}
                      >
                        REG. {playerSortMark("regional")}
                      </button>
                      <button
                        type="button"
                        className="text-center"
                        onClick={() => orderPlayers("milestones")}
                      >
                        HITOS {playerSortMark("milestones")}
                      </button>
                    </div>
                    <ul className="divide-y divide-neutral-200">
                      {players.map((player) => (
                        <li
                          key={player.id}
                          className="grid grid-cols-[48px_42px_minmax(0,1fr)_46px_46px_54px] items-center gap-2 px-5 py-3 sm:px-6"
                        >
                          <span className="text-center text-base font-normal text-red-600">
                            {player.participation_count}
                          </span>
                          <span className="image-hover-preview player-photo relative flex h-10 w-10 items-center justify-center overflow-visible rounded-full bg-neutral-100 text-xs font-black text-neutral-500">
                            <i aria-hidden="true" className="not-italic">
                              {player.first_name.slice(0, 1)}
                            </i>
                            <img
                              src={`/api/jugadores/foto/${player.id}`}
                              alt={`Foto de ${[player.first_name, player.last_name].filter(Boolean).join(" ")}`}
                              className="image-hover-preview-image absolute inset-0 h-full w-full rounded-full object-cover"
                              onLoad={(event) =>
                                event.currentTarget.parentElement?.classList.add(
                                  "has-photo", "has-image",
                                )
                              }
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                event.currentTarget.parentElement?.classList.remove("has-photo", "has-image");
                              }}
                            />
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/jugadores/${player.id}`}
                              className="block truncate leading-tight font-bold hover:text-red-700"
                            >
                              {[player.first_name, player.last_name]
                                .filter(Boolean)
                                .join(" ")}
                            </Link>
                            <small className="mt-1 block truncate text-xs text-neutral-500">
                              {[player.category, rugbyPositionLabel(player.position_text)].filter(Boolean).join(" · ")}
                            </small>
                          </div>
                          <span className="club-player-federation">
                            {player.selected_federation_ids.includes(
                              "FN003",
                            ) ? (
                              <Link
                                href="/federaciones/FN003"
                                className="club-player-selection national image-hover-preview"
                                title="Seleccionado por la Federación Española"
                              >
                                <img
                                  src={federationShieldUrl("FN003") ?? ""}
                                  alt="Federación nacional"
                                  className="image-hover-preview-image"
                                />
                              </Link>
                            ) : (
                              "—"
                            )}
                          </span>
                          <span className="club-player-federation">
                            {player.selected_federation_ids.find(
                              (federationId) => federationId !== "FN003",
                            ) ? (
                              <Link
                                href={`/federaciones/${player.selected_federation_ids.find((federationId) => federationId !== "FN003")}`}
                                className="club-player-selection territorial image-hover-preview"
                                title="Seleccionado por una federación regional"
                              >
                                <img
                                  src={
                                    federationShieldUrl(
                                      player.selected_federation_ids.find(
                                        (federationId) =>
                                          federationId !== "FN003",
                                      )!,
                                    ) ?? ""
                                  }
                                  alt="Federación regional"
                                  className="image-hover-preview-image"
                                />
                              </Link>
                            ) : (
                              "—"
                            )}
                          </span>
                          <span className="flex justify-center">
                            {player.milestone_count > 0 ? (
                              <span role="img" aria-label={`${player.milestone_count} hito${player.milestone_count === 1 ? "" : "s"} asociado${player.milestone_count === 1 ? "" : "s"}`} title={`${player.milestone_count} hito${player.milestone_count === 1 ? "" : "s"} asociado${player.milestone_count === 1 ? "" : "s"}`} className="text-red-600">
                                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] stroke-current" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></svg>
                              </span>
                            ) : "—"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="p-6 text-sm text-neutral-500">
                    No hay jugadores Rugby vinculados.
                  </p>
                )}
              </article>
              <article className="club-record-card club-record-field">
                <header>
                  <div>
                    <b>CAMPO Y UBICACIÓN</b>
                    <small>
                      Comprueba campo, fotos y exterior antes de verificar.
                    </small>
                  </div>
                </header>
                <ClubFinderMap clubs={[club]} selectedId={club.id} includeAllClubs />
              </article>
            </section>
            {!club.is_temporary_group && <ClubPrivateAccess clubId={club.id} admin={state.admin} />}
          </>
        )}
      </div>
    </main>
  );
}


