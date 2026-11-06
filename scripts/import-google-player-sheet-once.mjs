import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import XLSX from "xlsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Faltan las credenciales de administración de Supabase.");
}

const workbookPath = path.resolve(process.argv[2] || "");
if (!workbookPath) throw new Error("Uso: node scripts/import-google-player-sheet-once.mjs <hoja-exportada.xlsx>");

const now = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = path.join(root, "outputs", "google-player-sheet-import", now);
const preparedPhotoRoot = path.join(outputRoot, "prepared-photos");
await mkdir(preparedPhotoRoot, { recursive: true });

const service = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminEmail = (process.env.CTRUGBY_LOCAL_ADMIN_EMAIL ?? "ctrugbyhub@gmail.com").trim().toLowerCase();
const link = await service.auth.admin.generateLink({ type: "magiclink", email: adminEmail });
if (link.error || !link.data.properties?.email_otp) {
  throw new Error(link.error?.message || "No se ha podido generar una sesión local de administrador.");
}
const anonymous = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const verified = await anonymous.auth.verifyOtp({ email: adminEmail, token: link.data.properties.email_otp, type: "email" });
if (verified.error || !verified.data.session) {
  throw new Error(verified.error?.message || "No se ha podido verificar la sesión local de administrador.");
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${verified.data.session.access_token}` } },
});
const role = await db.rpc("app_is_admin");
if (role.error || role.data !== true) throw new Error("La cuenta configurada no tiene permisos de administración.");

const normalize = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase("es-ES")
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const optionalText = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text || null;
};

const parseSeasonYear = (value) => {
  const text = optionalText(value);
  if (!text) return null;
  const range = text.match(/\b(20\d{2})\s*[-/]\s*(20\d{2})\b/);
  if (range) return Number(range[2]);
  const current = text.match(/Actual a\s+(20\d{2})/i);
  if (current) return Number(current[1]);
  const single = text.match(/\b(20\d{2})\b/);
  return single ? Number(single[1]) : null;
};

const parseMetric = (value, maximum) => {
  const text = optionalText(value);
  if (!text) return null;
  const number = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 && number <= maximum ? number : null;
};

const scoreRow = (row) =>
  (row.club ? 8 : 0) +
  (row.position_text ? 4 : 0) +
  (row.height_cm ? 2 : 0) +
  (row.weight_kg ? 2 : 0) +
  (row.photo_url ? 1 : 0) +
  (/^Actual a/i.test(row.season_label ?? "") ? 16 : 0);

const workbook = XLSX.readFile(workbookPath, { cellDates: false });
const worksheet = workbook.Sheets.Jugadores;
if (!worksheet) throw new Error("No se ha encontrado la pestaña 'Jugadores'.");

const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }).map((raw) => ({
  player_id: optionalText(raw["ID CTRugby"])?.toUpperCase() ?? "",
  name: optionalText(raw["Nombre"]),
  gender: optionalText(raw["Género"]),
  season_label: optionalText(raw["Temporada / corte"]),
  season_year: parseSeasonYear(raw["Temporada / corte"]),
  club: optionalText(raw["Club"]),
  position_text: optionalText(raw["Posición"]),
  height_cm: parseMetric(raw["Altura"], 260),
  weight_kg: parseMetric(raw["Peso"], 250),
  photo_url: optionalText(raw["Foto URL"]),
  source_url: optionalText(raw["Fuente"]),
})).filter((row) => /^JUG\d{4}$/.test(row.player_id) && row.season_year);

const { data: players, error: playersError } = await db.from("catalog_players").select("id");
if (playersError) throw new Error(`No se han podido leer los jugadores: ${playersError.message}`);
const knownPlayers = new Set((players ?? []).map((player) => player.id));

const { data: clubs, error: clubsError } = await db.from("catalog_clubs").select("id,name");
if (clubsError) throw new Error(`No se han podido leer los clubs: ${clubsError.message}`);

const aliases = new Map([
  ["barca rugby", "ESP0029"],
  ["fc barcelona", "ESP0029"],
  ["rugby fcbarcelona", "ESP0029"],
  ["buc", "ESP0004"],
  ["buc ubae", "ESP0004"],
  ["rc cornella", "ESP0024"],
  ["r c cornella", "ESP0024"],
  ["cr sant cugat", "ESP0009"],
  ["rc sant cugat", "ESP0009"],
  ["sant cugat", "ESP0009"],
  ["ue santboiana", "ESP0034"],
  ["u e santboiana", "ESP0034"],
  ["ues", "ESP0034"],
  ["gotics rc", "ESP0015"],
  ["gotics rugby club", "ESP0015"],
  ["quimic er", "ESP0019"],
  ["quimic equip rugby", "ESP0019"],
  ["rugby cabrera", "ESP0022"],
  ["rc badalona", "ESP0023"],
  ["rugby club badalona", "ESP0023"],
  ["rugby club ponent", "ESP0177"],
  ["rugby manresa", "ESP0030"],
  ["manresa rc", "ESP0030"],
  ["usap de perpinyà", "FRA0001"],
  ["usap de perpignan", "FRA0001"],
  ["as beziers herault", "FRA0005"],
  ["as beziers", "FRA0005"],
  ["vrac quesos entrepinares", "ESP0099"],
  ["complutense cisneros", "ESP0049"],
  ["getxo rt", "ESP0109"],
]);

const clubNames = new Map();
for (const club of clubs ?? []) {
  const key = normalize(club.name);
  clubNames.set(key, [...(clubNames.get(key) ?? []), club.id]);
}

const clubIdFor = (clubName) => {
  const key = normalize(clubName);
  if (!key) return null;
  if (aliases.has(key)) return aliases.get(key);
  const exact = clubNames.get(key) ?? [];
  if (exact.length === 1) return exact[0];
  const contained = (clubs ?? []).filter((club) => {
    const normalized = normalize(club.name);
    return normalized && (normalized.includes(key) || key.includes(normalized));
  });
  return contained.length === 1 ? contained[0].id : null;
};

const chosen = new Map();
const unknownPlayers = new Set();
for (const row of rows) {
  if (!knownPlayers.has(row.player_id)) {
    unknownPlayers.add(row.player_id);
    continue;
  }
  const key = `${row.player_id}|${row.season_year}`;
  const current = chosen.get(key);
  if (!current || scoreRow(row) > scoreRow(current)) chosen.set(key, row);
}

const seasons = [...chosen.values()]
  .map((row) => ({
    player_id: row.player_id,
    season_year: row.season_year,
    registration_number: null,
    club_id: clubIdFor(row.club),
    legacy_club_name: row.club,
    position_text: row.position_text,
    weight_kg: row.weight_kg,
    height_cm: row.height_cm,
    source_url: row.source_url,
  }))
  .sort((a, b) => a.player_id.localeCompare(b.player_id) || a.season_year - b.season_year);

const playerIds = [...new Set(seasons.map((season) => season.player_id))];
if (!playerIds.length) throw new Error("No hay temporadas válidas para importar.");

const existing = await db.rpc("admin_player_sheet_data");
if (existing.error) throw new Error(`No se ha podido crear la copia de seguridad: ${existing.error.message}`);
const existingSeasons = ((existing.data?.seasons ?? [])).filter((season) => playerIds.includes(season.player_id));

await writeFile(path.join(outputRoot, "player-seasons-backup.json"), `${JSON.stringify(existingSeasons, null, 2)}\n`);
await writeFile(path.join(outputRoot, "player-seasons-from-google-sheet.json"), `${JSON.stringify(seasons, null, 2)}\n`);

const bestPhotoByPlayer = new Map();
for (const row of rows.filter((row) => knownPlayers.has(row.player_id) && row.photo_url)) {
  const current = bestPhotoByPlayer.get(row.player_id);
  if (!current || row.season_year > current.season_year || (row.season_year === current.season_year && scoreRow(row) > scoreRow(current))) {
    bestPhotoByPlayer.set(row.player_id, row);
  }
}

const mask = Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="150" fill="white"/></svg>');
const rim = Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="147.5" fill="none" stroke="white" stroke-width="3"/></svg>');
const photos = [];
const photoFailures = [];
for (const row of bestPhotoByPlayer.values()) {
  try {
    const response = await fetch(row.photo_url, {
      headers: { "User-Agent": "Mozilla/5.0 CTRugby Data Manager photo import" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const prepared = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate()
      .resize(300, 300, { fit: "cover" })
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }, { input: rim }])
      .png()
      .toBuffer();
    const prepared_file = path.join(preparedPhotoRoot, `${row.player_id}.png`);
    await writeFile(prepared_file, prepared);
    photos.push({
      player_id: row.player_id,
      storage_key: `player-season-photos/${row.player_id}/${row.season_year}.png`,
      prepared_file,
      source_url: row.photo_url,
      season_year: row.season_year,
    });
  } catch (error) {
    photoFailures.push({ player_id: row.player_id, source_url: row.photo_url, error: error instanceof Error ? error.message : String(error) });
  }
}

await writeFile(path.join(outputRoot, "player-photos-manifest.json"), `${JSON.stringify(photos, null, 2)}\n`);

const seasonsByPlayer = new Map();
for (const season of seasons.map(({ player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm }) => ({ player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm }))) {
  seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);
}
for (const [playerId, playerSeasons] of seasonsByPlayer) {
  const saved = await db.rpc("admin_replace_player_trajectory", { p_player_id: playerId, p_seasons: playerSeasons });
  if (saved.error) throw new Error(`No se ha podido guardar la trayectoria de ${playerId}: ${saved.error.message}`);
}

const uploaded = [];
for (const photo of photos) {
  const bytes = await readFile(photo.prepared_file);
  const stored = await db.storage.from("catalog-media-private").upload(photo.storage_key, bytes, {
    contentType: "image/png",
    cacheControl: "31536000",
    upsert: true,
  });
  if (stored.error) throw new Error(`No se ha podido subir ${photo.player_id}: ${stored.error.message}`);
  uploaded.push(photo.storage_key);
}

if (photos.length) {
  for (const photo of photos) {
    const linked = await db.rpc("admin_set_player_season_photo", { p_player_id: photo.player_id, p_season_year: photo.season_year, p_storage_key: photo.storage_key, p_is_primary: false });
    if (linked.error) throw new Error(`No se ha podido asociar la fotografía de ${photo.player_id} a ${photo.season_year}: ${linked.error.message}`);
  }
}

const unresolvedClubs = seasons
  .filter((season) => season.legacy_club_name && !season.club_id)
  .map(({ player_id, season_year, legacy_club_name }) => ({ player_id, season_year, legacy_club_name }));

const report = {
  generated_at: new Date().toISOString(),
  spreadsheet_file: workbookPath,
  source_rows_with_ctr_id: rows.length,
  players_updated: playerIds.length,
  seasons_imported: seasons.length,
  linked_club_seasons: seasons.filter((season) => season.club_id).length,
  unresolved_club_seasons: unresolvedClubs.length,
  photos_prepared: photos.length,
  photos_uploaded: uploaded.length,
  photo_failures: photoFailures,
  unknown_player_ids: [...unknownPlayers].sort(),
  outputRoot,
};
await writeFile(path.join(outputRoot, "report.json"), `${JSON.stringify({ ...report, unresolvedClubs }, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
