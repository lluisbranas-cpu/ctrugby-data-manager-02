import { readFile } from "node:fs/promises";
import { flattenCampusMetrics, loadJugCtrBridge } from "./likidhub-campus-participations.mjs";
import { loadLikidHubClubCatalog } from "./likidhub-club-catalog.mjs";

const [metrics, bridge, clubs] = await Promise.all([readFile("data/staging/player-participation-metrics.json", "utf8").then(JSON.parse), loadJugCtrBridge(), loadLikidHubClubCatalog()]);
const participations = flattenCampusMetrics(metrics, bridge);
const keys = participations.rows.map(row => `${row.player_id}/${row.campus_id}/${row.season_year}`);
console.log(JSON.stringify({
  mode: "dry-run", writes: 0, changes_outside_scope: 0,
  participations: { rows: participations.rows.length, players: new Set(participations.rows.map(row => row.player_id)).size, pending_season_year_zero: participations.rows.filter(row => row.season_year === 0).length, duplicate_keys: keys.length - new Set(keys).size, excluded_unmatched_local_players: participations.excluded },
  clubs: { rows: clubs.summary.catalog_clubs, duplicate_ids: clubs.summary.catalog_duplicate_ids, canonical_shields: clubs.summary.canonical_shields, duplicate_shield_source_ids: clubs.summary.shield_duplicate_ids, covers: clubs.summary.covers, excluded_shield_ids: clubs.summary.excluded_shield_ids, sources: clubs.summary.sources },
}, null, 2));
