import { readFile, readdir, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { ProfessionalCategory } from "./professional-club-milestones";

export class CategoryIdError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}

// Serialize category updates so two edits cannot claim the same identifier.
let pending: Promise<unknown> = Promise.resolve();
export function updateCategoryId(previousId: string, updated: ProfessionalCategory, root = process.cwd()) {
  const operation = pending.catch(() => undefined).then(() => update(previousId, updated, root));
  pending = operation;
  return operation;
}
async function update(previousId: string, updated: ProfessionalCategory, root: string) {
  if (!/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(updated.id)) throw new CategoryIdError("El ID debe contener entre 1 y 40 letras mayúsculas, números o guiones.", 400);
  const catalog = path.join(root, "data/staging/professional-categories.json");
  const original = await readFile(catalog);
  const categories = JSON.parse(original.toString()) as ProfessionalCategory[];
  const previous = categories.find(item => item.id === previousId);
  if (!previous) throw new CategoryIdError("La categoría ya no existe. Recarga la tabla.");
  if (previousId !== updated.id && categories.some(item => item.id === updated.id)) throw new CategoryIdError("Este ID ya pertenece a otra categoría.");
  const changes: {file: string; before: Buffer | null; after: Buffer | null}[] = [];
  if (previousId !== updated.id) {
    for (const directory of ["data/staging/player-news", "data/staging/player-news-deleted"]) {
      const dir = path.join(root, directory);
      const files = await readdir(dir).catch(error => { if (error.code === "ENOENT") return []; throw error; });
      for (const file of files.filter(file => file.endsWith(".json"))) {
        const filename = path.join(dir, file), before = await readFile(filename);
        const record = JSON.parse(before.toString());
        if (record.participation?.campus_id !== previousId) continue;
        record.participation.campus_id = updated.id;
        record.updated_at = updated.updated_at;
        changes.push({file: filename, before, after: Buffer.from(JSON.stringify(record, null, 2) + "\n")});
      }
    }
    const shield = (id: string) => path.join(root, "public/professional-category-shields", id + ".png");
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
