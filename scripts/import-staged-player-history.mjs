import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan las credenciales de administración de Supabase.");

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const staging = path.join(root, "data", "staging");
const seasons = JSON.parse(await readFile(path.join(staging, "player-seasons.json"), "utf8"));
const photos = JSON.parse(await readFile(path.join(staging, "player-photos", "manifest.json"), "utf8"));
if (!Array.isArray(seasons) || !Array.isArray(photos)) throw new Error("La preparación local no tiene el formato esperado.");

const rows = seasons.map(({ player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm }) => ({ player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm }));
const ids = [...new Set(rows.map((row) => row.player_id))];
const latestSeasonByPlayer = new Map(ids.map((playerId) => [playerId, Math.max(...rows.filter((row) => row.player_id === playerId).map((row) => row.season_year))]));
const removed = await db.schema("app_private").from("player_seasons").delete().in("player_id", ids);
if (removed.error) throw new Error(`No se han podido sustituir las trayectorias: ${removed.error.message}`);
for (let index = 0; index < rows.length; index += 100) {
  const inserted = await db.schema("app_private").from("player_seasons").insert(rows.slice(index, index + 100));
  if (inserted.error) throw new Error(`No se ha podido guardar un bloque de trayectorias: ${inserted.error.message}`);
}

for (const photo of photos) {
  const seasonYear = Number.isInteger(photo.season_year) ? photo.season_year : latestSeasonByPlayer.get(photo.player_id);
  if (!seasonYear || seasonYear < 2000 || seasonYear > 2035) throw new Error(`No hay temporada válida para asociar la foto de ${photo.player_id}.`);
  const bytes = await readFile(photo.prepared_file);
  const storageKey = `player-season-photos/${photo.player_id}/${seasonYear}.png`;
  const localDirectory = path.join(staging, "player-season-photos", photo.player_id);
  await mkdir(localDirectory, { recursive: true });
  await writeFile(path.join(localDirectory, `${seasonYear}.png`), bytes);
  const stored = await db.storage.from("catalog-media-private").upload(storageKey, bytes, { contentType: "image/png", cacheControl: "31536000", upsert: true });
  if (stored.error) throw new Error(`No se ha podido subir ${photo.player_id}: ${stored.error.message}`);
  const linked = await db.rpc("admin_set_player_season_photo", { p_player_id: photo.player_id, p_season_year: seasonYear, p_storage_key: storageKey, p_is_primary: false });
  if (linked.error) throw new Error(`No se ha podido asociar la fotografía de ${photo.player_id} a ${seasonYear}: ${linked.error.message}`);
}
console.log(JSON.stringify({ imported_seasons: rows.length, players: ids.length, photos: photos.length }));
