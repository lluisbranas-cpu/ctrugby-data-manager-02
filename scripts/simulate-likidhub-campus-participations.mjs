import { readFile } from "node:fs/promises";
import { flattenCampusMetrics, loadJugCtrBridge } from "./likidhub-campus-participations.mjs";

const [metrics, bridge] = await Promise.all([readFile("data/staging/player-participation-metrics.json", "utf8").then(JSON.parse), loadJugCtrBridge()]);
const { rows, excluded } = flattenCampusMetrics(metrics, bridge);
const keys = rows.map(row => `${row.player_id}/${row.campus_id}/${row.season_year}`);
console.log(JSON.stringify({
  mode: "dry-run", writes: 0,
  source: "data/staging/player-participation-metrics.json",
  metrics: metrics.length,
  planned_rows: rows.length,
  players: new Set(rows.map(row => row.player_id)).size,
  pending_year_rows: rows.filter(row => row.pending_year).length,
  duplicate_keys: keys.length - new Set(keys).size,
  excluded_unmatched_local_players: excluded,
  bridge_correspondences: bridge.size,
}, null, 2));
