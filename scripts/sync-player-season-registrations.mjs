import { readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
nextEnv.loadEnvConfig(root);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan las credenciales de administración de Supabase.");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seasons = JSON.parse(await readFile(path.join(root, "data", "staging", "player-seasons.json"), "utf8"));
if (!Array.isArray(seasons)) throw new Error("La preparación local de temporadas no tiene el formato esperado.");

let updated = 0;
for (const season of seasons) {
  const result = await db.schema("app_private").from("player_seasons")
    .update({ registration_number: season.registration_number ?? null })
    .eq("player_id", season.player_id)
    .eq("season_year", season.season_year);
  if (result.error) {
    throw new Error(`${season.player_id} ${season.season_year}: ${result.error.message}`);
  }
  updated += 1;
}

console.log(JSON.stringify({
  updated,
  with_registration: seasons.filter((season) => season.registration_number).length,
  without_registration: seasons.filter((season) => !season.registration_number).length,
}));
