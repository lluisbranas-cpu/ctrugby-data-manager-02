import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.resolve(process.argv[2] || "");
if (!process.argv[2]) throw new Error("Uso: node scripts/review-player-club-pending.mjs <carpeta-app-antigua>");

const normalize = (value) => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, "");
const distance = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0]; row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex];
      row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
};
const score = (left, right) => {
  const a = normalize(left); const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - distance(a, b) / Math.max(a.length, b.length);
};

const [pending, players, clubs] = await Promise.all([
  readFile(path.join(projectDirectory, "data", "staging", "player-clubs", "unresolved-affiliations.json"), "utf8").then(JSON.parse),
  readFile(path.join(sourceDirectory, "players-data.json"), "utf8").then(JSON.parse),
  readFile(path.join(sourceDirectory, "clubs-data.json"), "utf8").then(JSON.parse),
]);
const report = pending.map((entry) => {
  const candidates = players.map((player) => ({
    player_id: player.id,
    player_name: [player.nombre, player.apellidos].filter(Boolean).join(" "),
    score: Number(score(entry.legacy_name, [player.nombre, player.apellidos].filter(Boolean).join(" ")).toFixed(3)),
  })).sort((a, b) => b.score - a.score).slice(0, 3);
  const club = clubs.find((item) => normalize(item.name) === normalize(entry.legacy_club));
  return { ...entry, club_id: club?.id ?? null, candidates };
});
const destination = path.join(projectDirectory, "data", "staging", "player-clubs", "candidate-report.json");
await writeFile(destination, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
