import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const newsDirectory = path.join(root, "data", "staging", "player-news");
const imageDirectory = path.join(root, "data", "staging", "player-news-images");
const bridgePath = path.join(root, "lib", "likidhub-jug-ctr-bridge.generated.ts");
const clubsPath = path.join(root, "data", "staging", "clubs.json");
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const jug = /^JUG\d{4}$/;

const sha256 = (value) => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

export async function loadJugCtrBridge() {
  const source = await readFile(bridgePath, "utf8");
  const bridge = new Map([...source.matchAll(/"(JUG\d{4})":\s*"(CTR\d{4})"/g)].map((match) => [match[1], match[2]]));
  if (bridge.size !== 388 || bridge.has("JUG0381") || new Set(bridge.values()).size !== 388) throw new Error("Puente JUG→CTR inválido.");
  return bridge;
}

const kindFor = (value) => value === "seleccion" ? "selection" : value === "participacion" ? "participation" : "news";
const payloadFor = (record) => ({
  source_type: typeof record.type === "string" ? record.type : null,
  image_source: record.image_source === "custom" || record.image_source === "federation" ? record.image_source : null,
  image_updated_at: typeof record.image_updated_at === "string" ? record.image_updated_at : null,
  participation: record.participation && typeof record.participation === "object" ? record.participation : null,
  selection: record.selection && typeof record.selection === "object" ? record.selection : null,
});

export async function loadPlayerNewsPlan() {
  const [bridge, clubRows, files] = await Promise.all([loadJugCtrBridge(), readFile(clubsPath, "utf8").then(JSON.parse), readdir(newsDirectory)]);
  const clubIds = new Set(clubRows.map((club) => club.id));
  const issues = { invalid_files: [], invalid_ids: [], unmatched_players: [], invalid_updated_at: [], broken_club_references: [], duplicate_ids: [] };
  const seen = new Set();
  const rows = [];
  for (const file of files.filter((name) => name.endsWith(".json")).sort()) {
    const id = file.slice(0, -5);
    if (!uuid.test(id)) { issues.invalid_files.push(file); continue; }
    const record = JSON.parse(await readFile(path.join(newsDirectory, file), "utf8"));
    if (record.id !== id || typeof record.player_id !== "string" || !jug.test(record.player_id) || typeof record.title !== "string" || !record.title.trim()) { issues.invalid_ids.push(file); continue; }
    const playerId = bridge.get(record.player_id);
    if (!playerId) { issues.unmatched_players.push({ id, player_id: record.player_id }); continue; }
    if (seen.has(id)) { issues.duplicate_ids.push(id); continue; }
    seen.add(id);
    const sourceUpdatedAt = typeof record.updated_at === "string" && !Number.isNaN(Date.parse(record.updated_at)) ? record.updated_at : null;
    if (!sourceUpdatedAt) { issues.invalid_updated_at.push(id); continue; }
    const participation = record.participation && typeof record.participation === "object" ? record.participation : null;
    const clubId = typeof participation?.club_id === "string" && participation.club_id ? participation.club_id : null;
    if (clubId && !clubIds.has(clubId)) issues.broken_club_references.push({ id, club_id: clubId });
    const source = { local_id: id, local_player_id: record.player_id, player_id: playerId, kind: kindFor(record.type), title: record.title.trim(), date_or_season: typeof record.date_or_season === "string" ? record.date_or_season : "", published: record.published === true, source_url: typeof record.url === "string" ? record.url : "", club_id: clubId, club_name: typeof participation?.club_name === "string" ? participation.club_name : "", payload: payloadFor(record) };
    rows.push({ ...source, source_sha256: sha256(stable(source)), source_updated_at: sourceUpdatedAt });
  }
  return { rows, issues };
}

export async function loadPlayerNewsImagePlan() {
  const { rows, issues } = await loadPlayerNewsPlan();
  const byId = new Map(rows.map((row) => [row.local_id, row]));
  const imageIssues = { invalid_files: [], unresolved_news: [], duplicate_object_keys: [] };
  const diagnostics = { inferred_custom_image_source: [] };
  const images = [];
  const objectKeys = new Set();
  for (const file of (await readdir(imageDirectory)).filter((name) => name.endsWith(".webp")).sort()) {
    const id = file.slice(0, -5);
    if (!uuid.test(id)) { imageIssues.invalid_files.push(file); continue; }
    const news = byId.get(id);
    if (!news) { imageIssues.unresolved_news.push(id); continue; }
    // The legacy reader treats an existing .webp as a custom image even when
    // the historical JSON predates the image_source flag.
    if (news.payload.image_source !== "custom") diagnostics.inferred_custom_image_source.push(id);
    const filePath = path.join(imageDirectory, file);
    const bytes = await readFile(filePath);
    const objectKey = `player-news/${id}.webp`;
    if (objectKeys.has(objectKey)) { imageIssues.duplicate_object_keys.push(objectKey); continue; }
    objectKeys.add(objectKey);
    images.push({ news_id: id, file: filePath, object_key: objectKey, bucket_id: "catalog-operational-private", content_type: "image/webp", byte_size: (await stat(filePath)).size, source_sha256: sha256(bytes) });
  }
  return { rows, images, issues: { ...issues, ...imageIssues }, diagnostics };
}

export function issueCount(issues) { return Object.values(issues).reduce((total, value) => total + value.length, 0); }
