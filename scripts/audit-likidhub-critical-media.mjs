import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "catalog-operational-private";

const listTree = async prefix => {
  const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error(`${prefix}: ${error.message}`);
  const files = [];
  for (const entry of data ?? []) {
    const key = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) files.push(...await listTree(key)); else files.push(key);
  }
  return files;
};

const prefixes = ["player-portraits", "player-season-photos", "club-shields", "club-covers"];
const lists = Object.fromEntries(await Promise.all(prefixes.map(async prefix => [prefix, await listTree(prefix)])));
const all = Object.values(lists).flat();
const unexpectedSeasonPhotoKeys = lists["player-season-photos"].filter(key => !/^player-season-photos\/CTR\d{4}\/20\d{2}\.png$/.test(key));
const { data: bucketInfo, error: bucketError } = await db.storage.getBucket(bucket);
if (bucketError) throw new Error(`bucket: ${bucketError.message}`);
console.log(JSON.stringify({
  mode: "read-only",
  bucket,
  bucket_private: bucketInfo.public === false,
  counts: {
    portrait: lists["player-portraits"].length,
    "season-photo": lists["player-season-photos"].length,
    "club-shield": lists["club-shields"].length,
    "club-cover": lists["club-covers"].length
  },
  total: all.length,
  duplicate_storage_keys: all.length - new Set(all).size,
  unexpected_season_photo_keys: unexpectedSeasonPhotoKeys,
  season_photo_associations: "app_private remains intentionally unavailable to PostgREST; association RPC acknowledgements are recorded by the importer.",
  errors: []
}, null, 2));
