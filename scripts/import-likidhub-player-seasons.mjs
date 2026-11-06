import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const confirmed = new Map([["JUG0270", "CTR0270"], ["JUG0275", "CTR0275"]]);
const playerId = (id) => confirmed.get(id) ?? `CTR${id.slice(3)}`;
const isSeason = (row) => /^JUG\d{4}$/.test(row.player_id) && Number.isInteger(row.season_year) && row.season_year >= 2000 && row.season_year <= 2035;

const [players, sourceSeasons] = await Promise.all([
  readFile("data/staging/players.json", "utf8").then(JSON.parse),
  readFile("data/staging/player-seasons.json", "utf8").then(JSON.parse),
]);
const allowedPlayers = new Set(players.filter((player) => player.id !== "JUG0381").map((player) => player.id));
const invalid = sourceSeasons.filter((season) => !isSeason(season));
const rows = sourceSeasons
  .filter((season) => allowedPlayers.has(season.player_id))
  .map((season) => ({
    player_id: playerId(season.player_id),
    season_year: season.season_year,
    registration_number: season.registration_number ?? null,
    club_id: season.club_id ?? null,
    legacy_club_name: season.legacy_club_name ?? null,
    position_text: season.position_text ?? null,
    weight_kg: season.weight_kg ?? null,
    height_cm: season.height_cm ?? null,
  }));
const duplicateKeys = [...rows.reduce((duplicates, row) => {
  const key = `${row.player_id}/${row.season_year}`;
  duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
  return duplicates;
}, new Map()).entries()].filter(([, count]) => count > 1).map(([key]) => key);

const env = await likidHubEnv();
const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const [remotePlayers, remoteClubs, previewPlayers] = await Promise.all([
  db.from("catalog_players").select("id"),
  db.from("catalog_clubs").select("id"),
  db.rpc("likidhub_preview_players"),
]);
for (const result of [remotePlayers, remoteClubs, previewPlayers]) if (result.error) throw new Error(result.error.message);
const remotePlayerIds = new Set(remotePlayers.data.map((player) => player.id));
const remoteClubIds = new Set(remoteClubs.data.map((club) => club.id));
const missingPlayers = [...new Set(rows.map((row) => row.player_id).filter((id) => !remotePlayerIds.has(id)))].sort();
const missingClubs = [...new Set(rows.map((row) => row.club_id).filter((id) => id && !remoteClubIds.has(id)))].sort();

const root = await db.storage.from("catalog-operational-private").list("player-season-photos", { limit: 1000, sortBy: { column: "name", order: "asc" } });
if (root.error) throw new Error(root.error.message);
const storagePhotos = [];
for (const folder of root.data.filter((item) => item.id === null)) {
  const listed = await db.storage.from("catalog-operational-private").list(`player-season-photos/${folder.name}`, { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (listed.error) throw new Error(`${folder.name}: ${listed.error.message}`);
  for (const item of listed.data) {
    const match = item.name.match(/^(20\d{2})\.png$/);
    if (match) storagePhotos.push({ player_id: folder.name, season_year: Number(match[1]) });
  }
}
const checkedPhotos = [];
for (let index = 0; index < storagePhotos.length; index += 12) {
  checkedPhotos.push(...await Promise.all(storagePhotos.slice(index, index + 12).map(async (photo) => {
    const relation = await db.rpc("likidhub_preview_player_season_photo", { p_player_id: photo.player_id, p_season_year: photo.season_year });
    if (relation.error) throw new Error(`${photo.player_id}/${photo.season_year}: ${relation.error.message}`);
    return { ...photo, associated: (relation.data ?? []).length === 1 };
  })));
}

const blockers = {
  invalid_source_rows: invalid.length,
  duplicate_keys: duplicateKeys,
  players_missing_in_likidhub: missingPlayers,
  clubs_missing_in_likidhub: missingClubs,
};
const summary = {
  mode: apply ? "apply" : "dry-run",
  writes: 0,
  source: { total_seasons: sourceSeasons.length, excluded_player: "JUG0381", excluded_seasons: sourceSeasons.filter((season) => season.player_id === "JUG0381").length },
  planned: { player_seasons: rows.length, players: new Set(rows.map((row) => row.player_id)).size, club_references: rows.filter((row) => row.club_id).length, legacy_club_only: rows.filter((row) => !row.club_id && row.legacy_club_name).length },
  remote: { players: remotePlayers.data.length, visible_player_seasons: previewPlayers.data.filter((player) => player.current_season_year !== null).length, season_photo_objects: storagePhotos.length, verified_season_photo_relations: checkedPhotos.filter((photo) => photo.associated).length, season_photo_players: new Set(checkedPhotos.filter((photo) => photo.associated).map((photo) => photo.player_id)).size },
  bridge: { JUG_to_CTR: "CTR + cuatro dígitos; JUG0270 y JUG0275 confirmados", unresolved: [] },
  blockers,
};
const hasBlockers = Object.values(blockers).some((value) => Array.isArray(value) ? value.length > 0 : value > 0);
if (apply && !process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (hasBlockers) { console.log(JSON.stringify(summary, null, 2)); throw new Error("La simulación contiene bloqueos; no se ha escrito nada."); }
if (apply) {
  for (const row of rows) {
    const result = await db.rpc("likidhub_upsert_player_season", { p_row: row });
    if (result.error) throw new Error(`${row.player_id}/${row.season_year}: ${result.error.message}`);
    summary.writes++;
  }
}
console.log(JSON.stringify(summary, null, 2));
