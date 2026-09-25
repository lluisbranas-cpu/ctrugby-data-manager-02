import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging"));
if (!process.argv[2]) throw new Error("Uso: node scripts/prepare-milestone-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");

const load = async (name) => JSON.parse(await readFile(path.join(sourceDirectory, name), "utf8"));
const text = (value) => value == null ? null : String(value).trim() || null;
const normalize = (value) => (text(value) ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, " ").trim();
const externalId = (key) => `EXT_${createHash("sha256").update(key).digest("hex").slice(0, 16).toUpperCase()}`;
const expectedType = (value) => value === "Jugador" ? "player" : value === "Staff" ? "staff" : null;

if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");
const [players, staff, milestones, counters, years] = await Promise.all([
  load("players-data.json"), load("staff-data.json"), load("milestones-data.json"), load("player-participations-data.json"), load("player-participation-years-data.json"),
]);
if (![players, staff, milestones].every(Array.isArray) || Array.isArray(counters) || Array.isArray(years)) throw new Error("Uno de los archivos de origen no tiene el formato esperado.");

const problems = [];
const playerIds = new Set(players.map((player) => player.id));
const staffByName = new Map();
for (const member of staff) {
  if (!/^STF[0-9]{4}$/.test(member.id)) problems.push({ id: member.id ?? null, field: "staff.id", reason: "formato inválido" });
  const name = text(`${member.nombre ?? ""} ${member.apellidos ?? ""}`);
  if (!name) problems.push({ id: member.id, field: "staff.nombre", reason: "obligatorio" });
  else staffByName.set(normalize(name), member.id);
}

const participants = new Map();
const addParticipant = (id, kind, display_name, player_id, staff_id, source_key) => {
  const existing = participants.get(id);
  if (existing && existing.source_key !== source_key) problems.push({ id, field: "participant", reason: "colisión de identificador" });
  if (!existing) participants.set(id, { id, kind, display_name, player_id, staff_id, source_key });
};
const milestoneRows = [];
const sourceRows = [];
for (const [index, source] of milestones.entries()) {
  const kind = expectedType(source.tipo);
  const source_name = text(source.nombre);
  if (!kind) problems.push({ id: index + 1, field: "tipo", reason: "no reconocido" });
  if (!source_name) problems.push({ id: index + 1, field: "nombre", reason: "obligatorio" });
  if (!kind || !source_name) continue;
  const source_ctr_id = text(source.ctrId);
  let participant;
  if (kind === "player" && source_ctr_id && playerIds.has(source_ctr_id)) {
    participant = { id: `PLR_${source_ctr_id}`, player_id: source_ctr_id, staff_id: null, source_key: `player:id:${source_ctr_id}` };
  } else if (kind === "staff" && staffByName.has(normalize(source_name))) {
    const staff_id = staffByName.get(normalize(source_name));
    participant = { id: `STF_${staff_id}`, player_id: null, staff_id, source_key: `staff:id:${staff_id}` };
  } else {
    const source_key = `${kind}:name:${normalize(source_name)}`;
    participant = { id: externalId(source_key), player_id: null, staff_id: null, source_key };
  }
  addParticipant(participant.id, kind, source_name, participant.player_id, participant.staff_id, participant.source_key);
  const id = `MIL${String(index + 1).padStart(6, "0")}`;
  milestoneRows.push({ id, participant_id: participant.id, scope: text(source.ambito), category: text(source.categoria), season_label: text(source.temporada), club_text: text(source.club), position_text: text(source.posicion) });
  sourceRows.push({ milestone_id: id, source_type: kind, source_ctr_id, source_name });
}

const metrics = [];
for (const [legacyId, count] of Object.entries(counters)) {
  const matched = /^CTR0+(\d+)$/.exec(legacyId);
  const player_id = matched ? `CTR${matched[1].padStart(4, "0")}` : null;
  if (!player_id || !playerIds.has(player_id)) { problems.push({ id: legacyId, field: "participaciones", reason: "jugador sin correspondencia" }); continue; }
  if (!Number.isInteger(count) || count < 0) problems.push({ id: legacyId, field: "participaciones", reason: "contador inválido" });
  const participation_years = years[legacyId];
  if (!Array.isArray(participation_years) || !participation_years.every((year) => typeof year === "string" && /^\d{4}$/.test(year))) problems.push({ id: legacyId, field: "años", reason: "formato inválido" });
  metrics.push({ player_id, participation_count: count, participation_years });
}
if (Object.keys(counters).length !== Object.keys(years).length) problems.push({ id: null, field: "métricas", reason: "contadores y años no coinciden" });
if (problems.length) throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(problems, null, 2)}`);

const participantRows = [...participants.values()];
const report = {
  generated_at: new Date().toISOString(), source_directory: sourceDirectory,
  staff: staff.length, milestones: milestoneRows.length, participants: participantRows.length,
  linked_current_players: participantRows.filter((entry) => entry.player_id).length,
  linked_current_staff: participantRows.filter((entry) => entry.staff_id).length,
  historic_participants_pending_review: participantRows.filter((entry) => !entry.player_id && !entry.staff_id).length,
  player_participation_metrics: metrics.length,
};
await mkdir(outputDirectory, { recursive: true });
for (const name of ["staff.json", "milestone-participants.json", "milestones.json", "milestone-sources.json", "player-participation-metrics.json", "milestone-import-report.json"]) {
  const destination = path.join(outputDirectory, name);
  if (await stat(destination).then(() => true).catch(() => false)) throw new Error(`${destination} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);
}
await Promise.all([
  writeFile(path.join(outputDirectory, "staff.json"), `${JSON.stringify(staff.map(({ id, nombre, apellidos }) => ({ id, first_name: text(nombre), last_name: text(apellidos) })), null, 2)}\n`),
  writeFile(path.join(outputDirectory, "milestone-participants.json"), `${JSON.stringify(participantRows, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "milestones.json"), `${JSON.stringify(milestoneRows, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "milestone-sources.json"), `${JSON.stringify(sourceRows, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "player-participation-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "milestone-import-report.json"), `${JSON.stringify(report, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, outputDirectory, ...report }, null, 2));
