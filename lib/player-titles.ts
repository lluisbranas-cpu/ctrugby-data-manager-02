import playerTitles from "@/data/staging/player-titles.json";

export type PlayerTitle = {
  id: string;
  title?: string;
  year?: number;
  competition?: string;
  edition?: number;
  achievement?: string;
  team?: string;
  result?: string;
  date?: string;
  source_name?: string;
  source_url?: string;
  staff_ids?: string[];
  player_ids: string[];
  unlinked_participants?: string[];
  image_key?: string;
  image_updated_at?: string | null;
};

export function playerTitleLabel(title: PlayerTitle): string {
  return title.title || [title.achievement, title.competition].filter(Boolean).join(" · ");
}

export function playerTitleYear(title: PlayerTitle): number | null {
  return title.year ?? title.edition ?? null;
}

export function getPlayerTitlesForPlayer(playerId: string): PlayerTitle[] {
  const titles: PlayerTitle[] = playerTitles;
  return titles
    .filter((title) => title.player_ids.includes(playerId))
    .sort((left, right) => (playerTitleYear(right) ?? 0) - (playerTitleYear(left) ?? 0));
}
