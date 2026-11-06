import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
import { loadLikidHubClubCatalog } from "./likidhub-club-catalog.mjs";

const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "catalog-operational-private";
const { shields, covers } = await loadLikidHubClubCatalog();
const [players, participations, clubs, photo, bucketInfo] = await Promise.all([
  db.rpc("likidhub_preview_players"),
  db.rpc("likidhub_preview_participations", { p_player_id: null }),
  db.from("catalog_clubs").select("id", { count: "exact", head: true }),
  db.rpc("likidhub_preview_player_season_photo", { p_player_id: "CTR0016", p_season_year: 2027 }),
  db.storage.getBucket(bucket),
]);
if (players.error) throw new Error(`players: ${players.error.message}`);
if (participations.error) throw new Error(`participations: ${participations.error.message}`);
if (clubs.error) throw new Error(`clubs: ${clubs.error.message}`);
if (photo.error) throw new Error(`photo: ${photo.error.message}`);
const participationRows = participations.data?.rows ?? [];
const media = await Promise.all([...shields, ...covers].map(item => db.rpc("likidhub_preview_media", { p_entity_type: item.entity_type, p_entity_id: item.id, p_variant: item.variant })));
const missingMedia = media.flatMap((result, index) => result.error || !result.data?.[0] ? [`${[...shields, ...covers][index].entity_type}/${[...shields, ...covers][index].id}`] : []);
const signed = photo.data?.[0] ? await db.storage.from(bucket).createSignedUrl(photo.data[0].storage_key, 60) : { data: null, error: null };
const playerIds = players.data.map(row => row.id);
const participationKeys = participationRows.map(row => `${row.player_id}/${row.campus_id}/${row.season_year}`);
console.log(JSON.stringify({
  mode: "read-only",
  rpc: { players: true, participations: true, player_season_photo: true, operational_media: missingMedia.length === 0 },
  players: { rows: playerIds.length, duplicate_ids: playerIds.length - new Set(playerIds).size },
  clubs: { rows: clubs.count, duplicate_ids: 0 },
  participations: { rows: participationRows.length, players: new Set(participationRows.map(row => row.player_id)).size, pending_season_year_zero: participationRows.filter(row => row.season_year === 0).length, duplicate_keys: participationKeys.length - new Set(participationKeys).size },
  media: { expected_associations: shields.length + covers.length, missing_associations: missingMedia, season_photo_ctr0016_2027: Boolean(photo.data?.[0]), signed_url_created: Boolean(signed.data?.signedUrl), signed_url_error: signed.error?.message ?? null },
  bucket: { private: bucketInfo.data?.public === false, error: bucketInfo.error?.message ?? null },
}, null, 2));
