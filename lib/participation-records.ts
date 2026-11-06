import { readPlayerNews } from "./player-news";
import { participationFromBody } from "./news-participation";
import type { ProfessionalClubMilestone } from "./professional-club-milestones";

export async function readParticipationRecords(includeUnpublished = false): Promise<ProfessionalClubMilestone[]> {
  return (await readPlayerNews()).filter(record => record.type === "participacion" && record.participation?.kind !== "campus" && (includeUnpublished || record.published)).flatMap((record): ProfessionalClubMilestone[] => {
    const data = participationFromBody(record.participation); if (!data) return [];
    return [{id: record.id, source_news_id: record.id, player_id: record.player_id, player_name: data.player_name || record.player_id, category: data.category, club_id: data.club_id, club_name: data.club_name, season_label: data.season_label !== undefined ? data.season_label : record.date_or_season || null, notes: data.notes ?? null, created_at: data.created_at !== undefined ? data.created_at : record.updated_at}];
  });
}
