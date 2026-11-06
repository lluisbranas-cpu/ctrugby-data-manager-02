import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type PlayerProfileOverride = {
  category: string | null;
  birth_year: number | null;
  birth_date?: string | null;
  instagram: string | null;
  dni: string | null;
  allergies: string | null;
  dietary_conditions: string | null;
  medications: string | null;
};

const filename = (id: string) => path.join(process.cwd(), "data", "staging", "player-profiles", `${id}.json`);

export async function readPlayerProfileOverride(id: string): Promise<PlayerProfileOverride | null> {
  try {
    const data = JSON.parse(await readFile(filename(id), "utf8")) as Partial<PlayerProfileOverride>;
    return {
      birth_date: typeof data.birth_date === "string" ? data.birth_date : null,
      category: data.category === "M" || data.category === "F" ? data.category : null,
      birth_year: typeof data.birth_year === "number" && Number.isInteger(data.birth_year) ? data.birth_year : null,
      instagram: typeof data.instagram === "string" && data.instagram ? data.instagram : null,
      dni: typeof data.dni === "string" && data.dni ? data.dni : null,
      allergies: typeof data.allergies === "string" && data.allergies ? data.allergies : null,
      dietary_conditions: typeof data.dietary_conditions === "string" && data.dietary_conditions ? data.dietary_conditions : null,
      medications: typeof data.medications === "string" && data.medications ? data.medications : null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function savePlayerProfileOverride(id: string, profile: PlayerProfileOverride) {
  const target = filename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  await rename(temporary, target);
  return profile;
}
