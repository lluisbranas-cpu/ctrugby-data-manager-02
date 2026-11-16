import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const root = "public/jerseys";
const types = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };
const clubs = await readdir(root, { withFileTypes: true }).catch(() => []);
const items = (await Promise.all(clubs.filter((entry) => entry.isDirectory()).map(async (entry) => {
  const id = entry.name.toUpperCase();
  const names = await readdir(path.join(root, entry.name));
  return Promise.all(names.filter((name) => /^[a-f0-9-]{36}[.](png|jpg|webp)$/i.test(name)).map(async (name) => {
    const file = path.join(root, entry.name, name); const bytes = await readFile(file);
    return { id, name, file, object_key: `jerseys/${id}/${name}`, content_type: types[path.extname(name).toLowerCase()], byte_size: bytes.length, source_sha256: createHash("sha256").update(bytes).digest("hex") };
  }));
}))).flat();
if (!apply) { console.log(JSON.stringify({ mode: "dry-run", images: items.length }, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("La escritura exige --apply --confirm.");
const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const item of items) {
  const upload = await db.storage.from("catalog-operational-private").upload(item.object_key, await readFile(item.file), { upsert: true, contentType: item.content_type });
  if (upload.error) throw new Error(`${item.file}: ${upload.error.message}`);
  const indexed = await db.rpc("likidhub_upsert_operational_media", { p_row: { entity_type: "jersey", entity_id: item.id, variant: item.name, bucket_id: "catalog-operational-private", object_key: item.object_key, content_type: item.content_type, byte_size: item.byte_size, source_sha256: item.source_sha256 } });
  if (indexed.error) throw new Error(`${item.file}: ${indexed.error.message}`);
}
console.log(JSON.stringify({ mode: "apply", uploaded: items.length }, null, 2));
