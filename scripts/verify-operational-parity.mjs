import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

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

const remoteEnv = await likidHubEnv();
process.env.SUPABASE_URL ??= remoteEnv.url;
process.env.SUPABASE_SERVICE_ROLE_KEY ??= remoteEnv.serviceRoleKey;
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("La comprobación remota requiere credenciales de solo lectura o service role.");
const db = createClient(remoteEnv.url, remoteEnv.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const remoteRows = await Promise.all(local.map(async (entry) => {
  const result = await db.schema("app_private").from("operational_documents")
    .select("source_sha256")
    .eq("namespace", entry.namespace)
    .eq("document_key", entry.key)
    .maybeSingle();
  if (result.error) throw new Error(`${entry.namespace}/${entry.key}: ${result.error.message}`);
  return [`${entry.namespace}/${entry.key}`, result.data?.source_sha256 ?? null];
}));
const remoteHashes = new Map(remoteRows);
const differences = local.flatMap((entry) => {
  const key = `${entry.namespace}/${entry.key}`;
  const actual = remoteHashes.get(key);
  return actual === entry.source_sha256 ? [] : [{ key, local_sha256: entry.source_sha256, remote_sha256: actual ?? null }];
});
console.log(JSON.stringify({ mode: "remote-read-only", document_count: local.length, skipped, differences }, null, 2));
process.exitCode = differences.length ? 1 : 0;
