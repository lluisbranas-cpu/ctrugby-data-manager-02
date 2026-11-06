import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
type Career = { retired: boolean; staff_id: string | null; summary?: string; source_url?: string };
const root = () => path.join(process.cwd(), "data", "staging");
const filename = (id: string) => {
  if (!/^JUG\d{4}$/.test(id)) throw new Error("Jugador no válido");
  return path.join(root(), "player-careers", id + ".json");
};
export async function readPlayerCareer(id: string): Promise<Career> {
  try { return JSON.parse(await readFile(filename(id), "utf8")) as Career; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const profiles = JSON.parse(await readFile(path.join(root(), "staff-ctrugby-profiles.json"), "utf8")) as { staff_id: string; links?: { kind: string; url: string }[] }[];
  return { retired: false, staff_id: profiles.find(p => p.links?.some(l => l.kind === "player" && l.url === "/jugadores/" + id))?.staff_id ?? null };
}
export async function readStaffOptions() {
  const staff = JSON.parse(await readFile(path.join(root(), "staff.json"), "utf8")) as { id: string; first_name: string; last_name?: string }[];
  return staff.map(p => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(" ") })).sort((a,b) => a.name.localeCompare(b.name, "es"));
}
export async function savePlayerCareer(id: string, career: Career) {
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify({ ...await readPlayerCareer(id), ...career }, null, 2) + "\n", "utf8");
  await rename(temporary, target);
}

export async function playerCareerLinks() {
  const directory = path.join(root(), "player-careers");
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return Promise.all(files.filter(file => /^JUG\d{4}\.json$/.test(file)).map(async file => ({
    player_id: file.slice(0, -5),
    ...JSON.parse(await readFile(path.join(directory, file), "utf8")) as Career,
  })));
}
