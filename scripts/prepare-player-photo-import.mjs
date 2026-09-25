import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
const outputDirectory = path.resolve(process.argv[3] || path.join(projectDirectory, "data", "staging", "player-photos"));
if (!process.argv[2]) throw new Error("Uso: node scripts/prepare-player-photo-import.mjs <carpeta-app-antigua> [carpeta-de-salida]");

if (!(await stat(sourceDirectory).catch(() => null))?.isDirectory()) throw new Error("La carpeta de la aplicación anterior no existe.");
const ids = JSON.parse(await readFile(path.join(sourceDirectory, "player-photos-data.json"), "utf8"));
const players = JSON.parse(await readFile(path.join(projectDirectory, "data", "staging", "players.json"), "utf8"));
if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string" && /^CTR\d{4}$/.test(id)) || !Array.isArray(players)) throw new Error("El índice de fotografías no tiene el formato esperado.");
if (new Set(ids).size !== ids.length) throw new Error("El índice de fotografías contiene identificadores duplicados.");
const playerIds = new Set(players.map((player) => player.id));
const sourcePhotos = path.join(sourceDirectory, "..", "public", "player-photos");
const preparedDirectory = path.join(outputDirectory, "prepared");
const manifestFile = path.join(outputDirectory, "manifest.json");
if (await stat(manifestFile).then(() => true).catch(() => false)) throw new Error(`${manifestFile} ya existe. Elimina o mueve la preparación anterior antes de volver a generarla.`);

await mkdir(preparedDirectory, { recursive: true });
const mask = Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="150" fill="white"/></svg>');
const manifest = [];
const problems = [];
for (const player_id of ids) {
  if (!playerIds.has(player_id)) { problems.push({ player_id, reason: "no existe en el catálogo privado" }); continue; }
  const source_file = path.join(sourcePhotos, `${player_id}.webp`);
  if (!(await stat(source_file).catch(() => null))?.isFile()) { problems.push({ player_id, reason: "archivo de origen no encontrado" }); continue; }
  const metadata = await sharp(source_file, { limitInputPixels: 20_000_000 }).metadata();
  if (metadata.format !== "webp" || !metadata.width || !metadata.height) { problems.push({ player_id, reason: "imagen WebP inválida" }); continue; }
  const storage_key = `player-portraits/${player_id}.png`;
  const prepared_file = path.join(preparedDirectory, `${player_id}.png`);
  const prepared = await sharp(source_file, { limitInputPixels: 20_000_000 }).rotate()
    .resize(300, 300, { fit: "fill" }).ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  await writeFile(prepared_file, prepared);
  const preparedMetadata = await sharp(prepared).metadata();
  if (preparedMetadata.width !== 300 || preparedMetadata.height !== 300 || !preparedMetadata.hasAlpha) { problems.push({ player_id, reason: "la copia preparada no conserva 300px y alfa" }); continue; }
  manifest.push({ player_id, storage_key, source_file, prepared_file, source_width: metadata.width, source_height: metadata.height, prepared_bytes: prepared.length });
}
if (problems.length) throw new Error(`La preparación detectó ${problems.length} problema(s):\n${JSON.stringify(problems, null, 2)}`);
const report = {
  generated_at: new Date().toISOString(), source_directory: sourceDirectory, photos: manifest.length,
  source_dimensions: [...new Set(manifest.map((item) => `${item.source_width}x${item.source_height}`))],
  prepared_dimensions: "300x300", prepared_png_bytes: manifest.reduce((total, item) => total + item.prepared_bytes, 0),
};
await Promise.all([
  writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`),
]);
console.log(JSON.stringify({ ok: true, outputDirectory, ...report }, null, 2));
