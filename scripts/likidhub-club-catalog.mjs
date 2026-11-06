import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const mime = extension => extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
const rankFormat = { ".png": 3, ".webp": 2, ".jpg": 1, ".jpeg": 1 };
const canonicalOrder = (left, right) => {
  if (left.hasAlpha !== right.hasAlpha) return Number(right.hasAlpha) - Number(left.hasAlpha);
  const leftArea = left.width * left.height, rightArea = right.width * right.height;
  if (leftArea !== rightArea) return rightArea - leftArea;
  if (rankFormat[left.extension] !== rankFormat[right.extension]) return rankFormat[right.extension] - rankFormat[left.extension];
  if (left.bytes !== right.bytes) return left.bytes - right.bytes;
  return left.file.localeCompare(right.file);
};
const digest = async file => createHash("sha256").update(await readFile(file)).digest("hex");

export async function loadLikidHubClubCatalog() {
  const [clubs, shieldNames, coverNames] = await Promise.all([
    readFile("data/staging/clubs.json", "utf8").then(JSON.parse),
    readdir("data/staging/club-shields/originales"),
    readdir("data/staging/club-covers/originales"),
  ]);
  const catalog = clubs.filter(club => /^[A-Z]{3}\d{4}$/.test(club.id)).map(club => ({ id: club.id, name: club.name, published: club.published === true }));
  const catalogIds = new Set(catalog.map(club => club.id));
  const inspect = async (directory, names) => Promise.all(names.filter(name => imageExtensions.has(path.extname(name).toLowerCase())).map(async name => {
    const file = path.join(directory, name), extension = path.extname(name).toLowerCase();
    const [metadata, info, source_sha256] = await Promise.all([sharp(file).metadata(), stat(file), digest(file)]);
    return { id: path.basename(name, extension).toUpperCase(), file, extension, content_type: mime(extension), bytes: info.size, width: metadata.width ?? 0, height: metadata.height ?? 0, hasAlpha: Boolean(metadata.hasAlpha), source_sha256 };
  }));
  const [shieldCandidates, coverCandidates] = await Promise.all([
    inspect("data/staging/club-shields/originales", shieldNames),
    inspect("data/staging/club-covers/originales", coverNames),
  ]);
  const shieldGroups = Object.groupBy(shieldCandidates, item => item.id);
  const duplicateShieldIds = Object.entries(shieldGroups).filter(([, entries]) => entries.length > 1).map(([id]) => id).sort();
  const excludedShieldIds = Object.keys(shieldGroups).filter(id => !catalogIds.has(id)).sort();
  const shields = Object.entries(shieldGroups).filter(([id]) => catalogIds.has(id)).map(([id, entries]) => {
    const selected = [...entries].sort(canonicalOrder)[0];
    return { ...selected, id, key: `club-shields/${id}${selected.extension}`, entity_type: "club-shield", variant: "shield", bucket_id: "catalog-operational-private" };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const covers = coverCandidates.map(item => ({ ...item, key: `club-covers/${item.id}${item.extension}`, entity_type: "club-cover", variant: "cover", bucket_id: "catalog-operational-private" })).sort((a, b) => a.id.localeCompare(b.id));
  const duplicateCoverIds = covers.length - new Set(covers.map(item => item.id)).size;
  return { catalog, shields, covers, summary: {
    catalog_clubs: catalog.length,
    catalog_duplicate_ids: catalog.length - new Set(catalog.map(club => club.id)).size,
    shield_source_files: shieldCandidates.length,
    shield_duplicate_ids: duplicateShieldIds.length,
    canonical_shields: shields.length,
    excluded_shield_ids: excludedShieldIds,
    covers: covers.length,
    cover_duplicate_ids: duplicateCoverIds,
    sources: ["data/staging/clubs.json", "data/staging/club-shields/originales", "data/staging/club-covers/originales"],
  } };
}
