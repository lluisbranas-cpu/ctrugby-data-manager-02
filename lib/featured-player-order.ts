import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";

const orderPath = () => path.join(process.cwd(), "data", "staging", "featured-player-order.json");

const cleanIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => /^JUG\d{4}$/.test(item)))]
  : [];

export async function readFeaturedPlayerOrder() {
  try {
    return cleanIds(JSON.parse(await readFile(orderPath(), "utf8")));
  } catch {
    return [] as string[];
  }
}

export async function writeFeaturedPlayerOrder(ids: string[]) {
  const clean = cleanIds(ids);
  await mkdir(path.dirname(orderPath()), { recursive: true });
  const temporary = orderPath() + "." + randomUUID() + ".tmp";
  await writeFile(temporary, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
  await rename(temporary, orderPath());
  return clean;
}

export function featuredOrderIndex(ids: string[]) {
  return new Map(ids.map((id, index) => [id, index]));
}
