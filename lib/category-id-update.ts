import { readFile, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProfessionalCategory } from "./professional-club-milestones";

export class CategoryIdError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

// Serialize category updates so two edits cannot claim the same identifier.
let pending: Promise<unknown> = Promise.resolve();
export function updateCategoryId(previousId: string, updated: ProfessionalCategory) {
  const operation = pending.catch(() => undefined).then(() => update(previousId, updated));
  pending = operation;
  return operation;
}
async function update(previousId: string, updated: ProfessionalCategory) {
  if (!/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(updated.id)) throw new CategoryIdError("El ID debe contener entre 1 y 40 letras mayúsculas, números o guiones.", 400);
  // Keep these paths statically scoped.  A caller-provided project root makes
  // Next trace the complete repository when this admin route is bundled.
  const staging = path.join(process.cwd(), "data", "staging");
  const catalog = path.join(staging, "professional-categories.json");
  const original = await readFile(catalog);
  const categories = JSON.parse(original.toString()) as ProfessionalCategory[];
  const previous = categories.find(item => item.id === previousId);
  if (!previous) throw new CategoryIdError("La categoría ya no existe. Recarga la tabla.");
  if (previousId !== updated.id && categories.some(item => item.id === updated.id)) throw new CategoryIdError("Este ID ya pertenece a otra categoría.");
  const changes: {file: string; before: Buffer | null; after: Buffer | null}[] = [];
  if (previousId !== updated.id) {
    // News and participations are stored centrally.  Legacy JSON files are no
    // longer rewritten here: scanning them during this route made Vercel trace
    // the whole staging tree into the production bundle.
    const shield = (id: string) => path.join(process.cwd(), "public", "professional-category-shields", id + ".png");
    const oldShield = await optionalRead(shield(previousId));
    if (oldShield) {
      if (await optionalRead(shield(updated.id))) throw new CategoryIdError("El nuevo ID ya tiene un escudo asociado.");
      changes.push({file: shield(updated.id), before: null, after: oldShield}, {file: shield(previousId), before: oldShield, after: null});
    }
  }
  changes.push({file: catalog, before: original, after: Buffer.from(JSON.stringify(categories.map(item => item.id === previousId ? updated : item), null, 2) + "\n")});
  const completed: typeof changes = [];
  try {
    for (const change of changes) { await replace(change.file, change.after); completed.push(change); }
  } catch (error) {
    for (const change of completed.reverse()) await replace(change.file, change.before);
    throw error;
  }
}
async function optionalRead(file: string) {
  return readFile(file).catch(error => { if (error.code === "ENOENT") return null; throw error; });
}
async function replace(file: string, data: Buffer | null) {
  if (data === null) { await unlink(file); return; }
  await mkdir(path.dirname(file), {recursive: true});
  const temporary = file + "." + randomUUID() + ".tmp";
  try { await writeFile(temporary, data); await rename(temporary, file); }
  finally { await unlink(temporary).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}
