import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { billingFields, emptyBilling, type PlayerBilling } from "@/lib/player-billing-types";
export { billingFields, emptyBilling, type PlayerBilling } from "@/lib/player-billing-types";
export function parseBilling(value: unknown): PlayerBilling | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const result = emptyBilling();
  for (const field of billingFields) {
    if (typeof raw[field] !== "string" || (raw[field] as string).length > (field === "address" ? 300 : 160)) return null;
    result[field] = (raw[field] as string).trim();
  }
  return result;
}
const filename = (id: string) => { if (!/^JUG[0-9]+$/.test(id)) throw new Error("Jugador no válido"); return path.join(process.cwd(), "data", "staging", "player-private-billing", id + ".json"); };
export async function readPlayerBilling(id: string): Promise<PlayerBilling> {
  try { return parseBilling({ ...emptyBilling(), ...JSON.parse(await readFile(filename(id), "utf8")) }) ?? emptyBilling(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyBilling(); throw error; }
}
export async function savePlayerBilling(id: string, billing: PlayerBilling) {
  const target = filename(id); await mkdir(path.dirname(target), { recursive: true });
  const temporary = target + "." + randomUUID() + ".tmp";
  await writeFile(temporary, JSON.stringify(billing, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target); return billing;
}
