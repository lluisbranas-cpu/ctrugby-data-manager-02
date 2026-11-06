import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { loadLikidHubClubCatalog } from "./likidhub-club-catalog.mjs";

const apply = process.argv.includes("--apply");
const { catalog, shields, covers, summary: source } = await loadLikidHubClubCatalog();
const summary = { mode: apply ? "apply" : "dry-run", writes: 0, ...source, planned: { clubs: catalog.length, shields: shields.length, covers: covers.length } };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (source.catalog_duplicate_ids || source.shield_duplicate_ids !== 22 || source.excluded_shield_ids.join(",") !== "ENG0001,ESP0210") throw new Error("La selección canónica de clubs no coincide con la revisión aprobada.");
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const club of catalog) { const result = await db.rpc("likidhub_upsert_club", { p_row: club }); if (result.error) throw new Error(`${club.id}: ${result.error.message}`); summary.writes++; }
for (const item of [...shields, ...covers]) {
  const upload = await db.storage.from(item.bucket_id).upload(item.key, await readFile(item.file), { upsert: true, contentType: item.content_type });
  if (upload.error) throw new Error(`${item.key}: ${upload.error.message}`);
  const index = await db.rpc("likidhub_upsert_operational_media", { p_row: { entity_type: item.entity_type, entity_id: item.id, variant: item.variant, bucket_id: item.bucket_id, object_key: item.key, content_type: item.content_type, byte_size: item.bytes, source_sha256: item.source_sha256 } });
  if (index.error) throw new Error(`${item.key}: ${index.error.message}`);
  summary.writes++;
}
console.log(JSON.stringify(summary, null, 2));
