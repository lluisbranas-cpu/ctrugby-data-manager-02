export function moveFeaturedPlayer(ids: string[], id: string, position: number) {
  if (!ids.includes(id) || !Number.isInteger(position) || position < 1 || position > ids.length) return ids;
  const next = ids.filter((value) => value !== id);
  next.splice(position - 1, 0, id);
  return next;
}

export function compareFeaturedPlayers(a: { id: string; first_name: string; last_name: string | null }, b: { id: string; first_name: string; last_name: string | null }, order: Map<string, number>) {
  return (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || [a.first_name, a.last_name].filter(Boolean).join(" ").localeCompare([b.first_name, b.last_name].filter(Boolean).join(" "), "es") || a.id.localeCompare(b.id);
}

export type FeaturedMetricsPlayer = { id: string; first_name: string; last_name: string | null; selected_federation_counts?: Record<string, number>; professional_clubs?: string[]; professional_club_records?: unknown[]; participation_count?: number; news_count?: number };
export function featuredMetrics(player: FeaturedMetricsPlayer) {
  const count = (prefix: string) => Object.entries(player.selected_federation_counts ?? {}).filter(([id]) => id.startsWith(prefix)).reduce((sum, [, value]) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0), 0);
  return { national: count("FN"), regional: count("FT"), clubs: player.professional_clubs ? new Set(player.professional_clubs).size : player.professional_club_records?.length ?? 0, campus: player.participation_count ?? 0, news: player.news_count ?? 0 };
}
export function compareFeaturedPriority(a: FeaturedMetricsPlayer, b: FeaturedMetricsPlayer) {
  const x = featuredMetrics(a), y = featuredMetrics(b);
  return y.national - x.national || y.regional - x.regional || y.clubs - x.clubs || y.campus - x.campus || y.news - x.news || [a.first_name, a.last_name].filter(Boolean).join(" ").localeCompare([b.first_name, b.last_name].filter(Boolean).join(" "), "es") || a.id.localeCompare(b.id);
}
