import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const filename = (id: string) => {
  if (!/^JUG\d{4}$/.test(id)) throw new Error("Jugador no válido");
  return path.join(process.cwd(), "data", "staging", "player-nicknames", `${id}.json`);
};
export async function readPlayerNickname(id: string): Promise<string | null> {
  try {
    const data = JSON.parse(await readFile(filename(id), "utf8"));
    return typeof data.nickname === "string" ? data.nickname : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
export async function savePlayerNickname(id: string, nickname: string | null) {
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ nickname }, null, 2) + "\n", "utf8");
  await rename(temporary, target);
}