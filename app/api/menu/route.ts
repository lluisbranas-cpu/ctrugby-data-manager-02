import { readCampusParticipationMetrics } from "@/lib/campus-participations";
import { GET as getPlayers } from "@/app/api/jugadores/route";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Club = { id: string; country?: string | null; region?: string | null };
type Federation = { id: string; scope?: string | null; country?: string | null; territory?: string | null };
type Season = { player_id?: string | null; season_year?: number | null; club_id?: string | null };
type MilestoneParticipant = { id: string; player_id?: string | null };
type Milestone = { participant_id?: string | null };
type CountPair = { ctrugby: number; total: number };
type MenuPlayer = { selected_federation_ids?: string[]; milestone_count?: number; professional_club_records?: unknown[] };

const normalize = (value: string | null | undefined) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();

const belongsToFederation = (club: Club, federation: Federation) => federation.scope === "Nacional"
  ? normalize(club.country) === normalize(federation.country)
  : normalize(club.country) === "espana" && normalize(club.region) === normalize(federation.territory);

async function readJsonArray<T>(name: string) {
  try {
    const raw = await readFile(path.join(process.cwd(), "data", "staging", name), "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? data as T[] : [];
  } catch {
    return [];
  }
}

async function stagedCounts() {
  const [metrics, staff, milestones, milestoneParticipants, players, clubs, federations, seasons] = await Promise.all([
    readCampusParticipationMetrics(),
    readJsonArray<unknown>("staff.json"),
    readJsonArray<Milestone>("milestones.json"),
    readJsonArray<MilestoneParticipant>("milestone-participants.json"),
    readJsonArray<unknown>("players.json"),
    readJsonArray<Club>("clubs.json"),
    readJsonArray<Federation>("federations.json"),
    readJsonArray<Season>("player-seasons.json"),
  ]);
  const participatingPlayerIds = new Set(metrics
    .filter((metric) => (metric.participation_count ?? 0) > 0)
    .map((metric) => metric.player_id)
    .filter((id): id is string => Boolean(id)));
  const ctrugbyClubIds = new Set(seasons
    .filter((season) => (season.season_year ?? 0) >= 2023 && season.club_id && (!season.player_id || participatingPlayerIds.has(season.player_id)))
    .map((season) => season.club_id!));
  const clubsById = new Map(clubs.map((club) => [club.id, club]));
  const ctrugbyClubs = [...ctrugbyClubIds].map((id) => clubsById.get(id)).filter((club): club is Club => Boolean(club));
  const ctrugbyFederations = federations.filter((federation) => ctrugbyClubs.some((club) => belongsToFederation(club, federation))).length;
  const playerIdByParticipant = new Map(milestoneParticipants
    .filter((participant) => participant.player_id)
    .map((participant) => [participant.id, participant.player_id!]));
  const ctrugbyMilestones = milestones.filter((milestone) => {
    const playerId = milestone.participant_id ? playerIdByParticipant.get(milestone.participant_id) : null;
    return Boolean(playerId && participatingPlayerIds.has(playerId));
  }).length;
  return {
    catalog_players: { ctrugby: participatingPlayerIds.size, total: players.length },
    catalog_federations: { ctrugby: ctrugbyFederations, total: federations.length },
    catalog_clubs: { ctrugby: ctrugbyClubIds.size, total: clubs.length },
    catalog_participants: (() => {
      const total = metrics.reduce((sum, metric) => sum + (metric.participation_count ?? 0), 0);
      return { ctrugby: total, total };
    })(),
    catalog_staff: { ctrugby: staff.length, total: staff.length },
    catalog_milestones: { ctrugby: ctrugbyMilestones, total: milestones.length },
  };
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ configured: false, counts: {} });
  try {
    const { db } = await catalogAccess(request);
    const tables = ["catalog_players", "catalog_federations", "catalog_clubs", "catalog_participants", "catalog_staff", "catalog_milestones"] as const;
    const [results, localCounts, selectedResponse] = await Promise.all([
      Promise.allSettled(tables.map((table) => db.from(table).select("id", { count: "exact", head: true }).abortSignal(AbortSignal.timeout(8000)))),
      stagedCounts(),
      getPlayers(new NextRequest(new URL("/api/jugadores?view=public", request.url), { headers: request.headers })).catch(() => null),
    ]);
    const supabaseCounts = Object.fromEntries(tables.map((table, index) => [table, (results[index].status === "fulfilled" ? results[index].value.count ?? 0 : 0)])) as Record<typeof tables[number], number>;
    const counts = Object.fromEntries(tables.map((table) => {
      const local = localCounts[table] as CountPair | undefined;
      if (table === "catalog_participants" && local) return [table, local];
      return [table, local ? { ...local, total: supabaseCounts[table] || local.total } : { ctrugby: supabaseCounts[table], total: supabaseCounts[table] }];
    }));
    const selectedData = selectedResponse?.ok ? await selectedResponse.json().catch(() => null) as { players?: MenuPlayer[] } | null : null;
    const selectedTotal = (selectedData?.players ?? []).filter((player) => (player.selected_federation_ids?.length ?? 0) > 0 || (player.milestone_count ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0).length;
    Object.assign(counts, { catalog_selected: { ctrugby: selectedTotal, total: selectedTotal } });
    return NextResponse.json({
      configured: true,
      counts,
    }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ configured: false, counts: {} }, { status: 503 });
  }
}
