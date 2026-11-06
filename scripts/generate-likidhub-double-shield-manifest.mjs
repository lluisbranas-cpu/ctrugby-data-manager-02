import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = "data/staging/club-shields/originales";
const reportRoot = "reports/likidhub-preview-clubs-20261105";
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const files = (await readdir(root)).filter(file => imageExtensions.has(path.extname(file).toLowerCase()));
const rows = await Promise.all(files.map(async file => {
  const source = path.join(root, file);
  const [metadata, info] = await Promise.all([sharp(source).metadata(), stat(source)]);
  return { id: path.basename(file, path.extname(file)).toUpperCase(), path: source.replaceAll("\\", "/"), format: metadata.format ?? path.extname(file).slice(1), bytes: info.size, width: metadata.width ?? null, height: metadata.height ?? null, hasAlpha: Boolean(metadata.hasAlpha) };
}));
const rank = row => [Number(row.hasAlpha), (row.width ?? 0) * (row.height ?? 0), ({ png: 3, webp: 2, jpeg: 1, jpg: 1 })[row.format] ?? 0, -row.bytes];
const compare = (left, right) => rank(right).findIndex((value, index) => value !== rank(left)[index]) >= 0 ? (() => { for (let index = 0; index < rank(left).length; index++) if (rank(left)[index] !== rank(right)[index]) return rank(right)[index] - rank(left)[index]; return 0; })() : 0;
const groups = Object.entries(Object.groupBy(rows, row => row.id)).filter(([, entries]) => entries.length > 1).sort(([a], [b]) => a.localeCompare(b));
const manifest = groups.map(([id, entries]) => {
  const ordered = [...entries].sort(compare);
  return { id, first: ordered[0], second: ordered[1], proposed: ordered[0], rule: "Preferir alfa; después mayor área; después PNG > WebP > JPEG; finalmente menor tamaño." };
});
const escape = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = ["club_id,path_a,format_a,bytes_a,width_a,height_a,path_b,format_b,bytes_b,width_b,height_b,proposed_canonical_path,proposed_rule", ...manifest.map(row => [row.id,row.first.path,row.first.format,row.first.bytes,row.first.width,row.first.height,row.second.path,row.second.format,row.second.bytes,row.second.width,row.second.height,row.proposed.path,row.rule].map(escape).join(","))].join("\n") + "\n";
const markdown = `# Escudos dobles de clubs · revisión\n\nRegla propuesta, **no aplicada**: preferir transparencia alfa; después mayor área; después PNG > WebP > JPEG; finalmente menor tamaño.\n\n| Club | Ruta propuesta | Alternativa | Motivo |\n| --- | --- | --- | --- |\n${manifest.map(row => `| ${row.id} | ${row.proposed.path} (${row.proposed.format}, ${row.proposed.width}×${row.proposed.height}, ${row.proposed.bytes} B) | ${row.second.path} (${row.second.format}, ${row.second.width}×${row.second.height}, ${row.second.bytes} B) | ${row.rule} |`).join("\n")}\n`;
await mkdir(reportRoot, { recursive: true });
await Promise.all([writeFile(path.join(reportRoot, "double-shields-review.csv"), csv), writeFile(path.join(reportRoot, "double-shields-review.md"), markdown)]);
console.log(JSON.stringify({ manifest: manifest.length, csv: path.join(reportRoot, "double-shields-review.csv"), markdown: path.join(reportRoot, "double-shields-review.md"), rule_applied: false }, null, 2));
