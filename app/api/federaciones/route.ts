import { readGroupMemberships } from "@/lib/temporary-group-clubs";
import { readCampusMetricsJson } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "node:fs/promises";
import { federationShieldUrls } from "@/app/lib/federation-shields";
import path from "node:path";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
import { worldRugbyAffiliation } from "@/app/lib/world-rugby";
import { mergeMilestoneTrajectory } from "@/lib/milestone-trajectory";
import { applyManualSelectionCallups, readManualSelectionCallups, selectionFederationIds, type SelectionRecord } from "@/lib/manual-selection-callups";
import { readProfessionalClubMilestones, shapeProfessionalClubRecord, type ProfessionalClubMilestone } from "@/lib/professional-club-milestones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Federation = { id: string; name: string; scope: string; territory: string; country: string; active: boolean; website: string | null; published?: boolean; version?: number };
type FederationSport = { federation_id: string; catalog_sports: { name: string } | { name: string }[] | null };
type Club = { id: string; name: string; country: string | null; region: string | null };
type Season = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Player = { id: string; first_name: string; last_name: string | null; category: string | null };
type PlayerMetric = { player_id: string; participation_count: number };
type Milestone = { participant_id: string; scope: string; season_label?: string | null };
type MilestoneParticipant = { id: string; player_id: string | null };

const normalize = (value: string | null | undefined) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();

const belongsToFederation = (club: Club, federation: Federation) => federation.scope === "Nacional"
  ? normalize(club.country) === normalize(federation.country)
  : normalize(club.country) === "espana" && normalize(club.region) === normalize(federation.territory);

const yearsFromSeasonLabel = (record: { season_label?: string | null }) => [...new Set(String(record.season_label ?? "").match(/20\d{2}/g) ?? [])].map(Number);

