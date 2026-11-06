import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { issueCount, loadPlayerNewsImagePlan } from "./likidhub-player-news.mjs";

const apply = process.argv.includes("--apply");
const { images, issues, diagnostics } = await loadPlayerNewsImagePlan();
const summary = { mode: apply ? "apply" : "dry-run", uploads: 0, associations: 0, planned_images: images.length, duplicate_news_ids: images.length - new Set(images.map((image) => image.news_id)).size, issues, diagnostics };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (issueCount(issues) || summary.duplicate_news_ids) throw new Error("La simulación contiene asociaciones no resueltas o duplicadas.");
const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const image of images) {
  const known = await db.rpc("likidhub_preview_player_news_media", { p_news_id: image.news_id });
  if (known.error) throw new Error(`${image.news_id}: ${known.error.message}`);
  const previous = known.data?.[0];
  if (previous?.source_sha256 === image.source_sha256 && previous.object_key === image.object_key) continue;
  const upload = await db.storage.from(image.bucket_id).upload(image.object_key, await (await import("node:fs/promises")).readFile(image.file), { upsert: true, contentType: image.content_type });
  if (upload.error) throw new Error(`${image.news_id}: ${upload.error.message}`);
  summary.uploads++;
  const associated = await db.rpc("likidhub_upsert_player_news_media", { p_row: image });
  if (associated.error) throw new Error(`${image.news_id}: ${associated.error.message}`);
  summary.associations++;
}
console.log(JSON.stringify(summary, null, 2));
