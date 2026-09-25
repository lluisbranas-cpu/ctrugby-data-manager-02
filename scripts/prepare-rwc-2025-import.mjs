import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging", "rwc-2025"));
if (!process.argv[2]) throw new Error("Uso: node scripts/prepare-rwc-2025-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");

const load = async (filename) => JSON.parse(await readFile(path.join(sourceDirectory, filename), "utf8"));
const text = (value) => value == null ? null : String(value).trim() || null;
const normalize = (value) => (text(value) ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, " ").trim();
const externalId = (key) => `EXT_${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;

if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");
const [rwc, currentPlayers, existingParticipants, existingMilestones] = await Promise.all([
  load("rwc-2025-spain.json"),
  JSON.parse(await readFile(path.join(projectDirectory, "data", "staging", "players.json"), "utf8")),
  JSON.parse(await readFile(path.join(projectDirectory, "data", "staging", "milestone-participants.json"), "utf8")),
  JSON.parse(await readFile(path.join(projectDirectory, "data", "staging", "milestones.json"), "utf8")),
]);
if (![rwc, currentPlayers, existingParticipants, existingMilestones].every(Array.isArray)) throw new Error("Uno de los archivos de origen no tiene el formato esperado.");

const imageDirectory = path.join(sourceDirectory, "..", "public", "hitos", "rwc-2025-spain");
const playerIds = new Set(currentPlayers.map((player) => player.id));
const currentByName = new Map(currentPlayers.map((player) => [normalize(`${player.first_name ?? ""} ${player.last_name ?? ""}`), player.id]));
const existingByKey = new Map(existingParticipants.map((participant) => [participant.source_key, participant]));
const participants = new Map();
const milestones = [];
const sources = [];
const media = [];
const problems = [];
const milestoneOffset = existingMilestones.length;

for (const [index, source] of rwc.entries()) {
  const name = text(source.nombre);
  const ctrId = text(source.ctrId);
  const imagePath = text(source.imagen);
  if (source.tipo !== "Jugadora" || !name || !imagePath?.startsWith("/hitos/rwc-2025-spain/")) {
    problems.push({ row: index + 1, reason: "registro RWC incompleto o no reconocido" });
    continue;
  }
  const filename = path.basename(imagePath);
  if (!/^[a-z0-9-]+\.webp$/i.test(filename) || !(await stat(path.join(imageDirectory, filename)).catch(() => null))?.isFile()) {
    problems.push({ row: index + 1, reason: "fotografía RWC no encontrada" });
    continue;
  }
  const knownPlayerId = ctrId && playerIds.has(ctrId) ? ctrId : currentByName.get(normalize(name)) ?? null;
  const sourceKey = knownPlayerId ? `player:id:${knownPlayerId}` : `player:name:${normalize(name)}`;
  const knownParticipant = existingByKey.get(sourceKey);
  const participant = knownParticipant ?? {
    id: knownPlayerId ? `PLR_${knownPlayerId}` : externalId(sourceKey), kind: "player", display_name: name,
    player_id: knownPlayerId, staff_id: null, source_key: sourceKey,
  };
  participants.set(participant.id, participant);
  const id = `MIL${String(milestoneOffset + index + 1).padStart(6, "0")}`;
  const image_key = `rwc-2025-spain/${filename}`;
  milestones.push({ id, participant_id: participant.id, scope: text(source.ambito), category: text(source.categoria), season_label: text(source.temporada), club_text: text(source.club), position_text: text(source.posicion), image_key });
  sources.push({ milestone_id: id, source_type: "player", source_ctr_id: ctrId, source_name: name });
  media.push({ milestone_id: id, image_key, source_file: path.join(imageDirectory, filename) });
}
if (problems.length) throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(problems, null, 2)}`);

const participantRows = [...participants.values()];
const report = {
  generated_at: new Date().toISOString(), source_directory: sourceDirectory, records: rwc.length,
  direct_current_player_links: participantRows.filter((entry) => entry.player_id).length,
  reused_historic_participants: participantRows.filter((entry) => existingByKey.has(entry.source_key)).length,
  new_historic_participants: participantRows.filter((entry) => !existingByKey.has(entry.source_key) && !entry.player_id).length,
  photos: media.length, milestone_start: milestones[0]?.id ?? null, milestone_end: milestones.at(-1)?.id ?? null,
};
await mkdir(outputDirectory, { recursive: true });
for (const filename of ["participants.json", "milestones.json", "sources.json", "media.json", "report.json"]) {
  const destination = path.join(outputDirectory, filename);
  if (await stat(destination).then(() => true).catch(() => false)) throw new Error(`${destination} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);
}
await Promise.all([
  writeFile(path.join(outputDirectory, "participants.json"), `${JSON.stringify(participantRows, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "milestones.json"), `${JSON.stringify(milestones, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "media.json"), `${JSON.stringify(media, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, outputDirectory, ...report }, null, 2));
