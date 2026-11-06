import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const mappingCsv = argument("--mapping");
const outputDirectory = argument("--out");
if (!mappingCsv || !path.isAbsolute(mappingCsv) || !outputDirectory || !path.isAbsolute(outputDirectory)) {
  throw new Error("Usa --mapping <csv-absoluto> --out <carpeta-absoluta-fuera-del-repositorio>");
}
const participantFile = "data/staging/milestone-participants.json";
const milestoneFile = "data/staging/milestones.json";
const hash = (text) => createHash("sha256").update(text).digest("hex");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  const parseLine = (line) => {
    const values = []; let value = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value); value = ""; }
      else value += char;
    }
    values.push(value);
    return values;
  };
  const header = parseLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [header[index], value])));
}
function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function replaceProperty(text, property, oldValue, newValue) {
  const expression = new RegExp(`("${property}"\\s*:\\s*)"${escaped(oldValue)}"`, "g");
  let count = 0;
  const replaced = text.replace(expression, (_match, prefix) => { count += 1; return `${prefix}"${newValue}"`; });
  return { text: replaced, count };
}
function atomicWrite(filename, content) {
  const temporary = `${filename}.${process.pid}.reconcile.tmp`;
  return writeFile(temporary, content, "utf8").then(() => rename(temporary, filename));
}
function sameExcept(before, after, allowedProperty) {
  const beforeRows = JSON.parse(before);
  const afterRows = JSON.parse(after);
  if (!Array.isArray(beforeRows) || !Array.isArray(afterRows) || beforeRows.length !== afterRows.length) return false;
  return beforeRows.every((row, index) => Object.entries(row).every(([key, value]) => key === allowedProperty || JSON.stringify(value) === JSON.stringify(afterRows[index][key])));
}

const rows = parseCsv(await readFile(mappingCsv, "utf8"));
if (rows.length !== 57) throw new Error(`Se esperaban 57 correspondencias aprobadas; se encontraron ${rows.length}.`);
const mappings = new Map();
for (const row of rows) {
  if (row.candidate_type !== "catalog_participant" || !row.local_participant_id || !row.candidate_id) throw new Error("El CSV contiene una correspondencia sin participante destino válido.");
  if (mappings.has(row.local_participant_id)) throw new Error(`Correspondencia local duplicada: ${row.local_participant_id}`);
  mappings.set(row.local_participant_id, row.candidate_id);
}
if (new Set(mappings.values()).size !== 57) throw new Error("Dos participantes locales apuntan al mismo participante destino.");

const [beforeParticipants, beforeMilestones] = await Promise.all([readFile(participantFile, "utf8"), readFile(milestoneFile, "utf8")]);
const parsedParticipants = JSON.parse(beforeParticipants);
const parsedMilestones = JSON.parse(beforeMilestones);
const participantChanges = parsedParticipants.filter((row) => mappings.has(row.id)).map((row) => ({ before_id: row.id, after_id: mappings.get(row.id), display_name: row.display_name }));
const milestoneChanges = parsedMilestones.filter((row) => mappings.has(row.participant_id)).map((row) => ({ milestone_id: row.id, before_participant_id: row.participant_id, after_participant_id: mappings.get(row.participant_id) }));
if (participantChanges.length !== 57) throw new Error(`Se esperaban 57 IDs de participante heredados; se encontraron ${participantChanges.length}.`);
if (milestoneChanges.length !== 149) throw new Error(`Se esperaban 149 referencias de hito heredadas; se encontraron ${milestoneChanges.length}.`);

let afterParticipants = beforeParticipants;
let afterMilestones = beforeMilestones;
for (const change of participantChanges) {
  const replaced = replaceProperty(afterParticipants, "id", change.before_id, change.after_id);
  if (replaced.count !== 1) throw new Error(`El ID de participante ${change.before_id} no se pudo sustituir exactamente una vez.`);
  afterParticipants = replaced.text;
}
let milestoneReplacementCount = 0;
for (const [beforeId, afterId] of mappings) {
  const replaced = replaceProperty(afterMilestones, "participant_id", beforeId, afterId);
  milestoneReplacementCount += replaced.count;
  afterMilestones = replaced.text;
}
if (milestoneReplacementCount !== 149) throw new Error(`Se esperaban 149 sustituciones de participant_id; se realizaron ${milestoneReplacementCount}.`);
if (!sameExcept(beforeParticipants, afterParticipants, "id")) throw new Error("La comprobación detectó un cambio no autorizado en milestone-participants.json.");
if (!sameExcept(beforeMilestones, afterMilestones, "participant_id")) throw new Error("La comprobación detectó un cambio no autorizado en milestones.json.");
const afterParsedParticipants = JSON.parse(afterParticipants);
const afterParsedMilestones = JSON.parse(afterMilestones);
if (new Set(afterParsedParticipants.map((row) => row.id)).size !== afterParsedParticipants.length) throw new Error("La reconciliación produciría IDs de participante duplicados.");
if (afterParsedMilestones.filter((row) => mappings.has(row.participant_id)).length !== 0) throw new Error("Quedan referencias heredadas después de la preparación.");
if (afterParsedMilestones.filter((row) => mappings.has(row.participant_id) || [...mappings.values()].includes(row.participant_id)).length !== 149) throw new Error("El recuento de referencias canónicas no coincide.");

await atomicWrite(participantFile, afterParticipants);
await atomicWrite(milestoneFile, afterMilestones);
const report = {
  generated_at: new Date().toISOString(),
  files_updated: [participantFile, milestoneFile],
  writes_to_supabase: false,
  participant_id_changes: participantChanges,
  milestone_participant_id_changes: milestoneChanges,
  validation: {
    participant_ids_updated: participantChanges.length,
    milestone_references_updated: milestoneChanges.length,
    only_allowed_fields_changed: true,
    duplicate_participant_ids_after_update: false,
    inherited_participant_references_remaining: 0,
    hashes: {
      before: { milestone_participants: hash(beforeParticipants), milestones: hash(beforeMilestones) },
      after: { milestone_participants: hash(afterParticipants), milestones: hash(afterMilestones) },
    },
  },
};
const markdown = [
  "# Reconciliación local de IDs de participante",
  "",
  `Generado: ${report.generated_at}`,
  "",
  "- Archivos actualizados: `data/staging/milestone-participants.json` y `data/staging/milestones.json`.",
  "- IDs de participante actualizados: 57.",
  "- Referencias `participant_id` de hitos actualizadas: 149.",
  "- Campos distintos a `id` y `participant_id` modificados: ninguno.",
  "- Escrituras en Supabase: ninguna.",
  "",
].join("\n");
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "local-participant-id-reconciliation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "local-participant-id-reconciliation.md"), `${markdown}\n`, "utf8");
console.log(JSON.stringify(report.validation));
