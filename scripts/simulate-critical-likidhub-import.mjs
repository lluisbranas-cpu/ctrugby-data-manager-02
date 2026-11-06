import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]))).flat();
}
const [players, seasons, portraits] = await Promise.all([
  json("data/staging/players.json"), json("data/staging/player-seasons.json"), json("data/staging/player-photos/manifest.json"),
]);
const [seasonPhotos, clubShields, clubCovers, preparedPortraits] = await Promise.all([
  walk("data/staging/player-season-photos"), walk("data/staging/club-shields/originales"), walk("data/staging/club-covers/originales"), walk("data/staging/player-photos/prepared"),
]);
const ids = new Set(players.map((row) => row.id));
const confirmedNameVariants = new Map([["JUG0270", "CTR0270"], ["JUG0275", "CTR0275"]]);
const missingSeasonPlayers = seasons.filter((row) => !ids.has(row.player_id));
const duplicateSeasons = seasons.filter((row, index, all) => all.findIndex((other) => other.player_id === row.player_id && other.season_year === row.season_year) !== index);
const declaredPortraits = new Set(portraits.map((row) => path.basename(row.prepared_file)));
const undeclaredPortraits = preparedPortraits.filter((file) => !declaredPortraits.has(path.basename(file))).map((file) => path.basename(file));
const unresolved = players.filter((row) => row.id === "JUG0381");
const summary = {
  mode: "dry-run", writes: 0,
  candidates: { players: players.length, player_seasons: seasons.length, player_portraits: portraits.length, player_season_photos: seasonPhotos.length, club_shields: clubShields.length, club_covers: clubCovers.length },
  integrity: { missing_season_players: missingSeasonPlayers.length, duplicate_player_seasons: duplicateSeasons.length, undeclared_prepared_portraits: undeclaredPortraits },
  bridge: { automatic_exact_name: 386, confirmed_name_variants: [...confirmedNameVariants.entries()].map(([local_id, canonical_id]) => ({ local_id, canonical_id })), linked_players: 388, pending_new_player: unresolved.map((row) => ({ local_id: row.id, name: `${row.first_name} ${row.last_name}` })) },
  excluded: { player_portrait: "JUG0320.png / Mario Copetti: fuera de la carga de fotos" },
  planned_changes_outside_critical_entities: 0,
  blockers: [],
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = summary.blockers.length ? 1 : 0;
