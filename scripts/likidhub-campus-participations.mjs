import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const csvRows = (text) => text.trim().split(/\r?\n/).slice(1).map(line => {
  const values = [...line.matchAll(/"([^"]*)"|([^,]+)/g)].map(match => match[1] ?? match[2]);
  return values;
});
export async function loadJugCtrBridge() {
  const [main, variants] = await Promise.all([
    readFile("reports/player-id-reconciliation-20261105/puente-jug-a-ctr.csv", "utf8"),
    readFile("reports/player-id-reconciliation-20261105/puente-jug-a-ctr-variantes-confirmadas.csv", "utf8"),
  ]);
  const bridge = new Map();
  for (const [jug, ctr, status] of csvRows(main)) if (status === "correspondencia segura" && /^JUG\d{4}$/.test(jug) && /^CTR\d{4}$/.test(ctr)) bridge.set(jug, ctr);
  for (const [jug, ctr] of csvRows(variants)) if (/^JUG\d{4}$/.test(jug) && /^CTR\d{4}$/.test(ctr)) bridge.set(jug, ctr);
  if (bridge.size !== 388 || bridge.has("JUG0381") || new Set(bridge.values()).size !== 388) throw new Error("Puente JUG→CTR inválido.");
  return bridge;
}
export const sha256 = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function flattenCampusMetrics(metrics, bridge) {
  const rows = [], excluded = [];
  for (const metric of metrics) {
    const playerId = bridge.get(metric.player_id);
    if (!playerId) { excluded.push(metric.player_id); continue; }
    const campusByYear = metric.participation_campus ?? metric.participation_campuses ?? {};
    const years = [...new Set((metric.participation_years ?? []).map(String))].filter(year => /^20\d{2}$/.test(year));
    for (const year of years) {
      const campusId = campusByYear[year] || "CAM001";
      const registration = metric.participation_registration_numbers?.[`${campusId}:${year}`] ?? metric.participation_registration_numbers?.[year] ?? null;
      const source = { local_player_id: metric.player_id, campus_id: campusId, season_year: Number(year), participation_count: 1, registration_number: registration, email_enabled: metric.participation_email_enabled !== false, pending_year: false };
      rows.push({ player_id: playerId, campus_id: campusId, season_year: Number(year), participation_count: 1, registration_number: registration, email_enabled: metric.participation_email_enabled !== false, pending_year: false, source_sha256: sha256(source) });
    }
    const pendingCount = Math.max(0, Number(metric.participation_count ?? 0) - years.length);
    if (pendingCount || metric.participation_pending_year) {
      const source = { local_player_id: metric.player_id, campus_id: "CAM001", season_year: 0, participation_count: Math.max(1, pendingCount), registration_number: null, email_enabled: metric.participation_email_enabled !== false, pending_year: true };
      rows.push({ player_id: playerId, campus_id: "CAM001", season_year: 0, participation_count: Math.max(1, pendingCount), registration_number: null, email_enabled: metric.participation_email_enabled !== false, pending_year: true, source_sha256: sha256(source) });
    }
  }
  return { rows, excluded: [...new Set(excluded)].sort() };
}
