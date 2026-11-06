type Season = { player_id?: string; season_year: number; club_id: string | null; club_name?: string | null; legacy_club_name?: string | null; competition_category?: string | null };
type Club = { id: string; name: string };
type Category = { id: string; label: string; type?: string };
const normalize = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

// Only the club and professional category recorded for this season are evidence.
export function trajectoryProfessionalClubs(seasons: Season[], clubs: Club[] = [], categories: Category[] = []) {
  const clubNames = new Map(clubs.map(club => [club.id, club.name]));
  const categoryIds = new Map(categories.filter(category => category.type !== "CAMP").map(category => [normalize(category.label), category.id]));
  const seen = new Set<string>();
  return [...seasons].sort((a, b) => b.season_year - a.season_year).flatMap(season => {
    const name = (season.club_id ? clubNames.get(season.club_id) : null) || season.club_name || season.legacy_club_name || "";
    if (!name.trim() || !Number.isInteger(season.season_year)) return [];
    return (season.competition_category || "").split(/\s+\/\s+/).flatMap(value => {
      const category = value.trim();
      if (!category) return [];
      const key = JSON.stringify([season.player_id || "", season.season_year, season.club_id || normalize(name), normalize(category)]);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: `trajectory-${key}`, player_id: season.player_id || "", player_name: "", club_id: season.club_id, club_name: name.trim(), category,
        category_id: categoryIds.get(normalize(category)) || null,
        season_label: `${String(season.season_year - 1).slice(-2)}/${String(season.season_year).slice(-2)}`, notes: null, created_at: "" }];
    });
  });
}
