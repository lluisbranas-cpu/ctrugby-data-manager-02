import { readFile } from "node:fs/promises";
import path from "node:path";
import { readOperationalDocument } from "./operational-store";
export type ClubHistory = { summary: string; date_note: string; location_note?: string; sources: { title: string; url: string }[] };
export async function readClubHistory(id: string): Promise<ClubHistory | null> {
  try {
    const remote = await readOperationalDocument<Record<string, ClubHistory>>("club", "histories");
    if (remote) return remote.payload[id] ?? null;
    const entries = JSON.parse(await readFile(path.join(process.cwd(), "data/staging/club-histories.json"), "utf8")) as Record<string, ClubHistory>;
    return entries[id] ?? null;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
