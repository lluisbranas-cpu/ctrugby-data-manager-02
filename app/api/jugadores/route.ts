import { loadLocalPlayerReviewData } from "@/lib/player-edit-review";
import { readGroupMemberships, withGroupClubs } from "@/lib/temporary-group-clubs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readCampusMetricsJson } from "@/lib/campus-participations";
import { readHitoPublication, isHitoPublished } from "@/lib/hito-publication";
import { readSeasonCategories, readCompetitionCategories } from "@/lib/player-season-categories";
import { trajectoryProfessionalClubs } from "@/app/lib/trajectory-professional-clubs";
import { savePlayerProfileOverride } from "@/lib/player-profile-overrides";
import { usesRemoteReviewStorage } from "@/lib/player-review-storage";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "@/lib/bounded-file-reads";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogClient, catalogServiceClient, catalogAccess, catalogConfigured, localAdminAccess, sameOrigin } from "@/lib/catalog";
import { mergeMilestoneTrajectory } from "@/lib/milestone-trajectory";
import { applyManualSelectionCallups, readManualSelectionCallups, selectionFederationIds, type SelectionRecord } from "@/lib/manual-selection-callups";
import { readProfessionalCategories, type ProfessionalClubMilestone } from "@/lib/professional-club-milestones";
import { readPlayerNews } from "@/lib/player-news";
import { likidHubPreviewReadOnly } from "@/lib/likidhub-preview";
import { likidHubPreviewPlayersResponse } from "@/lib/likidhub-preview-api";
import { canonicalLikidHubPlayerId } from "@/lib/likidhub-jug-ctr-bridge.generated";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; published: boolean; version: number };
type AdminPlayer = Player & { category: string | null; birth_year: number | null; season_count: number; linked_season_count: number; club_history_count: number };
type SheetSeason = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type SheetClub = { id: string; name: string; country: string | null; city?: string | null; region?: string | null; province?: string | null; latitude?: number | null; longitude?: number | null; maps_url?: string | null; active?: boolean | null };
type SheetMetric = { player_id: string; participation_count: number };
type SheetMilestone = { id: string; participant_id: string; scope: string; category?: string | null; season_label?: string | null; club_text?: string | null; position_text?: string | null };
type SheetMilestoneParticipant = { id: string; player_id: string | null };
type SheetPlayer = { id: string; first_name?: string | null; last_name?: string | null; category?: string | null; birth_year?: number | null; published?: boolean; version?: number };
type ProfessionalClubRecord = ProfessionalClubMilestone & { category_id: string | null };
type CreatePlayerBody = {
  action: "create-player";
  auto_id?: boolean;
  id: string;
  first_name: string;
  last_name?: string | null;
  category?: string | null;
  birth_year?: number | null;
  instagram?: string | null;
  dni?: string | null;
  published?: boolean;
  season?: {
    season_year?: number | null;
    registration_number?: string | null;
    club_id?: string | null;
    legacy_club_name?: string | null;
    position_text?: string | null;
    weight_kg?: number | null;
    height_cm?: number | null;
  } | null;
};
const selectionFederations = selectionFederationIds;
const reply = async (data: unknown, status = 200) => {
  const payload = data as { players?: { id: string }[]; seasons?: SheetSeason[]; clubs?: SheetClub[] };
  if (payload?.players && payload.seasons) {
    const seasons = await trajectorySummarySeasons(payload.seasons);
    const [memberships, categories] = await Promise.all([readGroupMemberships(seasons), readProfessionalCategories()]);
    const records = trajectoryProfessionalClubs(seasons, payload.clubs ?? [], categories);
    const recordsByPlayer = new Map<string, typeof records>();
    for (const record of records) recordsByPlayer.set(record.player_id, [...(recordsByPlayer.get(record.player_id) ?? []), record]);
    data = { ...payload, seasons, clubs: await withGroupClubs(payload.clubs ?? []), players: payload.players.map(player => ({ ...player, club_groups: memberships.get(player.id) ?? [], professional_club_records: recordsByPlayer.get(player.id) ?? [], professional_clubs: [...new Set((recordsByPlayer.get(player.id) ?? []).map(record => record.club_name))] })) };
  }
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
};
const cleanText = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const cleanNullableText = (value: unknown, maximum: number) => {
  const text = cleanText(value, maximum);
  return text || null;
};
const cleanDni = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, "").toUpperCase().slice(0, 32) : null;
const validMetric = (value: unknown, maximum: number) => value === null || value === undefined || value === "" ? null : typeof value === "number" && Number.isFinite(value) && value > 0 && value <= maximum ? value : undefined;
const normalizedPersonName = (firstName?: string | null, lastName?: string | null) =>
  [firstName ?? "", lastName ?? ""].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/\s+/g, " ").trim();