async function localMetrics(visiblePlayerIds?: ReadonlySet<string>, visibleClubIds?: ReadonlySet<string>) {
  try {
    const base = path.join(process.cwd(), "data", "staging");
    const [clubsFile, seasonsFile, metricsFile, playersFile, milestonesFile, milestoneParticipantsFile, manualSelectionCallups, professionalClubMilestones] = await Promise.all([
      readFile(path.join(base, "clubs.json"), "utf8"),
      readFile(path.join(base, "player-seasons.json"), "utf8"),
      readCampusMetricsJson(),
      readFile(path.join(base, "players.json"), "utf8"),
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
      readManualSelectionCallups(),
      readProfessionalClubMilestones(),
    ]);
    const clubs = (JSON.parse(clubsFile) as Club[])
      .filter((club) => !visibleClubIds || visibleClubIds.has(club.id));
    const milestoneParticipants = JSON.parse(milestoneParticipantsFile) as MilestoneParticipant[];
    const milestones = JSON.parse(milestonesFile) as Milestone[];
    const participantPlayers = new Map(milestoneParticipants.filter((participant) => participant.player_id).map((participant) => [participant.id, participant.player_id!]));
    const milestonesByPlayer = new Map<string, number>();
    const selectionRecords: SelectionRecord[] = [];
    const selectedFederationsByPlayer = new Map<string, Set<string>>();
    const selectedFederationYearsByPlayer = new Map<string, Map<string, Set<number>>>();
    const selectedPlayersByFederation = new Map<string, Set<string>>();
    for (const milestone of milestones) {
      const playerId = participantPlayers.get(milestone.participant_id);
      if (!playerId || (visiblePlayerIds && !visiblePlayerIds.has(playerId))) continue;
      milestonesByPlayer.set(playerId, (milestonesByPlayer.get(playerId) ?? 0) + 1);
      const federationId = milestone.scope ? selectionFederationIds[milestone.scope] : null;
      if (!federationId) continue;
      selectionRecords.push({
        id: `${milestone.participant_id}-${milestone.scope}-${milestone.season_label ?? ""}`,
        player_id: playerId,
        player_name: null,
        federation_id: federationId,
        scope: milestone.scope,
        category: null,
        format: "XV",
        season_label: milestone.season_label ?? null,
        club_text: null,
        position_text: null,
        source: "milestone",
        manual_override_id: null,
        notes: null,
      });
    }
    for (const selection of applyManualSelectionCallups(selectionRecords, manualSelectionCallups)) {
      const playerId = selection.player_id;
      if (visiblePlayerIds && !visiblePlayerIds.has(playerId)) continue;
      const federationId = selection.federation_id;
      const selections = selectedFederationsByPlayer.get(playerId) ?? new Set<string>();
      selections.add(federationId);
      selectedFederationsByPlayer.set(playerId, selections);
      const selectionYears = selectedFederationYearsByPlayer.get(playerId) ?? new Map<string, Set<number>>();
      const years = selectionYears.get(federationId) ?? new Set<number>();
      for (const year of yearsFromSeasonLabel(selection)) years.add(year);
      selectionYears.set(federationId, years);
      selectedFederationYearsByPlayer.set(playerId, selectionYears);
      const selectedPlayers = selectedPlayersByFederation.get(federationId) ?? new Set<string>();
      selectedPlayers.add(playerId);
      selectedPlayersByFederation.set(federationId, selectedPlayers);
    }
    const shapedProfessionalClubMilestones = professionalClubMilestones
      .filter((record) => !visiblePlayerIds || visiblePlayerIds.has(record.player_id))
      .filter((record) => !visibleClubIds || !record.club_id || visibleClubIds.has(record.club_id))
      .map((record) => shapeProfessionalClubRecord(record, clubs));
    const professionalByPlayer = new Map<string, ProfessionalClubMilestone[]>();
    for (const record of shapedProfessionalClubMilestones) {
      professionalByPlayer.set(record.player_id, [...(professionalByPlayer.get(record.player_id) ?? []), record]);
    }
    return {
      clubs,
      seasons: mergeMilestoneTrajectory(JSON.parse(seasonsFile) as Season[], milestones, milestoneParticipants, clubs)
        .filter((season) => (!visiblePlayerIds || visiblePlayerIds.has(season.player_id)) &&
          (!visibleClubIds || !season.club_id || visibleClubIds.has(season.club_id))),
      participations: new Map((JSON.parse(metricsFile) as PlayerMetric[])
        .filter((metric) => !visiblePlayerIds || visiblePlayerIds.has(metric.player_id))
        .map((metric) => [metric.player_id, metric.participation_count])),
      players: new Map((JSON.parse(playersFile) as Player[])
        .filter((player) => !visiblePlayerIds || visiblePlayerIds.has(player.id))
        .map((player) => [player.id, player])),
      milestones: milestonesByPlayer,
      selections: selectedFederationsByPlayer,
      selectionYears: selectedFederationYearsByPlayer,
      selectionCounts: new Map([...selectedPlayersByFederation].map(([federationId, playerIds]) => [federationId, playerIds.size])),
      selectionPlayerIds: selectedPlayersByFederation,
      professionalClubRecords: shapedProfessionalClubMilestones,
      professionalByPlayer,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ configured: false, federations: [] }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    const [federationResult, clubResult, federationSportsResult, visiblePlayerResult] = await Promise.all([
      db.from("catalog_federations").select("id,name,scope,territory,country,active,website,published,version").order("country").order("scope").order("name"),
      db.from("catalog_clubs").select("id,name,country,region"),
      db.from("catalog_federation_sports").select("federation_id,catalog_sports(name)"),
      db.from("catalog_players").select("id").eq("published", true).range(0, 9999),
    ]);
    if (federationResult.error) return NextResponse.json({ error: "No se han podido cargar las federaciones publicadas." }, { status: 503 });
    if (clubResult.error) return NextResponse.json({ error: "No se han podido cargar los clubs asociados." }, { status: 503 });
    if (visiblePlayerResult.error) return NextResponse.json({ error: "No se han podido comprobar los jugadores publicados." }, { status: 503 });
    const visiblePlayerIds = new Set((visiblePlayerResult.data ?? []).map((player) => player.id));
    const visibleClubIds = new Set((clubResult.data ?? []).map((club) => club.id));
    const federations = federationResult.data as Federation[];
    const sportNamesByFederation = new Map<string, string[]>();
    for (const record of (federationSportsResult.data ?? []) as unknown as FederationSport[]) {
      const linked = record.catalog_sports;
      const names = Array.isArray(linked) ? linked.map((sport) => sport.name) : linked?.name ? [linked.name] : [];
      if (names.length) sportNamesByFederation.set(record.federation_id, [...(sportNamesByFederation.get(record.federation_id) ?? []), ...names]);
    }
    const notes = admin ? await db.schema("app_private").from("federation_notes").select("federation_id,email") : { data: [] as { federation_id: string; email: string | null }[] };
    const emails = new Map((notes.data ?? []).map((note) => [note.federation_id, note.email]));
    const local = await localMetrics(admin ? undefined : visiblePlayerIds, admin ? undefined : visibleClubIds);
    const shieldFiles = new Set(await readdir(path.join(process.cwd(), "public", "federation-shields")).catch(() => [] as string[]));
    const clubs = local?.clubs ?? clubResult.data as Club[];
    const associatedClubs = new Map(federations.map((federation) => [federation.id, clubs.filter((club) => belongsToFederation(club, federation))]));
    const playerCounts = new Map<string, number>();
    const participationCounts = new Map<string, number>();
    const ctrugbyClubCounts = new Map<string, number>();

    if (local) {
      for (const federation of federations) {
        const clubIds = new Set((associatedClubs.get(federation.id) ?? []).map((club) => club.id));
        const playerIds = new Set(local.seasons.filter((season) => season.season_year >= 2023 && season.club_id && clubIds.has(season.club_id)).map((season) => season.player_id));
        for (const playerId of local.selectionPlayerIds.get(federation.id) ?? new Set<string>()) playerIds.add(playerId);
        const professionalClubIds = new Set(local.professionalClubRecords.filter((record) => record.club_id && clubIds.has(record.club_id)).map((record) => record.club_id!));
        for (const record of local.professionalClubRecords.filter((record) => record.club_id && clubIds.has(record.club_id))) playerIds.add(record.player_id);
        playerCounts.set(federation.id, playerIds.size);
        participationCounts.set(federation.id, [...playerIds].reduce((total, playerId) => total + (local.participations.get(playerId) ?? 0), 0));
        const participatingClubIds = new Set(local.seasons.filter((season) => season.season_year >= 2023 && season.club_id && clubIds.has(season.club_id) && (local.participations.get(season.player_id) ?? 0) > 0).map((season) => season.club_id!));
        for (const clubId of professionalClubIds) participatingClubIds.add(clubId);
        ctrugbyClubCounts.set(federation.id, participatingClubIds.size);
      }
    }

    if (!local && admin) {
      const sheet = await db.rpc("admin_player_sheet_data");
      if (!sheet.error) {
        const playerIdsByClub = new Map<string, Set<string>>();
        for (const season of ((sheet.data as { seasons?: Season[] } | null)?.seasons ?? [])) {
          if (!season.club_id || !season.player_id) continue;
          const playerIds = playerIdsByClub.get(season.club_id) ?? new Set<string>();
          playerIds.add(season.player_id);
          playerIdsByClub.set(season.club_id, playerIds);
        }
        for (const federation of federations) {
          const playerIds = new Set<string>();
          for (const club of associatedClubs.get(federation.id) ?? []) {
            for (const playerId of playerIdsByClub.get(club.id) ?? []) playerIds.add(playerId);
          }
          playerCounts.set(federation.id, playerIds.size);
        }
      }
    }
const countryMetrics = [...new Set(federations.map((federation) => federation.country).filter(Boolean))].map((country) => {
      const countryClubs = clubs.filter((club) => normalize(club.country) === normalize(country));
      const clubIds = new Set(countryClubs.map((club) => club.id));
      const playerIds = local ? new Set(local.seasons.filter((season) => season.season_year >= 2023 && season.club_id && clubIds.has(season.club_id)).map((season) => season.player_id)) : new Set<string>();
      if (local) for (const record of local.professionalClubRecords.filter((record) => record.club_id && clubIds.has(record.club_id))) playerIds.add(record.player_id);
      return {
        country,
        club_count: countryClubs.length,
        player_count: local || admin ? playerIds.size : null,
        participation_count: local ? [...playerIds].reduce((total, playerId) => total + (local.participations.get(playerId) ?? 0), 0) : null,
        ctrugby_club_count: local ? new Set([...local.seasons.filter((season) => season.season_year >= 2023 && season.club_id && clubIds.has(season.club_id) && (local.participations.get(season.player_id) ?? 0) > 0).map((season) => season.club_id!), ...local.professionalClubRecords.filter((record) => record.club_id && clubIds.has(record.club_id)).map((record) => record.club_id!)]).size : null,
      };
    });
const requestedPlayers = request.nextUrl.searchParams.get("players");
    const groupMemberships = requestedPlayers && local ? await readGroupMemberships(local.seasons) : new Map();
    const playerFederation = requestedPlayers ? federations.find((federation) => federation.id === requestedPlayers) : null;
    const territorialFederationByClubId = new Map<string, Federation>();
    for (const federation of federations.filter((item) => item.scope === "Territorial" && normalize(item.country) === "espana")) {
      for (const club of associatedClubs.get(federation.id) ?? []) territorialFederationByClubId.set(club.id, federation);
    }    const federationPlayers = local && playerFederation ? (() => {
      const clubIds = new Set((associatedClubs.get(playerFederation.id) ?? []).map((club) => club.id));
      const relevantSeasons = local.seasons.filter((season) => season.season_year >= 2023 && season.club_id && clubIds.has(season.club_id));
      const selectedPlayerIds = local.selectionPlayerIds.get(playerFederation.id) ?? new Set<string>();
      const relevantProfessionalRecords = local.professionalClubRecords.filter((record) => record.club_id && clubIds.has(record.club_id));
      const playerIds = new Set([...relevantSeasons.map((season) => season.player_id), ...selectedPlayerIds, ...relevantProfessionalRecords.map((record) => record.player_id)]);
      return [...playerIds].map((playerId) => {
        const player = local.players.get(playerId);
        const season = relevantSeasons.filter((item) => item.player_id === playerId).sort((a, b) => b.season_year - a.season_year)[0];
        const professionalRecord = relevantProfessionalRecords.filter((item) => item.player_id === playerId).sort((a, b) => String(b.season_label ?? "").localeCompare(String(a.season_label ?? ""), "es", { numeric: true }))[0];
        const territorialFederation = season?.club_id ? territorialFederationByClubId.get(season.club_id) : null;
        const selectedFederationIds = [...(local.selections.get(playerId) ?? new Set<string>())].sort((a, b) => Number(b.startsWith("FN")) - Number(a.startsWith("FN")));
        const selectedFederationYears = Object.fromEntries([...selectedFederationIds].map((federationId) => [federationId, [...(local.selectionYears.get(playerId)?.get(federationId) ?? new Set<number>())].sort()]));
        return { club_groups: groupMemberships.get(playerId) ?? [], id: playerId, first_name: player?.first_name ?? "Jugador", last_name: player?.last_name ?? null, category: player?.category ?? null, position_text: season?.position_text ?? null, season_year: season?.season_year ?? null, club_id: season?.club_id ?? professionalRecord?.club_id ?? null, club_name: season?.legacy_club_name ?? professionalRecord?.club_name ?? null, federation_id: territorialFederation?.id ?? null, federation_name: territorialFederation?.name ?? null, participation_count: local.participations.get(playerId) ?? 0, milestone_count: local.milestones.get(playerId) ?? 0, professional_club_count: local.professionalByPlayer.get(playerId)?.length ?? 0, selected_federation_ids: selectedFederationIds, selected_federation_years: selectedFederationYears };
      }).sort((a, b) => `${a.last_name ?? ""} ${a.first_name}`.localeCompare(`${b.last_name ?? ""} ${b.first_name}`, "es"));
    })() : [];
    const regions = new Set(federations.filter((federation) => federation.country === "España" && federation.scope === "Territorial").map((federation) => federation.territory)).size;
    const ctrugbyRegions = new Set(federations.filter((federation) => federation.country === "España" && federation.scope === "Territorial" && (playerCounts.get(federation.id) ?? 0) > 0).map((federation) => federation.territory)).size;
    const national = federations.filter((federation) => federation.scope === "Nacional").length;
    const ctrugbyNational = federations.filter((federation) => federation.scope === "Nacional" && (playerCounts.get(federation.id) ?? 0) > 0).length;
    return NextResponse.json({
      configured: true,
      admin,
      federations: federations.map((federation) => ({
        ...federation,
        sports: sportNamesByFederation.get(federation.id) ?? ["Rugby"],
        has_shield: shieldFiles.has(`${federation.id}.png`) || Boolean(federationShieldUrls[federation.id]),
        world_rugby_affiliation: worldRugbyAffiliation(federation.id, federation.scope),
        email: admin ? emails.get(federation.id) ?? null : null,
        club_count: associatedClubs.get(federation.id)?.length ?? 0,
        ctrugby_club_count: local ? ctrugbyClubCounts.get(federation.id) ?? 0 : null,
        player_count: local || admin ? playerCounts.get(federation.id) ?? 0 : null,
        participation_count: local ? participationCounts.get(federation.id) ?? 0 : null,
        selection_player_count: local ? local.selectionCounts.get(federation.id) ?? 0 : null,
      })),
      territoryStats: { regions, ctrugbyRegions, national, ctrugbyNational },
      countryMetrics,
      federationPlayers,
    }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido conectar con el catálogo de federaciones." }, { status: 503 });
  }
}
