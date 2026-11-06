import { mkdir, rename, writeFile } from "node:fs/promises";
import { readFile } from "./bounded-file-reads";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Categories follow the application's local staging storage, like season photos.
const filename = (id: string) => path.join(process.cwd(), "data", "staging", "player-season-categories", `${id}.json`);
export async function readSeasonCategories(id: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(filename(id), "utf8")) as Record<string, string>; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export async function saveSeasonCategories(id: string, seasons: { season_year: number; playing_category?: string | null }[]) {
  const previous = await readSeasonCategories(id);
  const categories = Object.fromEntries(seasons.map((season) => [String(season.season_year), season.playing_category === undefined ? previous[String(season.season_year)] ?? "" : season.playing_category ?? ""]).filter(([, category]) => category));
  const target = filename(id); await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(categories, null, 2)); await rename(temporary, target);
  return categories;
}

// Categories follow the application's local staging storage, like season photos.
const competitionFilename = (id: string) => path.join(process.cwd(), "data", "staging", "player-season-competition-categories", `${id}.json`);
export async function readCompetitionCategories(id: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(competitionFilename(id), "utf8")) as Record<string, string>; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export async function saveCompetitionCategories(id: string, seasons: { season_year: number; competition_category?: string | null }[]) {
  const previous = await readCompetitionCategories(id);
  const categories = Object.fromEntries(seasons.map((season) => [String(season.season_year), season.competition_category === undefined ? previous[String(season.season_year)] ?? "" : season.competition_category ?? ""]).filter(([, category]) => category));
  const target = competitionFilename(id); await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`; await writeFile(temporary, JSON.stringify(categories, null, 2)); await rename(temporary, target);
  return categories;
}