const createSeason = (body: CreatePlayerBody) => {
  const season = body.season;
  if (!season || !season.season_year) return null;
  const weight_kg = validMetric(season.weight_kg, 250);
  const height_cm = validMetric(season.height_cm, 260);
  if (weight_kg === undefined || height_cm === undefined) return undefined;
  return {
    season_year: season.season_year,
    registration_number: cleanNullableText(season.registration_number, 40),
    club_id: cleanNullableText(season.club_id, 12),
    legacy_club_name: cleanNullableText(season.legacy_club_name, 160),
    position_text: cleanNullableText(season.position_text, 80),
    weight_kg,
    height_cm,
  };
};

async function trajectorySummarySeasons(seasons: SheetSeason[]) {
  const metadata = new Map(await Promise.all([...new Set(seasons.map((season) => season.player_id))].map(async (id) => {
    const [categories, competitions, deletedRaw] = await Promise.all([
      readSeasonCategories(id), readCompetitionCategories(id),
      readFile(path.join(process.cwd(), "data", "staging", "player-season-deletions", id + ".json"), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return "[]"; throw error; }),
    ]);
    const deleted = new Set<number>(JSON.parse(deletedRaw));
    return [id, { categories, competitions, deleted }] as const;
  })));
  return seasons.filter((season) => !metadata.get(season.player_id)!.deleted.has(season.season_year)).map((season) => ({ ...season,
    playing_category: metadata.get(season.player_id)!.categories[String(season.season_year)] || null,
    competition_category: metadata.get(season.player_id)!.competitions[String(season.season_year)] || null,
  }));
}

async function localPreparedPhotos() {
  try {
    const manifestPath = path.join(process.cwd(), "data", "staging", "player-photos", "manifest.json");
    const items = JSON.parse(await readFile(manifestPath, "utf8")) as Array<{ player_id?: string }>;
    return Object.fromEntries(items.filter((item) => /^JUG\d{4}$/.test(item.player_id ?? "")).map((item) => [item.player_id!, `/api/jugadores/foto/${item.player_id}`]));
  } catch {
    return {} as Record<string, string>;
  }
}

async function localPlayerProfilesById() {
  try {
    const playersRaw = await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8");
    return new Map((JSON.parse(playersRaw) as SheetPlayer[]).map((player) => [player.id, {
      category: player.category === "M" || player.category === "F" ? player.category : null,
      birth_year: typeof player.birth_year === "number" && Number.isInteger(player.birth_year) ? player.birth_year : null,
    }]));
  } catch {
    return new Map<string, { category: string | null; birth_year: number | null }>();
  }
}

