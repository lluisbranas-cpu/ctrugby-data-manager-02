import { readFile } from "node:fs/promises";
import path from "node:path";
import type { catalogClient } from "./catalog";

export type NewsSelection = {federation_id: string; category: string; format: "XV" | "7s"; gender: "masculino" | "femenino" | "mixto" | ""; event: string; scope?: string | null; season_label?: string | null; club_text?: string | null; position_text?: string | null; notes?: string | null; player_name?: string | null; created_at?: string | null; migration_sources?: {kind: string; record: Record<string, unknown>}[]};
export type NewsFederation = {id: string; name: string; scope: string | null; active?: boolean};
export function selectionFromBody(value: unknown): NewsSelection | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.federation_id !== "string" || !/^(?:FN|FT)\d{3}$/.test(data.federation_id)) return null;
  if (typeof data.category !== "string" || data.category.length > 100) return null;
  if (data.format !== "XV" && data.format !== "7s") return null;
  if (!["masculino", "femenino", "mixto", ""].includes(String(data.gender))) return null;
  if (data.event !== undefined && (typeof data.event !== "string" || data.event.length > 240)) return null;
  const extra: Partial<NewsSelection> = {};
  for (const field of ["scope", "season_label", "club_text", "position_text", "notes", "player_name", "created_at"] as const) {
    if (data[field] !== undefined) {if (data[field] !== null && (typeof data[field] !== "string" || data[field].length > (field === "notes" ? 2000 : 240))) return null; extra[field] = data[field] as string | null;}
  }
  if (Array.isArray(data.migration_sources)) extra.migration_sources = data.migration_sources.filter((item): item is {kind: string; record: Record<string, unknown>} => !!item && typeof item === "object" && typeof item.kind === "string" && !!item.record && typeof item.record === "object");
  return {...extra, federation_id: data.federation_id, category: data.category.trim(), format: data.format, gender: data.gender as NewsSelection["gender"], event: typeof data.event === "string" ? data.event.trim() : ""};
}
export async function newsFederations(db: ReturnType<typeof catalogClient>): Promise<NewsFederation[]> {
  const raw = await readFile(path.join(process.cwd(), "data", "staging", "federations.json"), "utf8");
  const local = JSON.parse(raw) as NewsFederation[];
  const result = await db.from("catalog_federations").select("id,name,scope,active").order("name");
  const records = new Map(local.map(item => [item.id, item]));
  if (!result.error) for (const item of result.data ?? []) records.set(item.id, item);
  return [...records.values()].filter(item => item.id && item.name).sort((a,b) => a.name.localeCompare(b.name,"es"));
}
