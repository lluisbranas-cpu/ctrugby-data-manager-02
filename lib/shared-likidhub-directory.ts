import "server-only";

import { catalogServiceClient } from "@/lib/catalog";

type Player = { id: string; first_name: string; last_name: string | null; published: boolean; version: number };
type Profile = { player_id: string; category: string | null; birth_year: number | null };
type Season = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Club = { id: string; name: string; country: string | null; city: string | null; region: string | null; province: string | null; latitude: number | null; longitude: number | null; maps_url: string | null; active: boolean | null };
type Metric = { player_id: string; participation_count: number };
type Milestone = { participant_id: string };
type Participant = { id: string; player_id: string | null };

const publicId = (id: string) => /^CTR\d{4}$/.test(id) ? `JUG${id.slice(3)}` : id;

export async function sharedLikidHubDirectory() {
  // This code always runs on the server. It selects only the non-sensitive
  // fields required by the public player directory from the shared database.
  const db = catalogServiceClient();
  const [playersResult, profilesResult, seasonsResult, clubsResult, metricsResult, milestonesResult, participantsResult] = await Promise.all([
    db.from("catalog_players").select("id,first_name,last_name,published,version").eq("published", true).order("id").range(0, 9999),
    db.schema("app_private").from("player_profiles").select("player_id,category,birth_year"),
    db.schema("app_private").from("player_seasons").select("player_id,season_year,club_id,legacy_club_name,position_text,weight_kg,height_cm"),
    db.from("catalog_clubs").select("id,name,country,city,region,province,latitude,maps_url,active").eq("published", true).order("name"),
    db.schema("app_private").from("player_participation_metrics").select("player_id,participation_count"),
    db.from("catalog_milestones").select("participant_id").eq("published", true),
    db.from("catalog_participants").select("id,player_id").eq("published", true),
  ]);

  for (const result of [playersResult, profilesResult, seasonsResult, clubsResult, metricsResult, milestonesResult, participantsResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const players = (playersResult.data ?? []) as Player[];
  const visibleIds = new Set(players.map((player) => player.id));
  const profiles = new Map(((profilesResult.data ?? []) as Profile[]).map((profile) => [profile.player_id, profile]));
  const metrics = new Map(((metricsResult.data ?? []) as Metric[]).map((metric) => [metric.player_id, metric.participation_count]));
  const playerByParticipant = new Map(((participantsResult.data ?? []) as Participant[])
    .filter((participant) => participant.player_id && visibleIds.has(participant.player_id))
    .map((participant) => [participant.id, participant.player_id!]));
  const milestones = new Map<string, number>();
  for (const milestone of (milestonesResult.data ?? []) as Milestone[]) {
    const playerId = playerByParticipant.get(milestone.participant_id);
    if (playerId) milestones.set(playerId, (milestones.get(playerId) ?? 0) + 1);
  }

  const seasons = ((seasonsResult.data ?? []) as Season[])
    .filter((season) => visibleIds.has(season.player_id))
    .map((season) => ({ ...season, player_id: publicId(season.player_id) }));
  const clubs = ((clubsResult.data ?? []) as Club[]).map((club) => ({ ...club, active: club.active ?? true }));

  return {
    configured: true,
    admin: false,
    source: "supabase-shared",
    players: players.map((player) => {
      const profile = profiles.get(player.id);
      return {
        id: publicId(player.id),
        first_name: player.first_name,
        last_name: player.last_name,
        published: true,
        version: player.version,
        profile: { category: profile?.category ?? null, birth_year: profile?.birth_year ?? null },
        participation_count: metrics.get(player.id) ?? 0,
        news_count: 0,
        milestone_count: milestones.get(player.id) ?? 0,
        selected_federation_ids: [],
        selected_federation_counts: {},
        professional_clubs: [],
        professional_club_records: [],
        club_groups: [],
      };
    }),
    seasons,
    clubs,
    photos: {},
  };
}
