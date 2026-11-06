import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { loadLikidHubClubCatalog } from "./likidhub-club-catalog.mjs";

const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "catalog-operational-private";
const list = async prefix => {
  const result = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  if (result.error) throw new Error(`${prefix}: ${result.error.message}`);
  return (result.data ?? []).filter(item => item.id !== null).map(item => `${prefix}/${item.name}`);
};
const [{ catalog, shields, covers, summary }, clubs, bucketInfo, storedShields, storedCovers, participation] = await Promise.all([
  loadLikidHubClubCatalog(),
  db.from("catalog_clubs").select("id", { count: "exact", head: true }),
  db.storage.getBucket(bucket),
  list("club-shields"),
  list("club-covers"),
  db.rpc("likidhub_preview_participations", { p_player_id: null }),
]);
const expectedShields = new Set(shields.map(item => item.key));
const expectedCovers = new Set(covers.map(item => item.key));
const presentShields = new Set(storedShields);
const presentCovers = new Set(storedCovers);
const participationRows = participation.error ? null : participation.data?.rows;
console.log(JSON.stringify({
  mode: "read-only",
  catalog_clubs: { expected: catalog.length, remote_count: clubs.count, error: clubs.error?.message ?? null, duplicate_ids: summary.catalog_duplicate_ids },
  participations: {
    expected_rows: 507,
    expected_players: 337,
    expected_pending_season_year_zero: 18,
    remote_count: Array.isArray(participationRows) ? participationRows.length : null,
    read_rpc_error: participation.error?.message ?? null,
    duplicate_keys: "La clave primaria (player_id,campus_id,season_year) impide duplicados; la simulación previa detectó 0.",
  },
  media: {
    bucket_private: bucketInfo.data?.public === false,
    bucket_error: bucketInfo.error?.message ?? null,
    canonical_shields_expected: expectedShields.size,
    canonical_shields_missing: [...expectedShields].filter(key => !presentShields.has(key)),
    canonical_covers_expected: expectedCovers.size,
    canonical_covers_missing: [...expectedCovers].filter(key => !presentCovers.has(key)),
    stored_shield_objects: storedShields.length,
    stored_cover_objects: storedCovers.length,
    extra_historical_shield_objects: storedShields.filter(key => !expectedShields.has(key)),
    excluded_from_current_lot: summary.excluded_shield_ids,
    duplicate_storage_keys: storedShields.length + storedCovers.length - new Set([...storedShields, ...storedCovers]).size,
  },
  errors: [],
}, null, 2));
