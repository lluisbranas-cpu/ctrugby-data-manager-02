type ClubSeason = { season_year: number; club_id?: string | null; club_name?: string | null; legacy_club_name?: string | null };

// Rugby seasons are stored by their ending year (2026/27 = 2027).
export function currentRugbySeasonYear(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "numeric" }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")!.value);
  const month = Number(parts.find((part) => part.type === "month")!.value);
  return year + (month >= 7 ? 1 : 0);
}

export function currentClubSeason<T extends ClubSeason>(seasons: readonly T[], date = new Date()): T | null {
  const withClub = seasons.filter((season) => Boolean(season.club_id || season.club_name?.trim() || season.legacy_club_name?.trim()));
  return withClub.find((season) => season.season_year === currentRugbySeasonYear(date))
    ?? [...withClub].sort((a, b) => b.season_year - a.season_year)[0] ?? null;
}
