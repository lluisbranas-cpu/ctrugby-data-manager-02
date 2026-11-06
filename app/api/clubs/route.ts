import { clubShieldUrls } from "@/app/lib/club-shields";
import { withGroupClubs, readGroupMemberships } from "@/lib/temporary-group-clubs";
import { readCampusMetricsJson } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
import { mergeMilestoneTrajectory } from "@/lib/milestone-trajectory";
import { mergeClubDirectoryOverrides } from "@/lib/club-directory-overrides";
import { likidHubPreviewReadOnly } from "@/lib/likidhub-preview";
import { likidHubPreviewClubsResponse } from "@/lib/likidhub-preview-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Season = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Metric = { player_id: string; participation_count: number };
type Milestone = { participant_id: string; season_label?: string | null; club_text?: string | null; position_text?: string | null };
type MilestoneParticipant = { id: string; player_id: string | null };
type Club = { id: string; name: string; active: boolean; founded_text: string | null; disappeared_text?: string | null; city: string; province: string; region: string; country: string; latitude: number; longitude: number; maps_url: string; website: string | null; instagram: string | null };

export async function GET(request: NextRequest) {
  if (likidHubPreviewReadOnly()) {
    try { return await likidHubPreviewClubsResponse(); }
    catch { return NextResponse.json({ error: "No se pudieron leer los clubs LikidHub." }, { status: 503 }); }
  }
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ configured: false, clubs: [] }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    const { data, error } = await db.from("catalog_clubs")
      .select("id,name,active,founded_text,disappeared_text,city,province,region,country,latitude,longitude,maps_url,website,instagram")
      .order("country").order("name");
    if (error) return NextResponse.json({ error: "No se han podido cargar los clubs publicados." }, { status: 503 });

    const base = path.join(process.cwd(), "data", "staging");
    const [seasonsRaw, metricsRaw, milestonesRaw, participantsRaw] = await Promise.all([
      readFile(path.join(base, "player-seasons.json"), "utf8"),
      readCampusMetricsJson(),
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
    ]);
    const seasons = mergeMilestoneTrajectory(JSON.parse(seasonsRaw) as Season[], JSON.parse(milestonesRaw) as Milestone[], JSON.parse(participantsRaw) as MilestoneParticipant[], data ?? []);
    const recentSeasons = seasons.filter((season) => season.club_id && season.season_year >= 2023);
    const participationByPlayer = new Map((JSON.parse(metricsRaw) as Metric[]).map((metric) => [metric.player_id, metric.participation_count]));
    const playerIdsByClub = new Map<string, Set<string>>();
    for (const season of recentSeasons) {
      const players = playerIdsByClub.get(season.club_id!) ?? new Set<string>();
      players.add(season.player_id);
      playerIdsByClub.set(season.club_id!, players);
    }
    for (const [playerId, memberships] of await readGroupMemberships(seasons)) for (const membership of memberships) { const players = playerIdsByClub.get(membership.club_id) ?? new Set<string>(); players.add(playerId); playerIdsByClub.set(membership.club_id, players); }
    const shieldFiles = new Set(await readdir(path.join(process.cwd(), "public/club-shields")).catch(error => { if (error.code === "ENOENT") return []; throw error; }));
    const clubs = (await withGroupClubs(mergeClubDirectoryOverrides((data ?? []) as Club[]))).map((club) => {
      const playerIds = playerIdsByClub.get(club.id) ?? new Set<string>();
      return {
        ...club,
        has_shield: shieldFiles.has(club.id + ".png") || Boolean(clubShieldUrls[club.id]),
        player_count: playerIds.size,
        participation_count: [...playerIds].reduce((total, playerId) => total + (participationByPlayer.get(playerId) ?? 0), 0),
      };
    });
    return NextResponse.json({ configured: true, admin, clubs }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido conectar con el catálogo de clubs." }, { status: 503 });
  }
}
