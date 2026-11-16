import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const localText = await readFile(".env.local", "utf8");
const localUrl = localText.split(/\r?\n/).map(line => line.trim()).find(line => line.startsWith("SUPABASE_URL="))?.slice("SUPABASE_URL=".length)?.replace(/^['"]|['"]$/g, "");
const shared = await likidHubEnv();
if (!localUrl || localUrl.replace(/\/$/, "") !== shared.url.replace(/\/$/, "")) throw new Error("Local y producción no apuntan a la misma base de Supabase.");

const db = createClient(shared.url, shared.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const pause = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));
async function checks() {
  return Promise.all([
    db.rpc("likidhub_critical_structure"),
    db.from("catalog_players").select("id", { count: "exact", head: true }),
    db.from("catalog_clubs").select("id", { count: "exact", head: true }),
    db.rpc("likidhub_preview_participations", { p_player_id: null }),
    db.schema("app_private").from("operational_documents").select("namespace", { count: "exact", head: true }),
    db.schema("app_private").from("operational_media").select("entity_id").limit(1),
  ]);
}
let results = await checks();
if (results.some(result => result.error?.message.includes("JWT issued at future"))) {
  await pause(350);
  results = await checks();
}
const [structure, players, clubs, participations, documents, media] = results;
for (const [name, result] of Object.entries({ structure, players, clubs, participations, documents, media })) if (result.error) throw new Error(`${name}: ${result.error.message}`);
const missing = (structure.data ?? []).filter(item => !item.present).map(item => item.component);
if (missing.length) throw new Error(`Falta estructura crítica: ${missing.join(", ")}`);
const counts = { players: players.count ?? 0, clubs: clubs.count ?? 0, participations: participations.data?.rows?.length ?? 0, documents: documents.count ?? 0, media_index_available: media.data?.length ?? 0 };
if (!Object.values(counts).every(value => value > 0)) throw new Error("Faltan datos críticos para publicar.");
console.log(JSON.stringify({ ready: true, endpoint: new URL(shared.url).host, counts, structure: "ok" }, null, 2));
