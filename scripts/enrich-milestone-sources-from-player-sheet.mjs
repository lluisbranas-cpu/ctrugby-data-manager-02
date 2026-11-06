import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const [, , workbookPath, outputPath = path.join("data", "staging", "milestone-sources.json")] = process.argv;

if (!workbookPath) {
  console.error("Uso: node scripts/enrich-milestone-sources-from-player-sheet.mjs <hitos.xlsx> [salida.json]");
  process.exit(1);
}

const text = (value) => String(value ?? "").trim();
const normalize = (value) => text(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es-ES")
  .replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();
const key = (...values) => values.map(normalize).join("|");
const cleanUrl = (value) => {
  const url = text(value);
  return /^https?:\/\//i.test(url) ? url : null;
};
const cleanDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const workbook = XLSX.readFile(workbookPath, { cellDates: true });
const sheet = workbook.Sheets.Jugadores;
if (!sheet) {
  console.error("No se ha encontrado la hoja 'Jugadores'.");
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
const base = process.cwd();
const [milestones, participants, sources] = await Promise.all([
  fs.readFile(path.join(base, "data", "staging", "milestones.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(base, "data", "staging", "milestone-participants.json"), "utf8").then(JSON.parse),
  fs.readFile(path.resolve(base, outputPath), "utf8").then(JSON.parse),
]);

const participantById = new Map(participants.map((participant) => [participant.id, participant]));
const sourceByMilestone = new Map(sources.map((source) => [source.milestone_id, source]));
const sheetRowsByKey = new Map();

for (const [index, row] of rows.entries()) {
  const sourceUrl = cleanUrl(row.Fuente);
  if (text(row.Rol) !== "JUGADOR" || !sourceUrl) continue;
  const rowKey = key(row.Nombre, row["Ámbito"], row["Categoría / selección"], row["Temporada / corte"], row.Club, row["Posición"]);
  const prepared = {
    source_url: sourceUrl,
    source_photo_url: cleanUrl(row["Foto URL"]),
    source_captured_at: cleanDate(row["Fecha captura"]),
    source_sheet: "Jugadores",
    source_row: index + 2,
  };
  const bucket = sheetRowsByKey.get(rowKey) ?? [];
  bucket.push(prepared);
  sheetRowsByKey.set(rowKey, bucket);
}

let enriched = 0;
let identicalDuplicates = 0;
let ambiguous = 0;
let missing = 0;

for (const milestone of milestones) {
  const participant = participantById.get(milestone.participant_id);
  const rowKey = key(participant?.display_name, milestone.scope, milestone.category, milestone.season_label, milestone.club_text, milestone.position_text);
  const matches = sheetRowsByKey.get(rowKey) ?? [];
  const unique = new Map(matches.map((match) => [JSON.stringify({
    source_url: match.source_url,
    source_photo_url: match.source_photo_url,
    source_captured_at: match.source_captured_at,
  }), match]));
  if (unique.size === 1) {
    const [match] = unique.values();
    const source = sourceByMilestone.get(milestone.id);
    if (!source) continue;
    Object.assign(source, match);
    enriched += 1;
    if (matches.length > 1) identicalDuplicates += 1;
  } else if (matches.length > 1) {
    ambiguous += 1;
  } else {
    missing += 1;
  }
}

await fs.writeFile(path.resolve(base, outputPath), `${JSON.stringify(sources, null, 2)}\n`);
console.log(JSON.stringify({ enriched, identicalDuplicates, ambiguous, missing, total: milestones.length }, null, 2));
