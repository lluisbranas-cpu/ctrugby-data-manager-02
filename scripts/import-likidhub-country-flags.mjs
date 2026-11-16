import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const root = "public/country-flags";
const flagFiles = (await readdir(root).catch(() => []))
  .filter((name) => /^[A-Z0-9]{2,12}[.]png$/i.test(name))
  .sort();
const manifest = await Promise.all(flagFiles.map(async (name) => {
  const bytes = await readFile(path.join(root, name));
  const id = path.basename(name, ".png").toUpperCase();
  return {
    id,
    file: path.join(root, name),
    object_key: `country-flags/${id}.png`,
    byte_size: bytes.length,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}));

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", flags: manifest }, null, 2));
  process.exit(0);
}
if (!process.argv.includes("--confirm")) throw new Error("La escritura exige --apply --confirm.");

const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const item of manifest) {
  const uploaded = await db.storage.from("catalog-operational-private").upload(item.object_key, await readFile(item.file), { contentType: "image/png", upsert: true });
  if (uploaded.error) throw new Error(`${item.file}: ${uploaded.error.message}`);
  const indexed = await db.rpc("likidhub_upsert_operational_media", {
    p_row: {
      entity_type: "country-flag",
      entity_id: item.id,
      variant: "flag",
      bucket_id: "catalog-operational-private",
      object_key: item.object_key,
      content_type: "image/png",
      byte_size: item.byte_size,
      source_sha256: item.source_sha256,
    },
  });
  if (indexed.error) throw new Error(`${item.file}: ${indexed.error.message}`);
}
console.log(JSON.stringify({ mode: "apply", uploaded: manifest.length }, null, 2));
