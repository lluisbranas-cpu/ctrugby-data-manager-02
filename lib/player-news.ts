import { campusParticipationTitle } from "@/app/lib/campus-title";
import { callupDefaultImage } from "./callup-default-image";
import { participationCategoryImage, participationImageById } from "./participation-category-image";
import { participationFromBody, type NewsParticipation } from "./news-participation";
import { access, mkdir, readdir, rename, writeFile } from "node:fs/promises";
import { readFile } from "./bounded-file-reads";
import path from "node:path";
import { newsDateLabel, newsDateSortKey } from "@/app/lib/news-date";
import { randomUUID } from "node:crypto";
import { selectionFromBody, type NewsSelection } from "./news-selection";

export type PlayerNews = { image_source?: "federation" | "custom"; participation?: NewsParticipation | null; selection?: NewsSelection | null; type: "noticia" | "seleccion" | "participacion"; id: string; player_id: string; date_or_season: string; title: string; url: string; published: boolean; image_updated_at?: string | null; image_url?: string; updated_at: string };
export type NewsInput = Omit<PlayerNews, "type" | "id" | "updated_at" | "published" | "image_updated_at" | "image_url"> & { type?: "noticia" | "seleccion" | "participacion"; id?: string; published?: boolean };
const directory = () => path.join(process.cwd(), "data", "staging", "player-news");
const deletedDirectory = () => path.join(process.cwd(), "data", "staging", "player-news-deleted");
export const validNewsId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id);
export function newsFromBody(value: unknown): NewsInput | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.type !== undefined && data.type !== "noticia" && data.type !== "seleccion" && data.type !== "participacion") return null;
  const participation = data.type === "participacion" ? participationFromBody(data.participation) : null;
  if (data.type === "participacion" && !participation) return null;
  const selection = data.type === "seleccion" ? selectionFromBody(data.selection) : null;
  if (data.type === "seleccion" && !selection) return null;
  if (data.image_source !== undefined && data.image_source !== "federation" && data.image_source !== "custom") return null;
  if (data.published !== undefined && typeof data.published !== "boolean") return null;
  if (typeof data.player_id !== "string" || !/^JUG\d{4}$/.test(data.player_id)) return null;
  if (data.id !== undefined && (typeof data.id !== "string" || !validNewsId(data.id))) return null;
  if (typeof data.title !== "string" || !data.title.trim() || data.title.length > 240) return null;
  if (typeof data.date_or_season !== "string" || data.date_or_season.length > 40) return null;
  if (data.type !== "participacion" && data.type !== "seleccion" && !newsDateLabel(data.date_or_season)) return null;
  if (data.type === "participacion" && participation?.kind !== "campus" && data.date_or_season.trim() && !newsDateLabel(data.date_or_season)) return null;
  if (typeof data.url !== "string" || data.url.length > 2048) return null;
  try {
    let sourceUrl = "";
    if (data.type !== "participacion" && (data.type !== "seleccion" || data.url.trim())) {const url = new URL(data.url.trim()); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null; sourceUrl = url.href;}
    return { ...(data.image_source ? {image_source: data.image_source as "federation" | "custom"} : {}), participation, selection, ...(data.type ? { type: data.type as "noticia" | "seleccion" | "participacion" } : {}), ...(data.id ? { id: data.id as string } : {}), ...(typeof data.published === "boolean" ? { published: data.published } : {}), player_id: data.player_id, date_or_season: participation?.kind === "campus" ? participation.year || "" : newsDateLabel(data.date_or_season) || (data.type === "seleccion" ? data.date_or_season.trim() : ""), title: data.title.trim(), url: sourceUrl };
  } catch { return null; }
}
async function campusNames(): Promise<Map<string, string>> {
  try {
    const categories = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "professional-categories.json"), "utf8")) as {id: string; label: string; type: string}[];
    return new Map(categories.filter(item => item.type === "CAMP").map(item => [item.id, item.label]));
  } catch (error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map(); throw error;}
}
function campusTitle<T extends NewsInput | PlayerNews>(record: T, names: Map<string, string>): T {
  if (record.type !== "participacion" || record.participation?.kind !== "campus") return record;
  const year = record.participation.year?.trim() || null;
  return {...record, title: campusParticipationTitle(names.get(record.participation.campus_id || "") || record.participation.campus_id || "Campus", year), date_or_season: year || "", participation: {...record.participation, year, pending_year: !year, count: year ? 1 : record.participation.count ?? 1}};
}
// Share only an in-progress disk read, never a cached response or permissions.
// Once it finishes, the next call reads disk again so edits appear immediately.
let loadingNews: Promise<PlayerNews[]> | undefined;
export async function readPlayerNews(playerId?: string): Promise<PlayerNews[]> {
  let pending = loadingNews;
  if (!pending) {
    pending = loadAllPlayerNews();
    loadingNews = pending;
    const clear = () => { if (loadingNews === pending) loadingNews = undefined; };
    void pending.then(clear, clear);
  }
  const records = await pending;
  return structuredClone(playerId ? records.filter((record) => record.player_id === playerId) : records);
}
async function loadAllPlayerNews(): Promise<PlayerNews[]> {
  let files: string[];
  try { files = await readdir(directory()); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const loaded = await Promise.all(files.filter((file) => file.endsWith(".json") && validNewsId(file.slice(0, -5))).map(async (file) => {
    try { return JSON.parse(await readFile(path.join(directory(), file), "utf8")) as PlayerNews; }
    catch (error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error;}
  }));
  const records = loaded.filter((record): record is PlayerNews => record !== null);
  const names = records.some(record => record.participation?.kind === "campus") ? await campusNames() : new Map<string, string>();
  return records.map(record => campusTitle(record, names)).map((record) => ({ ...record, type: record.type === "seleccion" ? "seleccion" as const : record.type === "participacion" ? "participacion" as const : "noticia" as const, date_or_season: newsDateLabel(record.date_or_season) ?? record.date_or_season, published: record.published === true })).sort((a, b) => newsDateSortKey(b.date_or_season).localeCompare(newsDateSortKey(a.date_or_season)) || a.title.localeCompare(b.title, "es"));
}
export async function readDeletedPlayerNews(): Promise<PlayerNews[]> {
  let files: string[];
  try {files = await readdir(deletedDirectory());} catch (error) {if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error;}
  return Promise.all(files.filter(file => file.endsWith(".json") && validNewsId(file.slice(0,-5))).map(async file => JSON.parse(await readFile(path.join(deletedDirectory(), file), "utf8")) as PlayerNews));
}
export function deletePlayerNews(id: string): Promise<PlayerNews> {
  if (!validNewsId(id)) return Promise.reject(new Error("Registro no válido."));
  const operation = (newsWrites.get(id) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const record = (await readPlayerNews()).find(item => item.id === id);
    if (!record) throw new Error("El registro ya no existe. Recarga la tabla.");
    await mkdir(deletedDirectory(), {recursive: true});
    await rename(path.join(directory(), id + ".json"), path.join(deletedDirectory(), id + ".json"));
    // Keep the original for recovery and to prevent imported sources reappearing.
    await rename(path.join(process.cwd(), "data", "staging", "player-news-images", id + ".webp"), path.join(deletedDirectory(), id + ".webp")).catch(() => undefined);
    return record;
  });
  newsWrites.set(id, operation);
  void operation.finally(() => {if (newsWrites.get(id) === operation) newsWrites.delete(id);}).catch(() => undefined);
  return operation;
}
const newsWrites = new Map<string, Promise<PlayerNews>>();
export function savePlayerNews(input: NewsInput, imageUpdatedAt?: string): Promise<PlayerNews> {
  const id = input.id ?? randomUUID();
  const previousWrite = newsWrites.get(id);
  const operation = (previousWrite ?? Promise.resolve()).catch(() => undefined).then(() => writePlayerNews({ ...input, id }, imageUpdatedAt));
  newsWrites.set(id, operation);
  void operation.finally(() => { if (newsWrites.get(id) === operation) newsWrites.delete(id); }).catch(() => undefined);
  return operation;
}
async function writePlayerNews(input: NewsInput, imageUpdatedAt?: string): Promise<PlayerNews> {
  if (input.id) {
    if (!validNewsId(input.id)) throw new Error("Registro no válido.");
    const removed = await access(path.join(deletedDirectory(), input.id + ".json")).then(() => true, error => {if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error;});
    if (removed) throw new Error("Este registro se ha eliminado. Recarga la tabla.");
  }
  const previous = input.id ? (await readPlayerNews()).find((record) => record.id === input.id) : undefined;
  const merged = {...previous, ...input};
  if (merged.type === "participacion") merged.participation = {...previous?.participation, ...input.participation, ...(previous?.participation?.migration_sources ? {migration_sources: previous.participation.migration_sources} : {})} as typeof merged.participation;
  if (merged.type === "seleccion") merged.selection = {...previous?.selection, ...input.selection, ...(previous?.selection?.migration_sources ? {migration_sources: previous.selection.migration_sources} : {})} as typeof merged.selection;
  const validated = newsFromBody(campusTitle(merged, await campusNames()));
  if (!validated) throw new Error("Completa los campos obligatorios del registro.");
  const record: PlayerNews = { ...validated, ...(imageUpdatedAt ? {image_source: "custom" as const} : {}), type: validated.type ?? previous?.type ?? "noticia", id: validated.id ?? randomUUID(), published: validated.published ?? previous?.published ?? false, image_updated_at: imageUpdatedAt ?? previous?.image_updated_at ?? null, updated_at: new Date().toISOString() };
  await mkdir(directory(), { recursive: true });
  const target = path.join(directory(), record.id + ".json");
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(record, null, 2) + "\n", "utf8");
  await rename(temporary, target);
  return record;
}

