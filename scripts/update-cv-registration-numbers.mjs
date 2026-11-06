import fs from "node:fs";

const sheetId = "1iiMxarBIHaf2WMQ3iclRzVwGNLZMcv3frrNus_kjChM";
const years = ["2022", "2023", "2024", "2025", "2026"];

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") quoted = false;
      else cell += char;
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalize(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function normalizePlayerId(value) {
  const match = String(value ?? "").match(/CTR\s*0*(\d+)/i);
  return match ? `JUG${String(Number(match[1])).padStart(4, "0")}` : "";
}

function cleanRegistrationNumber(value) {
  return /^\d+$/.test(value) ? String(Number(value)) : value;
}

async function registrationsByYear() {
  const result = {};
  const conflicts = [];
  for (const year of years) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(year)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`No se ha podido leer ${year}: ${response.status}`);
    const rows = parseCsv(await response.text());
    const headerIndex = rows.findIndex((row) => (
      row.some((cell) => ["numero", "num"].includes(normalize(cell))) &&
      row.some((cell) => normalize(cell).includes("ctr") || normalize(cell).includes("id + ano"))
    ));
    if (headerIndex < 0) throw new Error(`No se ha encontrado cabecera de número e ID en ${year}.`);
    const header = rows[headerIndex].map(normalize);
    const numberColumn = header.findIndex((cell) => cell === "numero" || cell === "num");
    const idColumn = header.findIndex((cell) => cell.includes("ctr id") || cell.includes("id + ano") || cell === "ctr id");
    const seen = new Map();
    for (const row of rows.slice(headerIndex + 1)) {
      const number = cleanRegistrationNumber(String(row[numberColumn] ?? "").trim());
      const playerId = normalizePlayerId(row[idColumn]);
      if (!number || !playerId) continue;
      const current = seen.get(playerId) ?? new Set();
      current.add(number);
      seen.set(playerId, current);
    }
    const clean = new Map();
    for (const [playerId, numbers] of seen.entries()) {
      const values = [...numbers];
      if (values.length === 1) clean.set(playerId, values[0]);
      else conflicts.push({ year, playerId, numbers: values });
    }
    result[year] = clean;
  }
  return { result, conflicts };
}

const { result, conflicts } = await registrationsByYear();
const metricsPath = "data/staging/player-participation-metrics.json";
const metrics = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
let updatedPlayers = 0;
let added = 0;
let changed = 0;
let missingLookups = 0;

for (const metric of metrics) {
  const campuses = metric.participation_campus ?? metric.participation_campuses ?? {};
  const registrations = { ...(metric.participation_registration_numbers ?? {}) };
  let touched = false;
  for (const year of metric.participation_years ?? []) {
    if ((campuses[year] ?? "CAM001").toUpperCase() !== "CAM001") continue;
    const number = result[year]?.get(metric.player_id);
    if (!number) {
      missingLookups += 1;
      continue;
    }
    const key = `CAM001:${year}`;
    delete registrations[year];
    if (registrations[key] === number) continue;
    if (registrations[key]) changed += 1;
    else added += 1;
    registrations[key] = number;
    touched = true;
  }
  if (touched) {
    metric.participation_registration_numbers = registrations;
    updatedPlayers += 1;
  }
}

fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);

const counts = {};
for (const metric of metrics) {
  for (const key of Object.keys(metric.participation_registration_numbers ?? {})) {
    const campus = key.split(":")[0] || "yearOnly";
    counts[campus] = (counts[campus] ?? 0) + 1;
  }
}

console.log(JSON.stringify({ updatedPlayers, added, changed, missingLookups, counts, conflicts }, null, 2));
