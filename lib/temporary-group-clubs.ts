import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readTemporaryClubGroups, type TemporaryClubGroup } from "./temporary-club-groups";
import { readSeasonCategories } from "./player-season-categories";
import { groupMembershipMatches, type ClubGroupMembership } from "../app/lib/club-group-membership";
import type { ClubDirectoryRecord } from "./club-directory-overrides";
export type GroupClub = ClubDirectoryRecord & { group_key: string; is_temporary_group: true };
const file = () => path.join(process.cwd(), "data/staging/temporary-group-clubs.json");
const key = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es").replace(/\s+/g, " ");
export async function readGroupClubs(): Promise<GroupClub[]> {
  try { return JSON.parse(await readFile(file(), "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
let pending: Promise<unknown> = Promise.resolve();
async function update(change: (clubs: GroupClub[]) => GroupClub[]) {
  const work = pending.then(async () => { const clubs = change(await readGroupClubs()); await mkdir(path.dirname(file()), { recursive: true }); const temp = file() + "." + randomUUID() + ".tmp"; await writeFile(temp, JSON.stringify(clubs, null, 2) + "\n"); await rename(temp, file()); return clubs; });
  pending = work.catch(() => undefined); return work;
}
export async function ensureGroupClubs(groups: TemporaryClubGroup[]) {
  return update(clubs => {
    for (const group of groups) {
      let club = clubs.find(club => club.id === group.club_id) || clubs.find(club => club.group_key === key(group.name));
      if (!club) {
        const number = Math.max(0, ...clubs.map(club => Number(club.id.slice(3)))) + 1;
        if (number > 9999) throw new Error("Se ha alcanzado el límite de agrupaciones.");
        club = { id: "ATC" + String(number).padStart(4, "0"), name: group.name, group_key: key(group.name), is_temporary_group: true, active: true, founded_text: null, city: "", province: "", region: "", country: "", latitude: 0, longitude: 0, maps_url: "", website: null, instagram: null }; clubs.push(club);
      }
      group.club_id = club.id;
    }
    return clubs;
  });
}
export async function saveGroupClub(id: string, values: Partial<ClubDirectoryRecord>) {
  let saved: GroupClub | undefined;
  await update(clubs => clubs.map(club => { if (club.id !== id) return club; saved = { ...club, ...values, id: club.id, group_key: club.group_key, is_temporary_group: true }; return saved; }));
  return saved;
}
export async function withGroupClubs<T extends { id: string; name: string }>(clubs: T[]) {
  const existing = new Set(clubs.map(club => club.id)); return [...clubs, ...(await readGroupClubs()).filter(club => !existing.has(club.id))];
}
type Season = { player_id: string; season_year: number; club_id: string | null; playing_category?: string | null };
export async function readGroupMemberships(seasons?: Season[]) {
  const groups = await readTemporaryClubGroups();
  const clubs = await readGroupClubs();
  const source: Season[] = seasons ?? JSON.parse(await readFile(path.join(process.cwd(), "data/staging/player-seasons.json"), "utf8"));
  const members = new Set(groups.flatMap(group => group.club_ids));
  const relevant = source.filter(row => row.club_id && members.has(row.club_id));
  const categories = new Map(await Promise.all([...new Set(relevant.map(row => row.player_id))].map(async id => [id, await readSeasonCategories(id)] as const)));
  const result = new Map<string, ClubGroupMembership[]>();
  for (const season of relevant) for (const group of groups) {
    if (!group.club_ids.includes(season.club_id!)) continue;
    const club = clubs.find(club => club.id === group.club_id) || clubs.find(club => club.group_key === key(group.name));
    if (!club) continue;
    const rows = result.get(season.player_id) || [];
    rows.push({ club_id: club.id, name: club.name, season_year: season.season_year, category: season.playing_category || categories.get(season.player_id)?.[String(season.season_year)] || null, group_season: group.season, group_category: group.category }); result.set(season.player_id, rows);
  }
  return result;
}
export async function groupPlayerIds(clubId: string, year?: string | null, category?: string | null, seasons?: Season[]) {
  const memberships = await readGroupMemberships(seasons);
  return new Set([...memberships].filter(([, rows]) => rows.some(row => row.club_id === clubId && groupMembershipMatches(row, year, category))).map(([id]) => id));
}
