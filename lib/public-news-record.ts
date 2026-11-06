import type { PlayerNews } from "./player-news";

// Published entries expose display fields, not payment, registration or import data.
export function publicNewsRecord(record: PlayerNews): PlayerNews {
  const selection = record.selection;
  const participation = record.participation;
  return {
    id: record.id, player_id: record.player_id, type: record.type,
    date_or_season: record.date_or_season, title: record.title, url: record.url,
    published: record.published, updated_at: record.updated_at,
    image_url: record.image_url, image_updated_at: record.image_updated_at, image_source: record.image_source,
    selection: selection ? {
      federation_id: selection.federation_id, category: selection.category, format: selection.format,
      gender: selection.gender, event: selection.event, scope: selection.scope,
      season_label: selection.season_label, club_text: selection.club_text,
      position_text: selection.position_text, player_name: selection.player_name,
    } : null,
    participation: participation ? {
      kind: participation.kind, category: participation.category, club_id: participation.club_id,
      club_name: participation.club_name, club_category: participation.club_category,
      campus_id: participation.campus_id, year: participation.year, count: participation.count,
      pending_year: participation.pending_year, season_label: participation.season_label,
      player_name: participation.player_name,
    } : null,
  };
}
