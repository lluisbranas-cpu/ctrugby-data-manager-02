import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging"));

if (!process.argv[2]) throw new Error("Uso: node scripts/prepare-player-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");

const optionalText = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text || null;
};
const requiredText = (value, field, id, problems) => {
  const text = optionalText(value);
  if (!text) problems.push({ id, field, reason: "obligatorio" });
  return text || "";
};
const normalize = (value) => optionalText(value)?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, " ").trim() ?? "";
const sqlLiteral = (value) => value == null ? "null" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const insert = (table, columns, rows) => rows.length ? `insert into ${table} (${columns.join(", ")}) values\n${rows.map((row) => `  (${columns.map((column) => sqlLiteral(row[column])).join(", ")})`).join(",\n")}\non conflict do nothing;\n` : "";
const loadJson = async (filename) => JSON.parse(await readFile(path.join(sourceDirectory, filename), "utf8"));

const sourceInfo = await stat(sourceDirectory).catch(() => null);
if (!sourceInfo?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");

const [sourcePlayers, sourceSeasons, sourceClubs] = await Promise.all([
  loadJson("players-data.json"),
  loadJson("player-seasons-data.json"),
  loadJson("clubs-data.json"),
]);
if (!Array.isArray(sourcePlayers) || Array.isArray(sourceSeasons) || !Array.isArray(sourceClubs)) throw new Error("Los archivos de jugadores, temporadas o clubs no tienen el formato esperado.");

const problems = [];
const players = sourcePlayers.map((row) => {
  const id = requiredText(row.id, "id", row.id ?? null, problems).toUpperCase();
  if (!/^CTR[0-9]{4}$/.test(id)) problems.push({ id, field: "id", reason: "formato inválido" });
  const first_name = requiredText(row.nombre, "nombre", id, problems);
  const last_name = optionalText(row.apellidos);
  const birth = row.nacimiento == null || row.nacimiento === "" ? null : Number(row.nacimiento);
  if (birth != null && (!Number.isInteger(birth) || birth < 1900 || birth > 2026)) problems.push({ id, field: "nacimiento", reason: "año inválido" });
  return { id, first_name, last_name, category: optionalText(row.categoria), birth_year: birth };
});
const playerIds = new Set();
for (const player of players) {
  if (playerIds.has(player.id)) problems.push({ id: player.id, field: "id", reason: "duplicado" });
  playerIds.add(player.id);
}

const clubsByName = new Map();
for (const club of sourceClubs) {
  const key = normalize(club.name);
  if (!key) continue;
  const ids = clubsByName.get(key) ?? [];
  ids.push(club.id);
  clubsByName.set(key, ids);
}

const seasons = [];
const unresolved = [];
for (const [player_id, byYear] of Object.entries(sourceSeasons)) {
  if (!playerIds.has(player_id)) problems.push({ id: player_id, field: "temporadas", reason: "jugador inexistente" });
  if (!byYear || typeof byYear !== "object" || Array.isArray(byYear)) {
    problems.push({ id: player_id, field: "temporadas", reason: "formato inválido" });
    continue;
  }
  for (const [yearText, row] of Object.entries(byYear)) {
    const season_year = Number(yearText);
    if (!Number.isInteger(season_year) || season_year < 2000 || season_year > 2035) {
      problems.push({ id: player_id, field: "temporada", reason: "año inválido" });
      continue;
    }
    const source = row && typeof row === "object" ? row : {};
    const legacy_club_name = optionalText(source.club);
    const possibleIds = legacy_club_name ? clubsByName.get(normalize(legacy_club_name)) ?? [] : [];
    const club_id = possibleIds.length === 1 ? possibleIds[0] : null;
    if (legacy_club_name && !club_id) unresolved.push({ player_id, season_year, legacy_club_name, reason: possibleIds.length > 1 ? "coincidencia múltiple" : "sin coincidencia" });
    const weight = source.peso == null || source.peso === "" ? null : Number(source.peso);
    const height = source.altura == null || source.altura === "" ? null : Number(source.altura);
    if (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > 250)) problems.push({ id: player_id, field: `peso ${season_year}`, reason: "valor inválido" });
    if (height != null && (!Number.isFinite(height) || height < 0 || height > 260)) problems.push({ id: player_id, field: `altura ${season_year}`, reason: "valor inválido" });
    seasons.push({ player_id, season_year, club_id, legacy_club_name, position_text: optionalText(source.posicion), weight_kg: weight, height_cm: height });
  }
}

const expectedUnresolved = new Set(["CTR0254|2025|NAAS", "CTR0269|2025|BELENOS RC", "CTR0274|2025|VF", "CTR0278|2025|GIJON RC"]);
for (const entry of unresolved) {
  const key = `${entry.player_id}|${entry.season_year}|${entry.legacy_club_name}`;
  if (!expectedUnresolved.has(key)) problems.push({ id: entry.player_id, field: `club ${entry.season_year}`, reason: `relación no prevista: ${entry.legacy_club_name}` });
}
for (const key of expectedUnresolved) if (!unresolved.some((entry) => `${entry.player_id}|${entry.season_year}|${entry.legacy_club_name}` === key)) problems.push({ id: key.split("|")[0], field: "relación pendiente", reason: "no se ha encontrado para revisión" });
if (problems.length) throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(problems, null, 2)}`);

const report = {
  generated_at: new Date().toISOString(), source_directory: sourceDirectory,
  players: players.length, seasons: seasons.length,
  linked_seasons: seasons.filter((season) => season.club_id).length,
  no_club_reported: seasons.filter((season) => !season.legacy_club_name).length,
  pending_club_links: unresolved,
  players_without_birth_year: players.filter((player) => player.birth_year == null).length,
  players_without_last_name: players.filter((player) => player.last_name == null).map((player) => player.id),
};
const sql = [
  "-- Generado localmente. Contiene datos personales: revisar antes de enviarlo a Supabase.",
  "-- Inserta solo registros inexistentes, deja todos los jugadores sin publicar y conserva las relaciones pendientes.", "begin;",
  insert("public.catalog_players", ["id", "first_name", "last_name"], players),
  insert("app_private.player_profiles", ["player_id", "category", "birth_year"], players.map(({ id, category, birth_year }) => ({ player_id: id, category, birth_year }))),
  insert("app_private.player_seasons", ["player_id", "season_year", "club_id", "legacy_club_name", "position_text", "weight_kg", "height_cm"], seasons),
  "commit;", "",
].join("\n");

await mkdir(outputDirectory, { recursive: true });
for (const filename of ["players.json", "player-seasons.json", "player-import-report.json", "player-import.sql"]) {
  const destination = path.join(outputDirectory, filename);
  if (await stat(destination).then(() => true).catch(() => false)) throw new Error(`${destination} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);
}
await Promise.all([
  writeFile(path.join(outputDirectory, "players.json"), `${JSON.stringify(players, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "player-seasons.json"), `${JSON.stringify(seasons, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "player-import-report.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "player-import.sql"), sql),
]);
console.log(JSON.stringify({ ok: true, outputDirectory, ...report }, null, 2));