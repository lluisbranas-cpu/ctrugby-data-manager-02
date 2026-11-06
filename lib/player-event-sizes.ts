import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type PlayerEventSizes = { technical_shirt: string; playing_shirt: string; playing_shorts: string; bermudas: string };
export const emptyPlayerEventSizes = (): PlayerEventSizes => ({ technical_shirt: "", playing_shirt: "", playing_shorts: "", bermudas: "" });

const filename = (id: string) => {
  if (!/^JUG[0-9]+$/.test(id)) throw new Error("Jugador no válido");
  return path.join(process.cwd(), "data", "staging", "player-event-sizes", `${id}.json`);
};

export function parsePlayerEventSizes(value: unknown): PlayerEventSizes | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const sizes = emptyPlayerEventSizes();
  for (const field of Object.keys(sizes) as (keyof PlayerEventSizes)[]) {
    if (typeof raw[field] !== "string" || raw[field].trim().length > 30) return null;
    sizes[field] = raw[field].trim().toUpperCase();
  }
  return sizes;
}

export async function readPlayerEventSizes(id: string): Promise<PlayerEventSizes> {
  try { return parsePlayerEventSizes(JSON.parse(await readFile(filename(id), "utf8"))) ?? emptyPlayerEventSizes(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyPlayerEventSizes(); throw error; }
}

export async function savePlayerEventSizes(id: string, sizes: PlayerEventSizes) {
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(sizes, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return sizes;
}
