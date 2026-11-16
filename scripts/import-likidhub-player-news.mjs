import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const validId = (id) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
const root = "data/staging/player-news";
const files = (await readdir(root).catch(() => [])).filter((name) => name.endsWith(".json") && validId(path.basename(name, ".json"))).sort();
const records = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"))));
const imageRoot = "data/staging/player-news-images";
const images = (await readdir(imageRoot).catch(() => [])).filter((name) => name.endsWith(".webp") && validId(path.basename(name, ".webp"))).sort();
if (!apply) { console.log(JSON.stringify({ mode: "dry-run", news: records.length, images: images.length }, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("La escritura exige --apply --confirm.");
const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const document = await db.schema("app_private").from("operational_documents").upsert({ namespace: "news", document_key: "player-news", payload: records, source_sha256: createHash("sha256").update(JSON.stringify(records)).digest("hex"), updated_at: new Date().toISOString() }, { onConflict: "namespace,document_key" });
if (document.error) throw new Error(document.error.message);
for (const name of images) {
  const id = path.basename(name, ".webp"), bytes = await readFile(path.join(imageRoot, name)), object_key = `news-images/${id}.webp`;
  const upload = await db.storage.from("catalog-operational-private").upload(object_key, bytes, { upsert: true, contentType: "image/webp" });
  if (upload.error) throw new Error(`${name}: ${upload.error.message}`);
  const indexed = await db.rpc("likidhub_upsert_operational_media", { p_row: { entity_type: "news-image", entity_id: id, variant: "image", bucket_id: "catalog-operational-private", object_key, content_type: "image/webp", byte_size: bytes.length, source_sha256: createHash("sha256").update(bytes).digest("hex") } });
  if (indexed.error) throw new Error(`${name}: ${indexed.error.message}`);
}
console.log(JSON.stringify({ mode: "apply", news: records.length, images: images.length }, null, 2));
