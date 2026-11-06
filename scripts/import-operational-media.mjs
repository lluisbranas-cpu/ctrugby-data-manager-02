import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const roots = ["data/staging/club-shields/originales", "data/staging/club-covers/originales", "data/staging/federation-shields/originales", "data/staging/federation-covers/originales", "data/staging/player-covers/originales", "data/staging/player-season-photos", "data/staging/staff-photos/originales", "data/staging/staff-covers/originales", "data/staging/jerseys/originales", "data/staging/player-news-images"];
async function walk(directory) { const entries = await readdir(directory, { withFileTypes: true }).catch(() => []); return (await Promise.all(entries.map(async (entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)]))).flat(); }
const files = (await Promise.all(roots.map(walk))).flat();
const contentType = (file) => file.endsWith(".png") ? "image/png" : file.endsWith(".jpg") || file.endsWith(".jpeg") ? "image/jpeg" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream";
const manifest = await Promise.all(files.map(async (file) => { const bytes = await readFile(file); const storage_key = `operational/${file.replaceAll("\\", "/").replace(/^data\/staging\//, "")}`; return { file, storage_key, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length, content_type: contentType(file), entity_id: createHash("sha256").update(storage_key).digest("hex").slice(0, 40) }; }));
if (!apply) { console.log(JSON.stringify({ mode: "dry-run", files: manifest.length, manifest }, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("La escritura exige --apply --confirm.");
const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const item of manifest) {
  const stored = await db.storage.from("catalog-operational-private").upload(item.storage_key, await readFile(item.file), { contentType: item.content_type, upsert: true });
  if (stored.error) throw new Error(`${item.file}: ${stored.error.message}`);
  const indexed = await db.schema("app_private").from("operational_media").upsert({ entity_type: "file", entity_id: item.entity_id, variant: "source", bucket_id: "catalog-operational-private", object_key: item.storage_key, content_type: item.content_type, byte_size: item.bytes, source_sha256: item.sha256, updated_at: new Date().toISOString() }, { onConflict: "entity_type,entity_id,variant" });
  if (indexed.error) throw new Error(`${item.file}: ${indexed.error.message}`);
}
console.log(JSON.stringify({ mode: "apply", files: manifest.length }, null, 2));
