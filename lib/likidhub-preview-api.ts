import "server-only";
import { previewLikidHubClubs, previewLikidHubFeaturedSummaries, previewLikidHubParticipations, previewLikidHubPlayers } from "@/lib/likidhub-preview";

type PreviewPlayer = {
  id: string; first_name: string; last_name: string | null; published: boolean;
  category: string | null; birth_year: number | null; current_season_year: number | null;
  current_club_id: string | null; current_club_name: string | null; position_text: string | null;
};
type PreviewParticipation = {
  campus_id: string; player_id: string; season_year: number; pending_year: boolean;
  email_enabled: boolean; participation_count: number; registration_number: string | null;
  created_at: string; updated_at: string;
};

const noStore = { "Cache-Control": "private, no-store", Vary: "Cookie" };

async function previewData() {
  const [players, participations, clubs, featured] = await Promise.all([
    previewLikidHubPlayers() as Promise<PreviewPlayer[]>,
    previewLikidHubParticipations() as Promise<{ rows?: PreviewParticipation[] }>,
    previewLikidHubClubs(),
    previewLikidHubFeaturedSummaries().catch((error: Error) => {
      if (/likidhub_preview_featured_summary|schema cache/i.test(error.message)) return [];
      throw error;
    }),
  ]);
  return { players, participations: participations.rows ?? [], clubs, featured };
}

export async function likidHubPreviewPlayersResponse() {
  const { players, participations, clubs, featured } = await previewData();
  const counts = new Map<string, number>();
  for (const row of participations) counts.set(row.player_id, (counts.get(row.player_id) ?? 0) + 1);
  const featuredByPlayer = new Map(featured.map((row) => [row.player_id, row]));
  return Response.json({
    configured: true,
    admin: false,
    source: "likidhub",
    players: players.map((player) => {
      const summary = featuredByPlayer.get(player.id);
      const professionalClubRecords = summary?.professional_club_records ?? [];
      return {
      id: player.id, first_name: player.first_name, last_name: player.last_name, published: player.published, version: 1,
      profile: { category: player.category, birth_year: player.birth_year },
      participation_count: counts.get(player.id) ?? 0, milestone_count: summary?.milestone_count ?? 0, news_count: 0,
      selected_federation_ids: summary?.selected_federation_ids ?? [], selected_federation_counts: summary?.selected_federation_counts ?? {},
      professional_clubs: [...new Set(professionalClubRecords.map((record) => record.club_name).filter((name): name is string => Boolean(name)))], professional_club_records: professionalClubRecords, club_groups: [],
    }; }),
    seasons: players.flatMap((player) => player.current_season_year ? [{
      player_id: player.id, season_year: player.current_season_year, club_id: player.current_club_id,
      legacy_club_name: player.current_club_name, position_text: player.position_text, weight_kg: null, height_cm: null,
    }] : []),
    clubs,
    photos: {},
  }, { headers: noStore });
}

export async function likidHubPreviewParticipationsResponse() {
  const { players, participations, clubs } = await previewData();
  const playersById = new Map(players.map((player) => [player.id, player]));
  const years = new Map<number, Set<string>>();
  for (const row of participations) {
    const set = years.get(row.season_year) ?? new Set<string>();
    set.add(row.player_id);
    years.set(row.season_year, set);
  }
  return Response.json({
    configured: true,
    admin: false,
    source: "likidhub",
    summary: { players: new Set(participations.map((row) => row.player_id)).size, participations: participations.length, years: years.size, clubs: clubs.length },
    years: [...years.entries()].map(([year, playerIds]) => ({ year: String(year), players: playerIds.size, participations: participations.filter((row) => row.season_year === year).length })).sort((left, right) => Number(right.year) - Number(left.year)),
    clubs: clubs.map((club) => ({ club_id: club.id, club_name: club.name, players: 0, participations: 0 })),
    campuses: [],
    clubOptions: clubs,
    participations: participations.map((row) => ({
      ...row,
      first_name: playersById.get(row.player_id)?.first_name ?? "Jugador",
      last_name: playersById.get(row.player_id)?.last_name ?? null,
      display_name: [playersById.get(row.player_id)?.first_name, playersById.get(row.player_id)?.last_name].filter(Boolean).join(" ") || row.player_id,
      primary_photo_url: null,
      category: playersById.get(row.player_id)?.category ?? null,
      birth_year: playersById.get(row.player_id)?.birth_year ?? null,
      participation_years: [String(row.season_year)],
      participation_campus: { [String(row.season_year)]: row.campus_id },
      participation_registration_numbers: row.registration_number ? { [`${row.campus_id}:${row.season_year}`]: row.registration_number } : {},
      participation_email_enabled: row.email_enabled,
      participation_pending_year: row.pending_year,
      current_club_id: null,
      current_club_name: null,
      current_season_year: row.season_year,
      position_text: null,
      contact_email: null,
    })),
    players: players.map((player) => ({ id: player.id, name: [player.first_name, player.last_name].filter(Boolean).join(" "), primary_photo_url: null, category: player.category, birth_year: player.birth_year, current_club_id: player.current_club_id, current_club_name: player.current_club_name, position_text: player.position_text, contact_email: null, participation_count: participations.filter((row) => row.player_id === player.id).length, participation_years: participations.filter((row) => row.player_id === player.id).map((row) => String(row.season_year)), participation_campus: {}, participation_registration_numbers: {}, participation_email_enabled: true, participation_pending_year: false })),
  }, { headers: noStore });
}

export async function likidHubPreviewClubsResponse() {
  const clubs = await previewLikidHubClubs();
  return Response.json({ configured: true, admin: false, source: "likidhub", clubs: clubs.map((club) => ({ ...club, active: club.published, founded_text: null, disappeared_text: null, city: null, province: null, region: null, country: null, latitude: null, longitude: null, maps_url: null, website: null, instagram: null, has_shield: false, player_count: 0, participation_count: 0 })) }, { headers: noStore });
}
