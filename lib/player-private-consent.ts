import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export type PlayerPrivateConsentKind = "food" | "medical" | "technical";
export type PlayerPrivateConsents = Record<PlayerPrivateConsentKind, boolean>;
const empty = (): PlayerPrivateConsents => ({ food: false, medical: false, technical: false });

const filename = (id: string) => {
  if (!/^JUG[0-9]+$/.test(id)) throw new Error("Jugador no válido");
  return path.join(process.cwd(), "data", "staging", "player-private-consents", `${id}.json`);
};

export async function readPlayerPrivateConsents(id: string): Promise<PlayerPrivateConsents> {
  try {
    const value = JSON.parse(await readFile(filename(id), "utf8")) as Record<string, unknown>;
    return { food: value.food === true, medical: value.medical === true, technical: value.technical === true || value.technical_data_sharing === true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return empty();
    throw error;
  }
}

export async function savePlayerPrivateConsents(id: string, value: PlayerPrivateConsents) {
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return value;
}
