import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const outputDirectory = argument("--out");
const mappingCsv = argument("--mapping");
if (!outputDirectory || !path.isAbsolute(outputDirectory) || !mappingCsv || !path.isAbsolute(mappingCsv)) {
  throw new Error("Usa --mapping <csv-absoluto> --out <carpeta-absoluta-fuera-del-repositorio>");
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan las credenciales locales de Supabase.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/);
  const parseLine = (line) => {
    const values = [];
    let value = "";
    let quoted = false;
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
async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const ignoredFields = new Set(["participant_id", "created_at", "updated_at", "version"]);
const same = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const mappings = parseCsv(await readFile(mappingCsv, "utf8"));
const [localMilestones, remoteParticipants, remoteMilestones] = await Promise.all([
  JSON.parse(await readFile("data/staging/milestones.json", "utf8")),
  fetchAll("catalog_participants"),
  fetchAll("catalog_milestones"),
]);
const errors = [];
const mappingByLocal = new Map();
for (const row of mappings) {
  if (!row.local_participant_id || !row.candidate_id || row.candidate_type !== "catalog_participant") {
    errors.push({ type: "invalid_mapping_row", local_participant_id: row.local_participant_id || null });
    continue;
  }
  if (mappingByLocal.has(row.local_participant_id)) errors.push({ type: "duplicate_local_mapping", local_participant_id: row.local_participant_id });
  mappingByLocal.set(row.local_participant_id, row.candidate_id);
}
const remoteParticipantIds = new Set(remoteParticipants.map((row) => row.id));
for (const [localId, remoteId] of mappingByLocal) if (!remoteParticipantIds.has(remoteId)) errors.push({ type: "missing_remote_participant", local_participant_id: localId, candidate_id: remoteId });
const targetToLocal = new Map();
for (const [localId, remoteId] of mappingByLocal) targetToLocal.set(remoteId, [...(targetToLocal.get(remoteId) ?? []), localId]);
for (const [remoteId, localIds] of targetToLocal) if (localIds.length > 1) errors.push({ type: "many_local_to_one_remote", candidate_id: remoteId, local_participant_ids: localIds });

const remoteMilestonesById = new Map(remoteMilestones.map((row) => [row.id, row]));
const canonicalParticipantIds = new Set(mappingByLocal.values());
const sourceMilestones = localMilestones.filter((row) => mappingByLocal.has(row.participant_id) || canonicalParticipantIds.has(row.participant_id));
const legacyLocalReferences = sourceMilestones.filter((row) => mappingByLocal.has(row.participant_id));
const canonicalLocalReferences = sourceMilestones.filter((row) => canonicalParticipantIds.has(row.participant_id));
const updates = [];
const alreadyLinked = [];
const missingMilestones = [];
const unexpectedDifferences = [];
for (const local of sourceMilestones) {
  const remote = remoteMilestonesById.get(local.id);
  const targetParticipantId = mappingByLocal.get(local.participant_id) ?? local.participant_id;
  if (!remote) { missingMilestones.push(local.id); continue; }
  const differingFields = Object.keys(local)
    .filter((field) => Object.hasOwn(remote, field) && !ignoredFields.has(field))
    .filter((field) => !same(local[field], remote[field]));
  if (differingFields.length) unexpectedDifferences.push({ id: local.id, differing_fields: differingFields });
  const entry = { milestone_id: local.id, local_participant_id: local.participant_id, target_participant_id: targetParticipantId, current_supabase_participant_id: remote.participant_id };
  if (remote.participant_id === targetParticipantId) alreadyLinked.push(entry); else updates.push(entry);
}
const plannedMilestoneIds = new Set([...updates, ...alreadyLinked].map((row) => row.milestone_id));
const unmappedLocalReferences = localMilestones.filter((row) => row.participant_id && !mappingByLocal.has(row.participant_id) && !canonicalParticipantIds.has(row.participant_id) && remoteMilestonesById.has(row.id) && row.participant_id !== remoteMilestonesById.get(row.id).participant_id).map((row) => row.id);
if (mappings.length !== 57) errors.push({ type: "unexpected_mapping_count", found: mappings.length, expected: 57 });
if (sourceMilestones.length !== 149) errors.push({ type: "unexpected_affected_milestone_count", found: sourceMilestones.length, expected: 149 });
if (missingMilestones.length) errors.push({ type: "missing_remote_milestones", ids: missingMilestones });
if (unmappedLocalReferences.length) errors.push({ type: "unmapped_participant_difference", milestone_count: unmappedLocalReferences.length, ids: unmappedLocalReferences });

const valid = errors.length === 0 && unexpectedDifferences.length === 0;
const report = {
  generated_at: new Date().toISOString(),
  mode: "simulation_only",
  writes_performed: false,
  mapping_csv: mappingCsv,
  validation: {
    mapping_rows: mappings.length,
    unique_local_participants: mappingByLocal.size,
    unique_remote_participants: targetToLocal.size,
    target_participants_confirmed_in_supabase: [...mappingByLocal.values()].filter((id) => remoteParticipantIds.has(id)).length,
    affected_local_milestones: sourceMilestones.length,
    inherited_local_references: legacyLocalReferences.length,
    canonical_local_references: canonicalLocalReferences.length,
    remote_milestones_found: plannedMilestoneIds.size,
    updates_needed: updates.length,
    already_linked: alreadyLinked.length,
    unexpected_non_participant_differences: unexpectedDifferences.length,
    potential_duplicate_creations: 0,
    inserts_planned: 0,
    errors,
    valid_for_manual_execution: valid,
  },
  updates,
  already_linked: alreadyLinked,
  unexpected_differences: unexpectedDifferences,
};
const values = updates.map((row) => `    (${sql(row.milestone_id)}, ${sql(row.target_participant_id)})`).join(",\n");
const planSql = [
  "-- PLAN GENERADO PARA REVISION. NO EJECUTADO POR ESTE SCRIPT.",
  "-- Idempotente: no inserta participantes ni hitos; solo enlaza hitos existentes cuando difieren.",
  "BEGIN;",
  values ? "WITH approved_links(milestone_id, target_participant_id) AS (\n  VALUES\n" + values + "\n)\nUPDATE public.catalog_milestones AS target\nSET participant_id = approved_links.target_participant_id\nFROM approved_links\nWHERE target.id = approved_links.milestone_id\n  AND target.participant_id IS DISTINCT FROM approved_links.target_participant_id;" : "-- No hay actualizaciones necesarias.",
  "-- Revisar el número de filas afectadas antes de COMMIT.",
  "ROLLBACK;",
  "",
].join("\n");
const markdown = [
  "# Simulación de vinculación idempotente de participantes",
  "",
  `Generado: ${report.generated_at}`,
  "",
  "No se ejecutó ninguna escritura. El SQL propuesto termina en `ROLLBACK` y no contiene inserciones.",
  "",
  `- Correspondencias aprobadas: ${report.validation.mapping_rows}`,
  `- Participantes destino existentes y confirmados: ${report.validation.target_participants_confirmed_in_supabase}`,
  `- Hitos locales afectados: ${report.validation.affected_local_milestones}`,
  `- Actualizaciones necesarias: ${report.validation.updates_needed}`,
  `- Ya enlazados: ${report.validation.already_linked}`,
  `- Inserciones planificadas: 0`,
  `- Creaciones duplicadas potenciales: 0`,
  `- Diferencias no relacionadas con participante: ${report.validation.unexpected_non_participant_differences}`,
  `- Validación: ${report.validation.valid_for_manual_execution ? "correcta" : "requiere revisión"}`,
  "",
].join("\n");

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "participant-link-simulation.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "participant-link-simulation.md"), `${markdown}\n`, "utf8");
await writeFile(path.join(outputDirectory, "participant-link-plan.sql"), planSql, "utf8");
console.log(JSON.stringify(report.validation));
