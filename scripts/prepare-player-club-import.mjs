import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging", "player-clubs"));
if (!process.argv[2]) throw new Error("Uso: node scripts/prepare-player-club-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");

const load = async (name) => JSON.parse(await readFile(path.join(sourceDirectory, name), "utf8"));
const text = (value) => value == null ? null : String(value).trim() || null;
const normalize = (value) => (text(value) ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, "");
const add = (map, key, value) => map.set(key, [...(map.get(key) ?? []), value]);

if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");
const [players, clubs, sourceLinks, sourceCounts] = await Promise.all([
  load("players-data.json"), load("clubs-data.json"), load("player-clubs-data.json"), load("club-participations-data.json"),
]);
if (!Array.isArray(players) || !Array.isArray(clubs) || !Array.isArray(sourceLinks) || Array.isArray(sourceCounts)) {
  throw new Error("Uno de los archivos de origen no tiene el formato esperado.");
}

const playerIdsByName = new Map();
const playersByKey = [];
for (const player of players) {
  const key = normalize(`${player.nombre ?? ""} ${player.apellidos ?? ""}`);
  add(playerIdsByName, key, player.id);
  playersByKey.push({ id: player.id, key });
}
const clubIdsByName = new Map();
for (const club of clubs) add(clubIdsByName, normalize(club.name), club.id);
const problems = [];
const affiliations = [];
const unresolvedAffiliations = [];
const matchPlayer = (sourceName) => {
  const key = normalize(sourceName);
  const exact = playerIdsByName.get(key) ?? [];
  if (exact.length === 1) return exact[0];
  const abbreviated = playersByKey.filter((player) => player.key.includes(key) || key.includes(player.key));
  return abbreviated.length === 1 ? abbreviated[0].id : null;
};
for (const [index, source] of sourceLinks.entries()) {
  const player_id = matchPlayer(source.nombre);
  const clubMatches = clubIdsByName.get(normalize(source.club)) ?? [];
  if (clubMatches.length !== 1) problems.push({ row: index + 1, field: "club", reason: clubMatches.length ? "coincidencia ambigua" : "sin coincidencia" });
  if (!player_id) unresolvedAffiliations.push({ row: index + 1, legacy_name: text(source.nombre), legacy_club: text(source.club), reason: "sin coincidencia inequívoca" });
  if (player_id && clubMatches.length === 1) affiliations.push({ player_id, club_id: clubMatches[0] });
}
const clubParticipations = [];
for (const [club_id, value] of Object.entries(sourceCounts)) {
  if (!/^([A-Z]{3}[0-9]{4})$/.test(club_id)) problems.push({ id: club_id, field: "club", reason: "ID inválido" });
  if (!Number.isInteger(value) || value < 0) problems.push({ id: club_id, field: "participaciones", reason: "contador inválido" });
  if (/^([A-Z]{3}[0-9]{4})$/.test(club_id) && Number.isInteger(value) && value >= 0) clubParticipations.push({ club_id, participation_count: value });
}
if (problems.length) throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(problems, null, 2)}`);

const uniqueAffiliations = [...new Map(affiliations.map((row) => [`${row.player_id}|${row.club_id}`, row])).values()];

const report = {
  generated_at: new Date().toISOString(), source_directory: sourceDirectory,
  player_club_affiliations: uniqueAffiliations.length,
  players_with_club_affiliations: new Set(uniqueAffiliations.map((row) => row.player_id)).size,
  unresolved_player_club_affiliations: unresolvedAffiliations.length,
  club_participation_totals: clubParticipations.length,
  participation_total: clubParticipations.reduce((total, row) => total + row.participation_count, 0),
};
await mkdir(outputDirectory, { recursive: true });
for (const name of ["affiliations.json", "club-participations.json", "unresolved-affiliations.json", "report.json"]) {
  const destination = path.join(outputDirectory, name);
  if (await stat(destination).then(() => true).catch(() => false)) throw new Error(`${destination} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);
}
await Promise.all([
  writeFile(path.join(outputDirectory, "affiliations.json"), `${JSON.stringify(uniqueAffiliations, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "club-participations.json"), `${JSON.stringify(clubParticipations, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "unresolved-affiliations.json"), `${JSON.stringify(unresolvedAffiliations, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, outputDirectory, ...report }, null, 2));
