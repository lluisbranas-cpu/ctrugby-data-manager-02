import { readPlayerNews } from "./player-news";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

type Callup = { id?: string; federation_id: string; scope?: string | null; category?: string | null; format?: string | null; season_label?: string | null; club_text?: string | null };
export function callupLinkKey(item: Callup) {
  if (item.id) return createHash("sha256").update(JSON.stringify([item.id, item.federation_id])).digest("hex");
  return createHash("sha256").update(JSON.stringify([item.federation_id, item.scope || "", item.category || "", item.format || "XV", item.season_label || "", item.club_text || ""])).digest("hex");
}
export const legacyCallupLinkKey = (item: Callup) => callupLinkKey({...item, id: undefined});
export async function readMilestoneSourceUrls() {
  const filename = path.join(process.cwd(), "data", "staging", "milestone-sources.json");
  const records = JSON.parse(await readFile(filename, "utf8")) as {milestone_id: string; source_url?: string | null}[];
  return new Map([...records.map((item) => [item.milestone_id, validSourceUrl(item.source_url)] as const), ...(await readPlayerNews()).filter(item => item.type === "seleccion" && item.published).map(item => [item.id, validSourceUrl(item.url)] as const)]);
}
export function validSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) return null;
  try { const url = new URL(value.trim()); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; }
}
const file = (playerId: string) => path.join(process.cwd(), "data", "staging", "player-callup-links", playerId + ".json");
export async function readCallupLinks(playerId: string): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(file(playerId), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
const writes = new Map<string, Promise<void>>();
export async function saveCallupLink(playerId: string, key: string, url: string) {
  const operation = (writes.get(playerId) || Promise.resolve()).catch(() => {}).then(async () => {
    const links = await readCallupLinks(playerId);
    links[key] = url;
    const destination = file(playerId);
    await mkdir(path.dirname(destination), {recursive: true});
    const temporary = destination + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(links, null, 2) + "\n", "utf8");
    await rename(temporary, destination);
  });
  writes.set(playerId, operation);
  try { await operation; } finally { if (writes.get(playerId) === operation) writes.delete(playerId); }
}
