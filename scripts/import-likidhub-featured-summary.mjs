import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const sourceUrl = new URL(process.env.CTRUGBY_FEATURED_SOURCE_URL ?? "http://localhost:3000");
const fetchJson = async (path) => {
  const response = await fetch(new URL(path, sourceUrl), { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
};
const [directory, savedOrder] = await Promise.all([
  fetchJson("/api/jugadores?view=public&trajectory=summary"),
  fetchJson("/api/destacados/order"),
]);
const featured = (directory.players ?? []).filter((player) => (player.selected_federation_ids?.length ?? 0) > 0 || (player.milestone_count ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0);
const featuredById = new Map(featured.map((player) => [player.id, player]));
const order = (savedOrder.order ?? []).filter((id) => featuredById.has(id));
if (featured.length !== 99 || order.length !== 99 || new Set(order).size !== 99 || order.some((id) => !/^JUG\d{4}$/.test(id))) throw new Error("La fuente no coincide con los 99 destacados auditados y su orden guardado.");
const sourceUpdatedAt = new Date().toISOString();
const rows = order.map((jugId, index) => {
  const player = featuredById.get(jugId);
  const source = {
    player_id: `CTR${jugId.slice(3)}`,
    featured_rank: index + 1,
    milestone_count: Number(player.milestone_count ?? 0),
    selected_federation_ids: player.selected_federation_ids ?? [],
    selected_federation_counts: player.selected_federation_counts ?? {},
    professional_club_records: player.professional_club_records ?? [],
  };
  return { ...source, source_sha256: createHash("sha256").update(JSON.stringify(source)).digest("hex"), source_updated_at: sourceUpdatedAt };
});
const summary = { mode: apply ? "apply" : "dry-run", writes: 0, source: sourceUrl.origin, planned_rows: rows.length, featured_rank: { first: rows[0]?.featured_rank ?? null, last: rows.at(-1)?.featured_rank ?? null }, duplicate_player_ids: rows.length - new Set(rows.map((row) => row.player_id)).size, duplicate_source_hashes: rows.length - new Set(rows.map((row) => row.source_sha256)).size, translated_jug_to_ctr: rows.every((row) => /^CTR\d{4}$/.test(row.player_id)) };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (summary.duplicate_player_ids || summary.duplicate_source_hashes || !summary.translated_jug_to_ctr) throw new Error("La simulación contiene IDs o hashes no válidos.");
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const row of rows) {
  const result = await db.rpc("likidhub_upsert_player_featured_summary", { p_row: row });
  if (result.error) throw new Error(`${row.player_id}: ${result.error.message}`);
  summary.writes++;
}
console.log(JSON.stringify(summary, null, 2));
