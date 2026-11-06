import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const migration = await readFile("supabase/migrations/202611050001_operational_store.sql", "utf8");
const mediaMigration = await readFile("supabase/migrations/202611050002_operational_media_index.sql", "utf8");
const manifest = JSON.parse(await readFile("docs/operational-storage-manifest.json", "utf8"));
assert.match(migration, /operational_documents/);
assert.match(migration, /catalog-operational-private/);
assert.match(mediaMigration, /operational_media/);
assert.match(mediaMigration, /source_sha256/);
assert.ok(manifest.length >= 10, "El manifiesto debe cubrir documentos operativos.");
assert.equal(new Set(manifest.map((entry) => `${entry.namespace}/${entry.key}`)).size, manifest.length, "No debe haber claves operativas duplicadas.");
console.log(`Validación de preparación correcta: ${manifest.length} documentos operativos definidos.`);
