import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { flattenCampusMetrics, loadJugCtrBridge } from "./likidhub-campus-participations.mjs";

const apply = process.argv.includes("--apply");
const [metrics, bridge] = await Promise.all([readFile("data/staging/player-participation-metrics.json", "utf8").then(JSON.parse), loadJugCtrBridge()]);
const { rows, excluded } = flattenCampusMetrics(metrics, bridge);
const keys = rows.map(row => `${row.player_id}/${row.campus_id}/${row.season_year}`);
const summary = {
  mode: apply ? "apply" : "dry-run", writes: 0, planned_rows: rows.length,
  players: new Set(rows.map(row => row.player_id)).size,
  pending_year_rows: rows.filter(row => row.pending_year).length,
  duplicate_keys: keys.length - new Set(keys).size,
  excluded_unmatched_local_players: excluded,
};
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (summary.duplicate_keys || excluded.length) throw new Error("La simulación contiene claves duplicadas o jugadores sin correspondencia.");
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const row of rows) {
  const result = await db.rpc("likidhub_upsert_player_participation", { p_row: row });
  if (result.error) throw new Error(`${row.player_id}/${row.campus_id}/${row.season_year}: ${result.error.message}`);
  summary.writes++;
}
console.log(JSON.stringify(summary, null, 2));
