import { newsDateSortKey } from "@/app/lib/news-date";
import type { PlayerNews } from "@/lib/player-news";
export type NewsSortKey = "player" | "image" | "date" | "title" | "url" | "status" | "category" | "format" | "gender" | "registration";
export type NewsSort = {key: NewsSortKey; direction: 1 | -1} | null;
export function sortNewsRows(rows: PlayerNews[], players: {id: string; name: string}[], sort: NewsSort): PlayerNews[] {
  if (!sort) return rows;
  const names = new Map(players.map(player => [player.id, player.name]));
  const compare = (a: string,b: string) => a.localeCompare(b, "es", {numeric: true, sensitivity: "base"});
  const value = (record: PlayerNews): string => sort.key === "registration" ? record.participation?.registration_number || "" : sort.key === "category" ? record.selection?.category || "" : sort.key === "format" ? record.selection?.format || "" : sort.key === "gender" ? record.selection?.gender || "" : sort.key === "player" ? names.get(record.player_id) || record.player_id : sort.key === "date" ? newsDateSortKey(record.date_or_season) : sort.key === "image" ? record.image_updated_at || record.image_url ? "1" : "0" : sort.key === "status" ? record.published ? "1" : "0" : record[sort.key];
  return [...rows].sort((a,b) => {
    const left = value(a), right = value(b);
    if (sort.key === "date" && (!left || !right)) return left ? -1 : right ? 1 : a.id.localeCompare(b.id);
    return compare(left, right) * sort.direction || compare(names.get(a.player_id) || a.player_id,names.get(b.player_id) || b.player_id) || a.id.localeCompare(b.id);
  });
}
