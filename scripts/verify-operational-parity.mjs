import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const remote = process.argv.includes("--remote");
const manifest = JSON.parse(await readFile("docs/operational-storage-manifest.json", "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const local = (await Promise.all(manifest.map(async (entry) => {
  try {
    const raw = await readFile(entry.file, "utf8");
    return { ...entry, source_sha256: sha256(raw) };
  } catch (error) {
    if (error?.code === "ENOENT") return { ...entry, skipped: "missing-local-source" };
    throw error;
  }
}))).filter((entry) => !entry.skipped);
const skipped = manifest.filter((entry) => !local.some((item) => item.namespace === entry.namespace && item.key === entry.key));

if (!remote) {
  console.log(JSON.stringify({ mode: "local-only", document_count: local.length, skipped, documents: local.map(({ namespace, key, source_sha256 }) => ({ namespace, key, source_sha256 })) }, null, 2));
  process.exit(0);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("La comprobación remota requiere credenciales de solo lectura o service role.");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const result = await db.schema("app_private").from("operational_documents").select("namespace,document_key,source_sha256");
if (result.error) throw new Error(result.error.message);
const remoteHashes = new Map((result.data ?? []).map((row) => [`${row.namespace}/${row.document_key}`, row.source_sha256]));
const differences = local.flatMap((entry) => {
  const key = `${entry.namespace}/${entry.key}`;
  const actual = remoteHashes.get(key);
  return actual === entry.source_sha256 ? [] : [{ key, local_sha256: entry.source_sha256, remote_sha256: actual ?? null }];
});
const extras = [...remoteHashes.keys()].filter((key) => !local.some((entry) => `${entry.namespace}/${entry.key}` === key));
console.log(JSON.stringify({ mode: "remote-read-only", document_count: local.length, skipped, differences, extras }, null, 2));
process.exitCode = differences.length || extras.length ? 1 : 0;
