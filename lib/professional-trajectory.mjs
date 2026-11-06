export function professionalSeasonYear(label) {
  const match = String(label ?? "").trim().match(/^(\d{4}|\d{2})\s*[/–-]\s*(\d{4}|\d{2})$/);
  if (!match) return null;
  const start = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const end = Number(match[2].length === 2 ? `${String(start).slice(0, 2)}${match[2]}` : match[2]);
  return end === start + 1 && end >= 2000 && end <= 2035 ? end : null;
}

// A dated professional record is evidence for that season only. Never extend it
// to other years, or remove a record that cannot be transferred unambiguously.
export function planProfessionalTrajectory(records, seasons, playerIds, clubs, resolveClubId) {
  const merged = new Map(seasons.map(season => [`${season.player_id}|${season.season_year}`, { ...season }]));
  const transferred = [];
  const pending = [];
  const categories = new Map();
  for (const record of records) {
    const year = professionalSeasonYear(record.season_label);
    const key = `${record.player_id}|${year}`;
    const related = records.filter(item => item.player_id === record.player_id && professionalSeasonYear(item.season_label) === year);
    const clubId = item => clubs.some(club => club.id === item.club_id) ? item.club_id : resolveClubId(item.club_name, clubs);
    const clubKeys = new Set(related.map(item => clubId(item) || item.club_name?.trim().toLowerCase()).filter(Boolean));
    if (!year || !playerIds.has(record.player_id) || !record.category?.trim() || clubKeys.size > 1) {
      pending.push({ record, reason: !year ? 'Sin temporada válida' : !playerIds.has(record.player_id) ? 'Jugador no encontrado' : !record.category?.trim() ? 'Sin categoría' : 'Varios clubes en la misma temporada' });
      continue;
    }
    const current = merged.get(key) ?? { player_id: record.player_id, season_year: year, club_id: null, legacy_club_name: null, position_text: null, weight_kg: null, height_cm: null, registration_number: null };
    const resolvedClub = clubId(record);
    if (resolvedClub || record.club_name?.trim()) {
      current.club_id = resolvedClub;
      current.legacy_club_name = resolvedClub ? null : record.club_name.trim();
    }
    merged.set(key, current);
    categories.set(key, [...new Set([...(categories.get(key) ?? []), record.category.trim()])]);
    transferred.push({ record, season_year: year });
  }
  return { seasons: [...merged.values()], categories: Object.fromEntries([...categories].map(([key, values]) => [key, values.join(' / ')])), transferred, pending };
}