// Keep newly created players in the directory used by consultation access too.
async function saveLocalDirectoryPlayer(player: SheetPlayer) {
  const target = path.join(process.cwd(), "data", "staging", "players.json");
  const raw = await readFile(target, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return "[]";
    throw error;
  });
  const players = JSON.parse(raw) as SheetPlayer[];
  const index = players.findIndex((item) => item.id === player.id);
  if (index >= 0) players[index] = { ...players[index], ...player };
  else players.push(player);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(players, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

async function localPlayers() {
  try {
    const playersRaw = await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8");
    return (JSON.parse(playersRaw) as SheetPlayer[])
      .filter((player) => /^JUG\d{4}$/.test(player.id) && player.first_name?.trim())
      .map((player) => ({
        id: player.id,
        first_name: player.first_name!.trim(),
        last_name: player.last_name?.trim() || null,
        published: player.published ?? true,
        version: player.version ?? 1,
      }))
      .sort((a, b) => `${a.last_name ?? ""} ${a.first_name}`.localeCompare(`${b.last_name ?? ""} ${b.first_name}`, "es"));
  } catch {
    return [] as Player[];
  }
}

async function localParticipationByPlayer() {
  try {
    const metricsRaw = await readCampusMetricsJson();
    return new Map((JSON.parse(metricsRaw) as SheetMetric[]).map((metric) => [metric.player_id, metric.participation_count]));
  } catch {
    return new Map<string, number>();
  }
}

async function localSheetData() {
  try {
    const base = path.join(process.cwd(), "data", "staging");
    const [seasonsRaw, clubsRaw] = await Promise.all([
      readFile(path.join(base, "player-seasons.json"), "utf8"),
      readFile(path.join(base, "clubs.json"), "utf8"),
    ]);
    return {
      seasons: JSON.parse(seasonsRaw) as SheetSeason[],
      clubs: JSON.parse(clubsRaw) as SheetClub[],
    };
  } catch {
    return { seasons: [] as SheetSeason[], clubs: [] as SheetClub[] };
  }
}
async function localMilestoneSummaryByPlayer() {
  try {
    const base = path.join(process.cwd(), "data", "staging");
    const [milestonesRaw, participantsRaw, manualSelectionCallups] = await Promise.all([
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
      readManualSelectionCallups(),
    ]);
    const publication = await readHitoPublication();
    const milestones = JSON.parse(milestonesRaw) as SheetMilestone[];
    const milestoneParticipants = JSON.parse(participantsRaw) as SheetMilestoneParticipant[];
    const playerByParticipant = new Map(milestoneParticipants.filter((participant) => participant.player_id).map((participant) => [participant.id, participant.player_id!]));
    const milestonesByPlayer = new Map<string, number>();
    const selectedFederationsByPlayer = new Map<string, Set<string>>();
    const selectedFederationCountsByPlayer = new Map<string, Map<string, number>>();
    const selectionRecords: SelectionRecord[] = [];
    const professionalClubsByPlayer = new Map<string, Set<string>>();
    const professionalClubRecordsByPlayer = new Map<string, ProfessionalClubRecord[]>();
    for (const milestone of milestones) {
      if (!isHitoPublished(publication, milestone.id)) continue;
      const playerId = playerByParticipant.get(milestone.participant_id);
      if (!playerId) continue;
      milestonesByPlayer.set(playerId, (milestonesByPlayer.get(playerId) ?? 0) + 1);
      const federationId = selectionFederations[milestone.scope];
      if (!federationId) continue;
      selectionRecords.push({
        id: milestone.id,
        player_id: playerId,
        player_name: null,
        federation_id: federationId,
        scope: milestone.scope,
        category: milestone.category ?? null,
        format: null,
        season_label: milestone.season_label ?? null,
        club_text: milestone.club_text ?? null,
        position_text: milestone.position_text ?? null,
        source: "milestone",
        manual_override_id: null,
        notes: null,
      });
    }
    for (const selection of applyManualSelectionCallups(selectionRecords, manualSelectionCallups).filter((item) => isHitoPublished(publication, item.id))) {
      milestonesByPlayer.set(selection.player_id, Math.max(milestonesByPlayer.get(selection.player_id) ?? 0, 1));
      const selections = selectedFederationsByPlayer.get(selection.player_id) ?? new Set<string>();
      selections.add(selection.federation_id);
      selectedFederationsByPlayer.set(selection.player_id, selections);
      const counts = selectedFederationCountsByPlayer.get(selection.player_id) ?? new Map<string, number>();
      counts.set(selection.federation_id, (counts.get(selection.federation_id) ?? 0) + 1);
      selectedFederationCountsByPlayer.set(selection.player_id, counts);
    }
    return { milestones, milestoneParticipants, milestonesByPlayer, selectedFederationsByPlayer, selectedFederationCountsByPlayer, professionalClubsByPlayer, professionalClubRecordsByPlayer };
  } catch (error) {
    console.error("Failed to load featured player milestones", error);
    // A malformed or temporarily unavailable complementary file must not hide
    // the whole directory. The catalog remains usable and the related badges
    // can be recovered once that file is fixed.
    return {
      milestones: [] as SheetMilestone[],
      milestoneParticipants: [] as SheetMilestoneParticipant[],
      milestonesByPlayer: new Map<string, number>(),
      selectedFederationsByPlayer: new Map<string, Set<string>>(),
      selectedFederationCountsByPlayer: new Map<string, Map<string, number>>(),
      professionalClubsByPlayer: new Map<string, Set<string>>(),
      professionalClubRecordsByPlayer: new Map<string, ProfessionalClubRecord[]>(),
    };
  }
}

const selectedFederationIds = (selectedFederationsByPlayer: Map<string, Set<string>>, playerId: string) =>
  [...(selectedFederationsByPlayer.get(playerId) ?? new Set<string>())].sort((a, b) => Number(b === "FN003") - Number(a === "FN003"));
const selectedFederationCounts = (selectedFederationCountsByPlayer: Map<string, Map<string, number>>, playerId: string) =>
  Object.fromEntries([...(selectedFederationCountsByPlayer.get(playerId) ?? new Map<string, number>())].sort(([a], [b]) => Number(b === "FN003") - Number(a === "FN003")));
const professionalClubs = (professionalClubsByPlayer: Map<string, Set<string>>, playerId: string) =>
  [...(professionalClubsByPlayer.get(playerId) ?? new Set<string>())].sort((a, b) => a.localeCompare(b, "es"));
const professionalClubRecords = (professionalClubRecordsByPlayer: Map<string, ProfessionalClubRecord[]>, playerId: string) =>
  [...(professionalClubRecordsByPlayer.get(playerId) ?? [])].sort((a, b) => a.club_name.localeCompare(b.club_name, "es"));

async function localPlayerDeletionLinks(playerId: string) {
  try {
    const base = path.join(process.cwd(), "data", "staging");
    const [metricsRaw, milestonesRaw, participantsRaw] = await Promise.all([
      readCampusMetricsJson(),
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
    ]);
    const participants = JSON.parse(participantsRaw) as SheetMilestoneParticipant[];
    const participantIds = new Set(participants.filter((participant) => participant.player_id === playerId).map((participant) => participant.id));
    const milestoneCount = (JSON.parse(milestonesRaw) as SheetMilestone[]).filter((milestone) => participantIds.has(milestone.participant_id)).length;
    const participationCount = (JSON.parse(metricsRaw) as SheetMetric[]).find((metric) => metric.player_id === playerId)?.participation_count ?? 0;
    return { milestoneCount, participationCount };
  } catch {
    return { milestoneCount: 0, participationCount: 0 };
  }
}

export async function GET(request: NextRequest) {
  if (likidHubPreviewReadOnly()) {
    try { return await likidHubPreviewPlayersResponse(); }
    catch { return reply({ error: "No se pudo leer el directorio LikidHub." }, 503); }
  }
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return reply({ configured: false, admin: false, players: [] });
  try {
    const { db, admin } = await catalogAccess(request);
    const publicView = request.nextUrl.searchParams.get("view") === "public";
    const historyId = request.nextUrl.searchParams.get("history");
    if (historyId) {
      if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
      if (!/^JUG[0-9]{4}$/.test(historyId)) return reply({ error: "Jugador no válido." }, 400);
      const history = await db.rpc("admin_player_club_history", { p_player_id: historyId });
      if (history.error) return reply({ error: "No se ha podido leer el historial privado de clubs." }, 503);
      return reply({ player_id: historyId, clubs: history.data ?? [] });
    }
    if (request.nextUrl.searchParams.get("navigation") === "1") {
      if (admin && !localAdminAccess(request)) {
        const result = await db.from("catalog_players").select("id,first_name,last_name").order("id").range(0, 9999);
        if (result.error) return reply({ error: "No se ha podido cargar la navegación de jugadores." }, 503);
        return reply({ players: (result.data ?? []) });
      }
      if (localAdminAccess(request)) {
        return reply({ players: (await localPlayers()).map(({ id, first_name, last_name }) => ({ id, first_name, last_name })) });
      }
      const visible = await db.from("catalog_players").select("id,first_name,last_name").eq("published", true).order("id").range(0, 9999);
      if (visible.error) return reply({ error: "No se ha podido cargar la navegación de jugadores." }, 503);
      return reply({ players: visible.data ?? [] });
    }
    if (admin && !publicView && !localAdminAccess(request)) {
      const [summary, sheet, photoRows, clubLocations, metricsRaw, milestoneSummary, playerNews] = await Promise.all([
        db.rpc("admin_player_catalog_with_history"),
        db.rpc("admin_player_sheet_data"),
        db.schema("app_private").from("player_profile_photos").select("player_id,storage_key"),
        db.from("catalog_clubs").select("id,city,region,province,country,latitude,longitude,maps_url,active"),
        readCampusMetricsJson(),
        localMilestoneSummaryByPlayer(),
        readPlayerNews(),
      ]);
      if (summary.error) return reply({ error: "No se han podido leer los datos privados de jugadores." }, 503);
      const photos: Record<string, string> = {};
      if (!photoRows.error) {
        await Promise.all((photoRows.data ?? []).map(async (photo) => {
          const signed = await db.storage.from("catalog-media-private").createSignedUrl(photo.storage_key, 3600);
          if (signed.data?.signedUrl) photos[photo.player_id] = signed.data.signedUrl;
        }));
      }
      Object.assign(photos, await localPreparedPhotos());
      const sheetData = sheet.error ? null : sheet.data as { seasons?: SheetSeason[]; clubs?: SheetClub[] } | null;
      const locations = new Map((clubLocations.data ?? []).map((club) => [club.id, club]));
      const participationByPlayer = new Map((JSON.parse(metricsRaw) as SheetMetric[]).map((metric) => [metric.player_id, metric.participation_count]));
      const newsByPlayer = new Map<string, number>();
      for (const news of playerNews.filter((item) => item.published && item.type === "noticia")) newsByPlayer.set(news.player_id, (newsByPlayer.get(news.player_id) ?? 0) + 1);
      return reply({
        configured: true, admin: true,
        players: (summary.data as AdminPlayer[]).map((player) => ({
          id: player.id, first_name: player.first_name, last_name: player.last_name, published: player.published, version: player.version,
          profile: { category: player.category, birth_year: player.birth_year }, season_count: player.season_count, linked_season_count: player.linked_season_count, club_history_count: player.club_history_count,
          participation_count: participationByPlayer.get(player.id) ?? 0, news_count: newsByPlayer.get(player.id) ?? 0, milestone_count: milestoneSummary.milestonesByPlayer.get(player.id) ?? 0,
          selected_federation_ids: selectedFederationIds(milestoneSummary.selectedFederationsByPlayer, player.id),
          selected_federation_counts: selectedFederationCounts(milestoneSummary.selectedFederationCountsByPlayer, player.id),
          professional_clubs: professionalClubs(milestoneSummary.professionalClubsByPlayer, player.id),
          professional_club_records: professionalClubRecords(milestoneSummary.professionalClubRecordsByPlayer, player.id),
        })),
        seasons: mergeMilestoneTrajectory(sheetData?.seasons ?? [], milestoneSummary.milestones, milestoneSummary.milestoneParticipants, sheetData?.clubs ?? []),
        clubs: (sheetData?.clubs ?? []).map((club) => ({ ...club, city: locations.get(club.id)?.city ?? club.city ?? null, region: locations.get(club.id)?.region ?? club.region ?? null, province: locations.get(club.id)?.province ?? club.province ?? null, country: locations.get(club.id)?.country ?? club.country ?? null, latitude: locations.get(club.id)?.latitude ?? club.latitude ?? null, longitude: locations.get(club.id)?.longitude ?? club.longitude ?? null, maps_url: locations.get(club.id)?.maps_url ?? club.maps_url ?? null, active: locations.get(club.id)?.active ?? club.active ?? true })),
        photos,
      });
    }
    const [localDirectory, participationByPlayer, milestoneSummary, sheetData, localProfiles, playerNews] = await Promise.all([
      localPlayers(),
      localParticipationByPlayer(),
      localMilestoneSummaryByPlayer(),
      localSheetData(),
      localPlayerProfilesById(),
      readPlayerNews(),
    ]);
    let players = localDirectory;
    if (!admin || publicView) {
      const visible = await db.from("catalog_players").select("id").eq("published", true).range(0, 9999);
      if (visible.error) return reply({ error: "No se han podido comprobar los jugadores publicados." }, 503);
      // Supabase keeps CTR IDs while the local directory and its related records use JUG IDs.
      // Match through the verified bridge instead of assuming the numeric suffix is enough.
      const visibleIds = new Set((visible.data ?? []).map((player) => player.id));
      players = localDirectory.filter((player) => {
        const catalogId = canonicalLikidHubPlayerId(player.id);
        return catalogId !== null && visibleIds.has(catalogId);
      }).map((player) => ({ ...player, published: true }));
    }
    const newsByPlayer = new Map<string, number>();
    for (const news of playerNews.filter((item) => item.published && item.type === "noticia")) newsByPlayer.set(news.player_id, (newsByPlayer.get(news.player_id) ?? 0) + 1);
    const publicPlayers = players;
    const publicPlayerIds = new Set(publicPlayers.map((player) => player.id));
    const sheetSeasons = sheetData.seasons.filter((season) => publicPlayerIds.has(season.player_id));
    const seasons = mergeMilestoneTrajectory(sheetSeasons, milestoneSummary.milestones, milestoneSummary.milestoneParticipants, sheetData.clubs);
    return reply({
      configured: true,
      admin,
      players: publicPlayers.map((player) => ({
        ...player,
        profile: localProfiles.get(player.id) ?? { category: null, birth_year: null },
        participation_count: participationByPlayer.get(player.id) ?? 0,
        news_count: newsByPlayer.get(player.id) ?? 0,
        milestone_count: milestoneSummary.milestonesByPlayer.get(player.id) ?? 0,
        selected_federation_ids: selectedFederationIds(milestoneSummary.selectedFederationsByPlayer, player.id),
        selected_federation_counts: selectedFederationCounts(milestoneSummary.selectedFederationCountsByPlayer, player.id),
        professional_clubs: professionalClubs(milestoneSummary.professionalClubsByPlayer, player.id),
        professional_club_records: professionalClubRecords(milestoneSummary.professionalClubRecordsByPlayer, player.id),
      })),
      seasons: request.nextUrl.searchParams.get("trajectory") === "summary" ? await trajectorySummarySeasons(seasons) : seasons,
      clubs: sheetData.clubs,
      // Keep the local portrait index available to public directory views too.
      // Featured players use this response outside the administrator session.
      photos: Object.fromEntries(Object.entries(await localPreparedPhotos()).filter(([id]) => publicPlayerIds.has(id))),
    });
  } catch {
    return reply({ error: "No se ha podido conectar con el catálogo de jugadores." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const body = await request.json();
    const access = await catalogAccess(request);
    const admin = access.admin;
    const sessionToken = request.cookies.get(CATALOG_COOKIE)?.value;
    const db = body.action === "create-player" && localAdminAccess(request)
      ? (process.env.SUPABASE_SERVICE_ROLE_KEY ? catalogServiceClient() : sessionToken ? catalogClient(sessionToken) : access.db)
      : access.db;
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (body.action === "create-player") {
      const submitted = body as CreatePlayerBody;
      let id = cleanText(submitted.id, 7).toUpperCase();
      const first_name = cleanText(submitted.first_name, 100);
      const last_name = cleanNullableText(submitted.last_name, 160);
      const category = cleanNullableText(submitted.category, 20);
      const birth_year = submitted.birth_year === null || submitted.birth_year === undefined ? null : Number(submitted.birth_year);
      const instagram = cleanNullableText(submitted.instagram, 160);
      const dni = cleanDni(submitted.dni);
      const season = createSeason(submitted);
      if (!/^JUG[0-9]{4}$/.test(id) || !first_name) return reply({ error: "Indica un ID JUG válido y el nombre del jugador." }, 400);
      if (birth_year !== null && (!Number.isInteger(birth_year) || birth_year < 1900 || birth_year > 2026)) return reply({ error: "El año de nacimiento no es válido." }, 400);
      if (instagram && !/^@[^@\s]+$/.test(instagram)) return reply({ error: "Instagram debe empezar por @ y no contener espacios." }, 400);
      if (season === undefined || (season && (!Number.isInteger(season.season_year) || season.season_year < 2000 || season.season_year > 2035))) return reply({ error: "La temporada inicial no es válida." }, 400);
      const submittedName = normalizedPersonName(first_name, last_name);
      const existingPlayers = await db.from("catalog_players").select("id,first_name,last_name");
      if (existingPlayers.error) return reply({ error: "No se ha podido comprobar si el jugador ya existe." }, 503);
      const nextId = (rows: { id: string }[]) => {
        const highest = Math.max(0, ...rows.map((player) => Number(player.id.match(/^(?:JUG|CTR|RUG)(\d{4})$/)?.[1] ?? 0)));
        return highest >= 9999 ? null : `JUG${String(highest + 1).padStart(4, "0")}`;
      };
      if (submitted.auto_id) {
        const availableId = nextId([...(existingPlayers.data ?? []), ...await localPlayers()]);
        if (!availableId) return reply({ error: "Se ha alcanzado el límite de IDs JUG de cuatro dígitos." }, 409);
        id = availableId;
      }
      const duplicatePlayer = [...await localPlayers(), ...(existingPlayers.data ?? [])].find((player) => (submitted.auto_id || player.id !== id) && normalizedPersonName(player.first_name, player.last_name) === submittedName);
      if (duplicatePlayer) return reply({ error: `Ya existe un jugador con ese nombre (${duplicatePlayer.id}). Revisa la ficha existente antes de crear otra.`, existing_player_id: duplicatePlayer.id }, 409);      if (season?.club_id) {
        const club = await db.from("catalog_clubs").select("id").eq("id", season.club_id).maybeSingle();
        if (club.error || !club.data) return reply({ error: "El club seleccionado no existe." }, 400);
      }
      // The connected database keeps its original CTR primary keys. Public IDs stay JUG.
      const databaseId = (value: string) => (existingPlayers.data ?? []).some(player => /^CTR\d{4}$/.test(player.id)) ? value.replace(/^JUG/, "CTR") : value;
      let created = await db.from("catalog_players").insert({ id: databaseId(id), first_name, last_name, published: submitted.published !== false }).select("id").maybeSingle();
      // Another administrator may have saved after the ID was calculated.
      for (let attempt = 0; submitted.auto_id && created.error?.code === "23505" && attempt < 3; attempt += 1) {
        const currentIds = await db.from("catalog_players").select("id");
        if (currentIds.error) return reply({ error: "No se ha podido actualizar el próximo ID disponible." }, 503);
        const availableId = nextId([...(currentIds.data ?? []), ...await localPlayers()]);
        if (!availableId) return reply({ error: "Se ha alcanzado el límite de IDs JUG de cuatro dígitos." }, 409);
        id = availableId;
        created = await db.from("catalog_players").insert({ id: databaseId(id), first_name, last_name, published: submitted.published !== false }).select("id").maybeSingle();
      }
      if (created.error) {
        const reason = created.error.code === "23505" ? "Ya existe un jugador con ese ID."
          : created.error.code === "42501" ? "La base de datos no permite crear jugadores con la conexion actual. Inicia sesion con una cuenta administradora; si trabajas sin sesion en local, configura SUPABASE_SERVICE_ROLE_KEY en .env.local y reinicia el servidor."
          : `No se ha podido crear el jugador: ${created.error.message} (${created.error.code || "sin codigo"}).`;
        return reply({ error: reason }, created.error.code === "23505" ? 409 : 503);
      }
      const profile = await db.schema("app_private").from("player_profiles").upsert({ player_id: databaseId(id), category, birth_year, instagram, dni, updated_at: new Date().toISOString() });
      if (profile.error) {
        if (profile.error.code === "PGRST106") {
          await savePlayerProfileOverride(id, { category, birth_year, instagram, dni, allergies: null, dietary_conditions: null, medications: null });
        } else {
          return reply({ id, error: "Jugador creado, pero no se ha podido guardar el perfil." }, 503);
        }
      }
      if (season) {
        const saved = await db.rpc("admin_replace_player_trajectory", { p_player_id: databaseId(id), p_seasons: [season] });
        if (saved.error) return reply({ id, error: saved.error.message || "Jugador creado, pero no se ha podido guardar la temporada inicial." }, 503);
      }
      await saveLocalDirectoryPlayer({ id, first_name, last_name, category, birth_year, published: submitted.published !== false, version: 1 });
      if (usesRemoteReviewStorage()) {
        const data = await loadLocalPlayerReviewData(id);
        const bucket = process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private";
        const info = await db.storage.getBucket(bucket);
        if (info.error || info.data?.public !== false) return reply({id, error: "Jugador creado. No se ha podido preparar el almacenamiento privado."}, 503);
        const snapshot = await db.storage.from(bucket).upload("player-review-data/" + id + ".json", JSON.stringify(data), {contentType: "application/json", upsert: true, cacheControl: "0"});
        if (snapshot.error) return reply({id, error: "Jugador creado. No se ha podido preparar la ficha privada."}, 503);
      }
      return reply({ ok: true, id }, 201);
    }
    if (body.action === "delete-player") {
      if (typeof body.id !== "string" || !/^JUG[0-9]{4}$/.test(body.id) || !Number.isInteger(body.version) || body.version < 1) return reply({ error: "Solicitud de eliminación no válida." }, 400);
      const existing = await db.from("catalog_players").select("id,published,version").eq("id", body.id).eq("version", body.version).maybeSingle();
      if (existing.error) return reply({ error: "No se ha podido comprobar la ficha." }, 503);
      if (!existing.data) return reply({ error: "La ficha cambió en otra sesión. Recarga antes de continuar." }, 409);
      if (existing.data.published) return reply({ error: "Oculta el jugador antes de eliminar el registro." }, 400);
      const [participants, participationMetric, localLinks] = await Promise.all([
        db.from("catalog_participants").select("id").eq("player_id", body.id),
        db.schema("app_private").from("player_participation_metrics").select("participation_count").eq("player_id", body.id).maybeSingle(),
        localPlayerDeletionLinks(body.id),
      ]);
      if (participants.error) return reply({ error: "No se han podido revisar los hitos del jugador." }, 503);
      const privateParticipationCount = participationMetric.error ? 0 : Number(participationMetric.data?.participation_count ?? 0);
      const participantIds = (participants.data ?? []).map((participant) => participant.id);
      const milestones = participantIds.length ? await db.from("catalog_milestones").select("id", { count: "exact", head: true }).in("participant_id", participantIds) : null;
      if (milestones?.error) return reply({ error: "No se han podido revisar los hitos del jugador." }, 503);
      const milestoneCount = Math.max(milestones?.count ?? 0, localLinks.milestoneCount);
      const participationCount = Math.max(privateParticipationCount, localLinks.participationCount);
      if (milestoneCount > 0 || participationCount > 0) {
        const reasons = [
          milestoneCount > 0 ? `${milestoneCount} hito${milestoneCount === 1 ? "" : "s"}` : null,
          participationCount > 0 ? `${participationCount} participación${participationCount === 1 ? "" : "es"}` : null,
        ].filter(Boolean).join(" y ");
        return reply({ error: `No se puede eliminar: tiene ${reasons} registrado${milestoneCount + participationCount === 1 ? "" : "s"}. Revisa o elimina esos datos antes.` }, 409);
      }
      const deleted = await db.from("catalog_players").delete().eq("id", body.id).eq("version", body.version).eq("published", false).select("id");
      if (deleted.error) return reply({ error: "No se ha podido eliminar el registro del jugador." }, 503);
      if (!deleted.data?.length) return reply({ error: "La ficha cambió en otra sesión. Recarga antes de continuar." }, 409);
      return reply({ ok: true });
    }
    if (body.action !== "set-publication" || typeof body.id !== "string" || !/^JUG[0-9]{4}$/.test(body.id) || typeof body.published !== "boolean" || !Number.isInteger(body.version) || body.version < 1) return reply({ error: "Solicitud de publicación no válida." }, 400);
    const update = await db.from("catalog_players").update({ published: body.published, version: body.version + 1, updated_at: new Date().toISOString() }).eq("id", body.id).eq("version", body.version).select("id");
    if (update.error) return reply({ error: "No se ha podido cambiar la publicación." }, 503);
    if (!update.data?.length) return reply({ error: "La ficha cambió en otra sesión. Recarga antes de continuar." }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido procesar la solicitud." }, 400);
  }
}




