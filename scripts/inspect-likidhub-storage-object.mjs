import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { likidHubEnv } from "./likidhub-env.mjs";

const bucket = "catalog-operational-private";
const requestedKey = process.argv[2] ?? "player-season-photos/CTRginales/2027-179318315043.webp";
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const prefix = requestedKey.slice(0, requestedKey.lastIndexOf("/"));
const { data: entries, error: listError } = await db.storage.from(bucket).list(prefix, { limit: 100 });
if (listError) throw new Error(listError.message);
const exact = (entries ?? []).find(entry => `${prefix}/${entry.name}` === requestedKey);
const target = exact ? requestedKey : (entries?.length === 1 ? `${prefix}/${entries[0].name}` : null);
if (!target) throw new Error("No se ha encontrado un objeto único para inspeccionar.");
const entry = (entries ?? []).find(item => `${prefix}/${item.name}` === target);
const { data: signed, error: signedError } = await db.storage.from(bucket).createSignedUrl(target, 300);
if (signedError) throw new Error(signedError.message);
const { data: blob, error: downloadError } = await db.storage.from(bucket).download(target);
if (downloadError) throw new Error(downloadError.message);
const bytes = Buffer.from(await blob.arrayBuffer());
const image = await sharp(bytes).metadata();
const temporaryCopy = path.join(tmpdir(), `likidhub-inspection-${path.basename(target)}`);
await writeFile(temporaryCopy, bytes);
console.log(JSON.stringify({
  mode: "read-only",
  requested_key: requestedKey,
  resolved_key: target,
  requested_key_exact_match: Boolean(exact),
  object_metadata: entry?.metadata ?? null,
  image: { format: image.format, width: image.width, height: image.height, has_alpha: image.hasAlpha, size_bytes: bytes.length },
  signed_url_expires_in_seconds: 300,
  signed_url: signed.signedUrl,
  temporary_copy: temporaryCopy
}, null, 2));
