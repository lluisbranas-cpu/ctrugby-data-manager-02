import { readPlayerNews, savePlayerNews, deletePlayerNews, type PlayerNews } from "./player-news";

export type CampusMetric = {
  player_id: string; participation_count: number; participation_years: string[];
  participation_campus?: Record<string, string>; participation_campuses?: Record<string, string>;
  participation_registration_numbers?: Record<string, string>;
  participation_email_enabled?: boolean; participation_pending_year?: boolean;
};
export type CampusEditionReference = { id: string; label: string; siglas?: string | null };
export type CampusEdition = { campus_id: string; campus: string; year: string; price_eur: number };

/**
 * La tabla de Campus se compone de las participaciones registradas: así cada
 * edición nueva aparece automáticamente cuando se asigna a un jugador.
 */
export function detectedCampusEditions(metrics: CampusMetric[], campuses: CampusEditionReference[]): CampusEdition[] {
  const campusById = new Map(campuses.map((campus) => [campus.id, campus]));
  const editions = new Map<string, CampusEdition>();
  for (const metric of metrics) {
    const campusMap = metric.participation_campus ?? metric.participation_campuses ?? {};
    for (const year of metric.participation_years) {
      const campusId = campusMap[year] || "CAM001";
      const campus = campusById.get(campusId);
      const isH2_27 = campus?.siglas?.trim().toUpperCase() === "H2" && year === "2027";
      const key = `${campusId}:${year}`;
      editions.set(key, { campus_id: campusId, campus: campus?.label ?? campusId, year, price_eur: isH2_27 ? 199 : 1 });
    }
  }
  return [...editions.values()].sort((a, b) => a.campus.localeCompare(b.campus, "es") || Number(a.year) - Number(b.year));
}
export const isCampusParticipation = (record: PlayerNews) => record.type === "participacion" && record.participation?.kind === "campus";

export async function readCampusParticipationMetrics(includeUnpublished = false): Promise<CampusMetric[]> {
  const records = (await readPlayerNews()).filter(record => isCampusParticipation(record) && (includeUnpublished || record.published));
  const metrics = new Map<string, CampusMetric>();
  for (const record of records) {
    const data = record.participation!;
    const metric = metrics.get(record.player_id) ?? {player_id: record.player_id, participation_count: 0, participation_years: [], participation_campus: {}, participation_registration_numbers: {}};
    metric.participation_count += data.count ?? 1;
    if (data.year) {
      if (!metric.participation_years.includes(data.year)) metric.participation_years.push(data.year);
      metric.participation_campus![data.year] = data.campus_id || "CAM001";
      if (data.registration_number) metric.participation_registration_numbers![(data.campus_id || "CAM001") + ":" + data.year] = data.registration_number;
    }
    if (data.pending_year || !data.year) metric.participation_pending_year = true;
    if (data.email_enabled === false) metric.participation_email_enabled = false;
    metrics.set(record.player_id, metric);
  }
  return [...metrics.values()].map(metric => ({...metric, participation_years: metric.participation_years.sort()}));
}

// Compatibility for existing cards, exports and lists; the records remain the source of truth.
export async function readCampusMetricsJson() { return JSON.stringify(await readCampusParticipationMetrics()); }

export async function saveCampusParticipationMetrics(next: CampusMetric[], previous: CampusMetric[]) {
  const ids = new Set([...next, ...previous].map(metric => metric.player_id));
  for (const id of ids) {
    const before = previous.find(metric => metric.player_id === id);
    const after = next.find(metric => metric.player_id === id);
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    await saveCampusPlayerMetric(id, after);
  }
}

export async function saveCampusPlayerMetric(playerId: string, metric?: CampusMetric) {
  const records = (await readPlayerNews(playerId)).filter(isCampusParticipation);
  if (!metric) {for (const record of records) await deletePlayerNews(record.id); return;}
  const retained = new Set<string>();
  const campusMap = metric.participation_campus ?? metric.participation_campuses ?? {};
  for (const year of metric.participation_years) {
    const campus = campusMap[year] || "CAM001";
    const previous = records.find(record => record.participation?.year === year && record.participation?.campus_id === campus) ?? records.find(record => record.participation?.year === year);
    const saved = await savePlayerNews({...(previous ?? {}), player_id: playerId, type: "participacion", title: previous?.title || "Participación en campus · " + year, date_or_season: year, url: "", published: previous?.published ?? true,
      participation: {category: "", club_id: null, club_name: "", club_category: "", ...previous?.participation, kind: "campus", campus_id: campus, year, pending_year: false, count: 1, registration_number: metric.participation_registration_numbers?.[campus + ":" + year] || metric.participation_registration_numbers?.[year] || "", email_enabled: metric.participation_email_enabled !== false}});
    retained.add(saved.id);
  }
  const missing = Math.max(0, metric.participation_count - metric.participation_years.length);
  if (missing || metric.participation_pending_year) {
    const previous = records.find(record => !record.participation?.year);
    const saved = await savePlayerNews({...(previous ?? {}), player_id: playerId, type: "participacion", title: "Participación en campus · año pendiente", date_or_season: "", url: "", published: previous?.published ?? true,
      participation: {category: "", club_id: null, club_name: "", club_category: "", ...previous?.participation, kind: "campus", campus_id: previous?.participation?.campus_id || "CAM001", year: null, pending_year: true, count: missing, email_enabled: metric.participation_email_enabled !== false}});
    retained.add(saved.id);
  }
  for (const record of records) if (record.published && !retained.has(record.id)) await deletePlayerNews(record.id);
}
