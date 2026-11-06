import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
export type HitoPublication = Record<string, boolean>;
const filename = () => path.join(process.cwd(), "data", "staging", "hito-publication.json");
export async function readHitoPublication(): Promise<HitoPublication> {
  try { return JSON.parse(await readFile(filename(), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return {}; throw error; }
}
export const isHitoPublished = (state: HitoPublication, id: string) => state[id] !== false;
let queue: Promise<void> = Promise.resolve();
export async function saveHitoPublication(id: string, published: boolean) {
  const operation = queue.catch(() => {}).then(async () => {
    const state = await readHitoPublication(); state[id] = published;
    const target = filename(); await mkdir(path.dirname(target), {recursive: true});
    const temporary = target + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", "utf8"); await rename(temporary, target);
  });
  queue = operation; await operation;
}
