export type ClubGroupMembership = { club_id: string; name: string; season_year: number; category: string | null; group_season: string; group_category: string };
export const normalizeGroupCategory = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^sub[ -]?/, "s").replace(/[^a-z0-9]/g, "");
export function groupMembershipMatches(row: ClubGroupMembership, year?: string | number | null, category?: string | null) {
  const filteredYear = year && year !== "all" ? String(year) : "";
  if (filteredYear) {
    const end = filteredYear.includes("/") ? Number(filteredYear.split("/")[1]) % 100 : Number(filteredYear) % 100;
    if (row.season_year % 100 !== end || Number(row.group_season.split("/")[1]) !== end) return false;
  }
  if (category && category !== "all") {
    const key = normalizeGroupCategory(category);
    if (normalizeGroupCategory(row.group_category) !== key || normalizeGroupCategory(row.category || "") !== key) return false;
  }
  return true;
}
export function groupSearchNames(rows: ClubGroupMembership[] = [], year?: string | number | null, category?: string | null) {
  return [...new Set(rows.filter(row => groupMembershipMatches(row, year, category)).map(row => row.name))];
}
