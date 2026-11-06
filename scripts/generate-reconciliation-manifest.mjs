import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const outputIndex = process.argv.indexOf("--out");
const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;

if (!outputDirectory || !path.isAbsolute(outputDirectory)) {
  throw new Error("Indica una carpeta absoluta de salida: --out <carpeta-fuera-del-repositorio>");
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan las credenciales locales de Supabase.");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const entities = [
  { name: "clubs", localFile: "data/staging/clubs.json", table: "catalog_clubs" },
  { name: "milestones", localFile: "data/staging/milestones.json", table: "catalog_milestones" },
  { name: "participants", localFile: "data/staging/milestone-participants.json", table: "catalog_participants" },
];

const normalize = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  return value;
};

const comparable = (left, right) => JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function duplicateIds(rows) {
  const seen = new Set();
  const duplicates = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) duplicates.add(row.id);
    seen.add(row.id);
  }
  return [...duplicates].sort();
}

function compareEntity({ name, localRows, remoteRows }) {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
  const localFields = [...new Set(localRows.flatMap((row) => Object.keys(row)))].sort();
  const remoteFields = [...new Set(remoteRows.flatMap((row) => Object.keys(row)))].sort();
  const sharedFields = localFields.filter((field) => remoteFields.includes(field) && field !== "id");
  const localOnly = [...localById.keys()].filter((id) => !remoteById.has(id)).sort();
  const remoteOnly = [...remoteById.keys()].filter((id) => !localById.has(id)).sort();
  const different = [];

  for (const id of [...localById.keys()].filter((candidate) => remoteById.has(candidate)).sort()) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    const fields = sharedFields.filter((field) => !comparable(local[field], remote[field]));
    if (fields.length) {
      different.push({
        id,
        differing_fields: fields,
        recommended_authority: "supabase",
        rationale: "Registro ya centralizado: preservar Supabase hasta que una revisión apruebe una sobrescritura local.",
      });
    }
  }

  return {
    entity: name,
    local_total: localRows.length,
    supabase_total: remoteRows.length,
    comparable_fields: sharedFields,
    local_only_fields: localFields.filter((field) => !remoteFields.includes(field)),
    supabase_only_fields: remoteFields.filter((field) => !localFields.includes(field)),
    duplicate_ids: { local: duplicateIds(localRows), supabase: duplicateIds(remoteRows) },
    local_only: localOnly.map((id) => ({ id, recommended_authority: "local", rationale: "No existe aún en Supabase; tratar como alta candidata tras revisión." })),
    supabase_only: remoteOnly.map((id) => ({ id, recommended_authority: "supabase", rationale: "Ya está centralizado; no eliminar ni recrear desde local." })),
    different,
    recommendation: {
      default_authority: "supabase",
      local_only_authority: "local, sujeto a revisión previa de alta",
      rule: "Para IDs compartidos, no sobrescribir Supabase automáticamente; revisar los campos señalados y documentar la decisión.",
    },
  };
}

const comparisons = {};
for (const entity of entities) {
  const localRows = JSON.parse(await readFile(entity.localFile, "utf8"));
  const remoteRows = await fetchAll(entity.table);
  comparisons[entity.name] = compareEntity({ name: entity.name, localRows, remoteRows });
}

const manifest = {
  generated_at: new Date().toISOString(),
  read_only: true,
  value_policy: "El informe no incluye valores de registros; solo IDs y nombres de campos discrepantes.",
  authority_policy: "Supabase prevalece para registros compartidos y existentes. Los IDs solo locales prevalecen como candidatos de alta, tras revisión humana.",
  entities: comparisons,
};

const summaryRows = Object.values(comparisons).map((item) => [
  item.entity,
  item.local_total,
  item.supabase_total,
  item.local_only.length,
  item.supabase_only.length,
  item.different.length,
]);
const markdown = [
  "# Manifiesto de conciliación local / Supabase",
  "",
  `Generado: ${manifest.generated_at}`,
  "",
  "Lectura solamente. No contiene valores de registros ni modifica Supabase.",
  "",
  "| Entidad | Local | Supabase | Solo local | Solo Supabase | Con campos distintos |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...summaryRows.map((row) => `| ${row.join(" | ")} |`),
  "",
  "## Regla propuesta de autoridad",
  "",
  "- IDs presentes en ambos orígenes: prevalece Supabase hasta aprobar una modificación concreta.",
  "- IDs solo locales: prevalece local como candidato de alta, siempre tras revisión humana.",
  "- IDs solo en Supabase: prevalece Supabase; no eliminar ni recrear desde local.",
  "",
  "El detalle por ID y campo está en `manifest.json`.",
  "",
];

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(path.join(outputDirectory, "README.md"), `${markdown.join("\n")}\n`, "utf8");
console.log(JSON.stringify(Object.fromEntries(Object.entries(comparisons).map(([name, value]) => [name, {
  local: value.local_total,
  supabase: value.supabase_total,
  local_only: value.local_only.length,
  supabase_only: value.supabase_only.length,
  different: value.different.length,
}]))));
