import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const manifest = JSON.parse(await readFile("docs/operational-storage-manifest.json", "utf8"));
const hash = (text) => createHash("sha256").update(text).digest("hex");
const attempted = await Promise.all(manifest.map(async (entry) => {
  try {
    const raw = await readFile(entry.file, "utf8");
    return { ...entry, raw, payload: JSON.parse(raw), source_sha256: hash(raw) };
  } catch (error) {
    if (error?.code === "ENOENT") return { ...entry, skipped: "missing-local-source" };
    throw error;
  }
}));
const rows = attempted.filter((row) => !row.skipped);
const summary = { mode: apply ? "apply" : "dry-run", documents: rows.length, skipped: attempted.filter((row) => row.skipped).map(({ namespace, key, file, skipped }) => ({ namespace, key, file, skipped })), files: rows.map(({ namespace, key, file, source_sha256 }) => ({ namespace, key, file, source_sha256 })) };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (process.argv.includes("--confirm") === false) throw new Error("La escritura exige --apply --confirm.");
const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const row of rows) {
  const result = await db.schema("app_private").from("operational_documents").upsert({ namespace: row.namespace, document_key: row.key, payload: row.payload, source_sha256: row.source_sha256, updated_at: new Date().toISOString() }, { onConflict: "namespace,document_key" });
  if (result.error) throw new Error(`${row.file}: ${result.error.message}`);
}
console.log(JSON.stringify(summary, null, 2));
