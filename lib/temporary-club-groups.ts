import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export type TemporaryClubGroup = { id: string; club_id?: string; name: string; season: string; category: string; club_ids: string[]; version: number };
const target = () => path.join(process.cwd(), "data/staging/temporary-club-groups.json");
export async function readTemporaryClubGroups(): Promise<TemporaryClubGroup[]> {
  try { return (JSON.parse(await readFile(target(), "utf8")) as TemporaryClubGroup[]).map(row => ({ ...row, season: row.season.replace(/^(\d{2})(\d{2})\/(?:\d{2})?(\d{2})$/, "$2/$3") })); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}
let pending: Promise<unknown> = Promise.resolve();
export function changeTemporaryClubGroups(change: (rows: TemporaryClubGroup[]) => TemporaryClubGroup[] | Promise<TemporaryClubGroup[]>) {
  const operation = pending.then(async () => {
    const rows = await change(await readTemporaryClubGroups());
    await mkdir(path.dirname(target()), { recursive: true });
    const temporary = `${target()}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify(rows, null, 2) + "\n", "utf8");
    await rename(temporary, target());
  });
  pending = operation.catch(() => undefined);
  return operation;
}
export function validateTemporaryClubGroup(body: Record<string, unknown>, knownClubIds: Set<string>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const season = typeof body.season === "string" ? body.season.trim().replace(/\s+/g, "").replace(/[–—-]/g, "/") : "";
  const match = /^(\d{2}|\d{4})\/(\d{2}|\d{4})$/.exec(season);
  const nextYear = match ? Number(match[1]) + 1 : 0;
  if (!name || name.length > 160 || !category || category.length > 80) throw new Error("Completa el nombre y la categoría (máximo 160 y 80 caracteres).");
  if (!match || (match[1].length === 4 && (Number(match[1]) < 1900 || Number(match[1]) > 2200)) || Number(match[2]) !== (match[2].length === 2 ? nextYear % 100 : nextYear)) throw new Error("Indica una temporada válida, en formato YY/YY, por ejemplo 26/27.");
  if (!Array.isArray(body.club_ids) || body.club_ids.some(id => typeof id !== "string" || !knownClubIds.has(id))) throw new Error("Selecciona clubes del catálogo.");
  const club_ids = [...new Set(body.club_ids as string[])];
  if (club_ids.length < 2) throw new Error("Selecciona al menos dos clubes adscritos.");
  return { name, category, season: `${match[1].slice(-2)}/${String(nextYear % 100).padStart(2, "0")}`, club_ids };
}
