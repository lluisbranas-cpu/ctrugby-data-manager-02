import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging"));

if (!process.argv[2]) {
  throw new Error("Uso: node scripts/prepare-catalog-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");
}

const requiredText = (value, field, record, problems) => {
  const text = value == null ? "" : String(value).trim();
  if (!text) problems.push({ id: record.id ?? null, field, reason: "obligatorio" });
  return text || null;
};

const optionalText = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text || null;
};

const httpsUrl = (value, field, record, problems, required = false) => {
  const text = required ? requiredText(value, field, record, problems) : optionalText(value);
  if (text && !text.startsWith("https://")) {
    problems.push({ id: record.id ?? null, field, reason: "debe usar https" });
  }
  return text;
};

const loadArray = async (filename) => {
  const file = path.join(sourceDirectory, filename);
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`${filename} debe contener una lista JSON.`);
  return parsed;
};

const duplicateIds = (records) => {
  const seen = new Set();
  return records.flatMap((record) => {
    if (!record.id || seen.has(record.id)) return [record.id ?? null];
    seen.add(record.id);
    return [];
  });
};

const sqlLiteral = (value) => {
  if (value == null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};

const insertStatement = (table, columns, rows) => rows.length
  ? `insert into ${table} (${columns.join(", ")}) values\n${rows.map((row) => `  (${columns.map((column) => sqlLiteral(row[column])).join(", ")})`).join(",\n")}\non conflict do nothing;\n`
  : "";

const importSql = (clubs, federations) => {
  const clubColumns = ["id", "name", "active", "founded_text", "disappeared_text", "city", "province", "region", "country", "latitude", "longitude", "maps_url", "website", "instagram"];
  const federationColumns = ["id", "name", "scope", "territory", "country", "active", "website"];
  const clubNotes = clubs.filter((club) => club.note).map(({ id, note }) => ({ club_id: id, note }));
  const federationNotes = federations
    .filter((federation) => federation.email || federation.legacy_club_count != null)
    .map(({ id, email, legacy_club_count }) => ({ federation_id: id, email, legacy_club_count }));
  return [
    "-- Generado localmente. Revisa el informe antes de ejecutarlo en Supabase.",
    "-- Inserta solo registros inexistentes; no publica ni sobrescribe cambios posteriores.",
    "begin;",
    insertStatement("public.catalog_clubs", clubColumns, clubs),
    insertStatement("app_private.club_notes", ["club_id", "note"], clubNotes),
    insertStatement("public.catalog_federations", federationColumns, federations),
    insertStatement("app_private.federation_notes", ["federation_id", "email", "legacy_club_count"], federationNotes),
    "commit;",
    "",
  ].join("\n");
};

const prepareClubs = (rows, problems) => rows.map((row) => {
  const id = requiredText(row.id, "id", row, problems);
  if (id && !/^[A-Z]{3}[0-9]{4}$/.test(id)) problems.push({ id, field: "id", reason: "formato inválido" });
  const record = { id };
  return {
    id,
    name: requiredText(row.name, "name", record, problems),
    active: Boolean(row.active),
    founded_text: optionalText(row.founded),
    disappeared_text: optionalText(row.disappeared),
    city: requiredText(row.city, "city", record, problems),
    province: requiredText(row.province, "province", record, problems),
    region: requiredText(row.region, "region", record, problems),
    country: requiredText(row.country, "country", record, problems),
    latitude: typeof row.lat === "number" && Number.isFinite(row.lat) ? row.lat : null,
    longitude: typeof row.lng === "number" && Number.isFinite(row.lng) ? row.lng : null,
    maps_url: httpsUrl(row.maps, "maps", record, problems, true),
    website: httpsUrl(row.web, "web", record, problems),
    instagram: optionalText(row.instagram),
    note: optionalText(row.note),
  };
});

const prepareFederations = (rows, problems) => rows.map((row) => {
  const id = requiredText(row.id, "id", row, problems);
  if (id && !/^F[A-Z][0-9]{3}$/.test(id)) problems.push({ id, field: "id", reason: "formato inválido" });
  const record = { id };
  return {
    id,
    name: requiredText(row.name, "name", record, problems),
    scope: requiredText(row.scope, "scope", record, problems),
    territory: requiredText(row.territory, "territory", record, problems),
    country: requiredText(row.country, "country", record, problems),
    active: Boolean(row.active),
    website: httpsUrl(row.web, "web", record, problems),
    email: optionalText(row.email),
    legacy_club_count: Number.isInteger(row.clubs) && row.clubs >= 0 ? row.clubs : null,
  };
});

const sourceStats = await stat(sourceDirectory).catch(() => null);
if (!sourceStats?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");

const [clubRows, federationRows] = await Promise.all([
  loadArray("clubs-data.json"),
  loadArray("federations-data.json"),
]);
const problems = [];
const clubs = prepareClubs(clubRows, problems);
const federations = prepareFederations(federationRows, problems);
for (const id of duplicateIds(clubs)) problems.push({ id, field: "id", reason: "ID de club duplicado" });
for (const id of duplicateIds(federations)) problems.push({ id, field: "id", reason: "ID de federación duplicado" });
for (const club of clubs) {
  if (club.latitude == null || club.latitude < -90 || club.latitude > 90) problems.push({ id: club.id, field: "latitude", reason: "coordenada inválida" });
  if (club.longitude == null || club.longitude < -180 || club.longitude > 180) problems.push({ id: club.id, field: "longitude", reason: "coordenada inválida" });
}

const report = {
  generated_at: new Date().toISOString(),
  source_directory: sourceDirectory,
  clubs: clubs.length,
  federations: federations.length,
  problems,
};

if (problems.length) {
  throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(report, null, 2)}`);
}

await mkdir(outputDirectory, { recursive: true });
const outputs = ["clubs.json", "federations.json", "report.json"];
outputs.push("catalog-import.sql");
for (const filename of outputs) {
  const destination = path.join(outputDirectory, filename);
  const exists = await stat(destination).then(() => true).catch(() => false);
  if (exists) throw new Error(`${destination} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);
}
await Promise.all([
  writeFile(path.join(outputDirectory, "clubs.json"), `${JSON.stringify(clubs, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "federations.json"), `${JSON.stringify(federations, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "catalog-import.sql"), importSql(clubs, federations)),
]);

console.log(JSON.stringify({ ok: true, outputDirectory, clubs: clubs.length, federations: federations.length }, null, 2));