export async function newsWithImage(record: PlayerNews): Promise<PlayerNews> {
  if (record.type === "participacion" && record.participation?.kind === "campus") {
    const image = await participationImageById(record.participation.campus_id || "CAM001");
    return {...record, image_url: image.image_url || "/ctrugby-player-logo.png", image_updated_at: image.image_updated_at};
  }
  if (record.type === "participacion") {const image = await participationCategoryImage(record.participation?.category || "");return {...record, image_url: image.image_url || undefined, image_updated_at: image.image_updated_at};}
  const federationImage = (): PlayerNews => record.type === "seleccion" && record.selection?.federation_id && /^(FN|FT)\d{3}$/.test(record.selection.federation_id) ? {...record, image_source: "federation", image_url: callupDefaultImage(record.selection.federation_id, record.selection.format), image_updated_at: "federation-" + record.selection.federation_id + "-" + record.selection.format} : record;
  if (record.type === "seleccion" && record.image_source === "federation") return federationImage();
  if (!validNewsId(record.id)) return record;
  try {
    const filename = path.join(process.cwd(), "data", "staging", "player-news-images", record.id + ".webp");
    await access(filename);
    const updatedAt = record.image_updated_at ?? record.updated_at;
    return { ...record, image_source: "custom", image_updated_at: updatedAt, image_url: `/api/noticias/${record.id}/imagen?v=${encodeURIComponent(updatedAt)}` };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return federationImage(); throw error; }
}
