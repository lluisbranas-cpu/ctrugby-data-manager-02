import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlayerTitle } from "@/lib/player-titles";

export type NewPlayerTitle = { id: string; title: string; year: number; competition: string; result: string; player_ids: string[] }
  & Pick<PlayerTitle, "date" | "source_name" | "source_url" | "staff_ids" | "team" | "unlinked_participants">;

export class PlayerTitleConflictError extends Error {}
export class PlayerTitleNotFoundError extends Error {}

const filePath = () => path.join(process.cwd(), "data", "staging", "player-titles.json");
let titleWrites: Promise<void> = Promise.resolve();

function isPlayerTitle(value: unknown): value is PlayerTitle {
  if (!value || typeof value !== "object") return false;
  const title = value as Record<string, unknown>;
  const playerIds = title.player_ids;
  const staffIds = title.staff_ids ?? [];
  const unlinkedParticipants = title.unlinked_participants ?? [];
  return typeof title.id === "string"
    && typeof title.title === "string"
    && typeof title.year === "number"
    && Number.isInteger(title.year)
    && typeof title.competition === "string"
    && typeof title.result === "string"
    && Array.isArray(playerIds)
    && playerIds.every((id) => typeof id === "string" && /^JUG\d{4}$/.test(id))
    && Array.isArray(staffIds)
    && staffIds.every((id) => typeof id === "string" && /^STF\d{4}$/.test(id))
    && Array.isArray(unlinkedParticipants)
    && unlinkedParticipants.every((name) => typeof name === "string" && name.trim().length > 0)
    && playerIds.length + staffIds.length + unlinkedParticipants.length > 0
    && (title.image_key === undefined || typeof title.image_key === "string" && /^[a-f0-9-]{36}$/i.test(title.image_key))
    && (title.image_updated_at === undefined || title.image_updated_at === null || typeof title.image_updated_at === "string");
}

export async function readPlayerTitles(): Promise<PlayerTitle[]> {
  const data: unknown = JSON.parse(await readFile(filePath(), "utf8"));
  if (!Array.isArray(data) || !data.every(isPlayerTitle)) throw new Error("El catálogo de títulos tiene un formato no válido.");
  const ids = data.map((title) => title.id.toLocaleLowerCase("en"));
  if (new Set(ids).size !== ids.length) throw new Error("El catálogo de títulos contiene IDs duplicados.");
  return data;
}

export function createPlayerTitle(input: NewPlayerTitle): Promise<{ title: PlayerTitle; titles: PlayerTitle[] }> {
  const operation = titleWrites.catch(() => undefined).then(async () => {
    const titles = await readPlayerTitles();
    assertUniqueTitle(titles, input);

    const title: PlayerTitle = {
      ...input,
      player_ids: [...new Set(input.player_ids)],
      staff_ids: [...new Set(input.staff_ids ?? [])],
      unlinked_participants: [...new Set(input.unlinked_participants ?? [])],
    };
    const updatedTitles = sortTitles([...titles, title]);
    await writeTitles(updatedTitles);
    return { title, titles: updatedTitles };
  });
  titleWrites = operation.then(() => undefined, () => undefined);
  return operation;
}

export function updatePlayerTitleImageMetadata(id: string, updatedAt: string | null, imageKey?: string): Promise<{ title: PlayerTitle; titles: PlayerTitle[] }> {
  const operation = titleWrites.catch(() => undefined).then(async () => {
    const titles = await readPlayerTitles();
    const original = titles.find((title) => title.id === id);
    if (!original) throw new PlayerTitleNotFoundError("No se ha encontrado el título.");
    const title: PlayerTitle = {
      ...original,
      image_key: updatedAt ? imageKey ?? original.image_key ?? randomUUID() : original.image_key,
      image_updated_at: updatedAt,
    };
    const updatedTitles = titles.map((current) => current.id === id ? title : current);
    await writeTitles(updatedTitles);
    return { title, titles: updatedTitles };
  });
  titleWrites = operation.then(() => undefined, () => undefined);
  return operation;
}

export function updatePlayerTitle(originalId: string, input: NewPlayerTitle): Promise<{ title: PlayerTitle; titles: PlayerTitle[] }> {
  const operation = titleWrites.catch(() => undefined).then(async () => {
    const titles = await readPlayerTitles();
    const original = titles.find((title) => title.id === originalId);
    if (!original) throw new PlayerTitleNotFoundError("No se ha encontrado el título que quieres editar.");
    assertUniqueTitle(titles, input, originalId);

    const title: PlayerTitle = {
      ...original,
      ...input,
      player_ids: [...new Set(input.player_ids)],
      staff_ids: [...new Set(input.staff_ids ?? [])],
      unlinked_participants: [...new Set(input.unlinked_participants ?? [])],
    };
    const updatedTitles = sortTitles(titles.map((current) => current.id === originalId ? title : current));
    await writeTitles(updatedTitles);
    return { title, titles: updatedTitles };
  });
  titleWrites = operation.then(() => undefined, () => undefined);
  return operation;
}

export function deletePlayerTitle(id: string): Promise<{ title: PlayerTitle; titles: PlayerTitle[] }> {
  const operation = titleWrites.catch(() => undefined).then(async () => {
    const titles = await readPlayerTitles();
    const title = titles.find((current) => current.id === id);
    if (!title) throw new PlayerTitleNotFoundError("No se ha encontrado el título.");
    const updatedTitles = titles.filter((current) => current.id !== id);
    await writeTitles(updatedTitles);
    return { title, titles: updatedTitles };
  });
  titleWrites = operation.then(() => undefined, () => undefined);
  return operation;
}

function assertUniqueTitle(titles: PlayerTitle[], input: NewPlayerTitle, ignoreId?: string) {
  const otherTitles = titles.filter((title) => title.id !== ignoreId);
  if (otherTitles.some((title) => title.id.toLocaleLowerCase("en") === input.id.toLocaleLowerCase("en"))) {
    throw new PlayerTitleConflictError("Ese ID-Título ya está registrado.");
  }
  const duplicateTitle = otherTitles.some((title) => title.year === input.year
    && title.title?.trim().toLocaleLowerCase("es") === input.title.trim().toLocaleLowerCase("es")
    && title.competition?.trim().toLocaleLowerCase("es") === input.competition.trim().toLocaleLowerCase("es")
    && title.result?.trim().toLocaleLowerCase("es") === input.result.trim().toLocaleLowerCase("es"));
  if (duplicateTitle) throw new PlayerTitleConflictError("Ese título ya está registrado para el mismo año, competición y resultado.");
}

function sortTitles(titles: PlayerTitle[]) {
  return titles.sort((left, right) => (right.year ?? right.edition ?? 0) - (left.year ?? left.edition ?? 0));
}

async function writeTitles(updatedTitles: PlayerTitle[]) {
    const target = filePath();
    await mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(updatedTitles, null, 2)}\n`, "utf8");
    await rename(temporary, target);
}
