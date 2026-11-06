import { readFile, writeFile } from "node:fs/promises";

const csv = (await readFile("reports/player-id-reconciliation-20261105/puente-jug-a-ctr.csv", "utf8")).trim().split(/\r?\n/).slice(1);
const variants = (await readFile("reports/player-id-reconciliation-20261105/puente-jug-a-ctr-variantes-confirmadas.csv", "utf8")).trim().split(/\r?\n/).slice(1);
const bridge = new Map();
for (const line of csv) {
  const match = line.match(/^"?(JUG\d{4})"?,"?(CTR\d{4})"?,"correspondencia segura"/);
  if (match) bridge.set(match[1], match[2]);
}
for (const line of variants) {
  const match = line.match(/^(JUG\d{4}),(CTR\d{4}),/);
  if (match) bridge.set(match[1], match[2]);
}
if (bridge.size !== 388 || bridge.has("JUG0381") || new Set(bridge.values()).size !== 388) throw new Error("El puente JUG→CTR debe contener exactamente 388 correspondencias únicas y excluir JUG0381.");
const body = `// Generado por scripts/generate-likidhub-preview-id-bridge.mjs. No editar manualmente.\nexport const jugToCtr = ${JSON.stringify(Object.fromEntries([...bridge].sort(([a], [b]) => a.localeCompare(b))), null, 2)} as const;\n\nexport function canonicalLikidHubPlayerId(id: string): string | null {\n  const value = id.toUpperCase();\n  if (/^CTR\\d{4}$/.test(value)) return value;\n  return jugToCtr[value as keyof typeof jugToCtr] ?? null;\n}\n`;
await writeFile("lib/likidhub-jug-ctr-bridge.generated.ts", body, "utf8");
console.log(JSON.stringify({ generated: "lib/likidhub-jug-ctr-bridge.generated.ts", correspondences: bridge.size, excluded: "JUG0381" }, null, 2));
