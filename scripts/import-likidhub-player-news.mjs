import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { issueCount, loadPlayerNewsPlan } from "./likidhub-player-news.mjs";

const apply = process.argv.includes("--apply");
const { rows, issues } = await loadPlayerNewsPlan();
const summary = { mode: apply ? "apply" : "dry-run", writes: 0, planned_rows: rows.length, players: new Set(rows.map((row) => row.player_id)).size, kinds: Object.fromEntries(["news", "selection", "participation"].map((kind) => [kind, rows.filter((row) => row.kind === kind).length])), published: rows.filter((row) => row.published).length, duplicate_ids: rows.length - new Set(rows.map((row) => row.local_id)).size, issues };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (issueCount(issues) || summary.duplicate_ids) throw new Error("La simulación contiene referencias rotas o duplicados.");
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const row of rows) {
  const { local_id, ...payload } = row;
  const result = await db.rpc("likidhub_upsert_player_news", { p_row: { ...payload, id: local_id } });
  if (result.error) throw new Error(`${local_id}: ${result.error.message}`);
  summary.writes++;
}
console.log(JSON.stringify(summary, null, 2));
