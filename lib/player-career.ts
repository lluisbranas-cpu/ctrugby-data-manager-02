import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogServiceClient } from "@/lib/catalog";
import { readOperationalDocument, upsertOperationalDocument } from "@/lib/operational-store";
type Career = { retired: boolean; staff_id: string | null; summary?: string; source_url?: string };
const root = () => path.join(process.cwd(), "data", "staging");
const filename = (id: string) => {
  if (!/^JUG\d{4}$/.test(id)) throw new Error("Jugador no válido");
  return path.join(root(), "player-careers", id + ".json");
};
export async function readPlayerCareer(id: string): Promise<Career> {
  const remote = await readOperationalDocument<unknown>("player-career", id).catch(() => null);
  if (remote?.payload && typeof remote.payload === "object" && !Array.isArray(remote.payload)) return remote.payload as Career;
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
  const next = { ...await readPlayerCareer(id), ...career };
  await upsertOperationalDocument("player-career", id, next);
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(next, null, 2) + "\n", "utf8");
  await rename(temporary, target);
}

export async function playerCareerLinks() {
  let remote: { data: { document_key: string; payload: unknown }[] | null } = { data: null };
  try {
    remote = await catalogServiceClient().schema("app_private").from("operational_documents")
      .select("document_key,payload").eq("namespace", "player-career").limit(10000);
  } catch { /* El respaldo local conserva compatibilidad durante la transición. */ }
  const shared = (remote.data ?? []).flatMap((row: { document_key: string; payload: unknown }) => /^JUG\d{4}$/.test(row.document_key) && row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? [{ player_id: row.document_key, ...row.payload as Career }] : []);
  if (shared.length) return shared;
  const directory = path.join(root(), "player-careers");
  let files: string[];
  try { files = await readdir(directory); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return Promise.all(files.filter(file => /^JUG\d{4}\.json$/.test(file)).map(async file => ({
    player_id: file.slice(0, -5),
    ...JSON.parse(await readFile(path.join(directory, file), "utf8")) as Career,
  })));
}
