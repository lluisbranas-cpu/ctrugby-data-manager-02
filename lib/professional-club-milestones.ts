import { withGroupClubs } from "./temporary-group-clubs";
import { readParticipationRecords } from "./participation-records";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveMilestoneClubId } from "@/lib/milestone-trajectory";

export type ProfessionalClubMilestone = {
  source_news_id?: string;
  id: string;
  player_id: string;
  player_name: string;
  category: string;
  club_name: string;
  club_id: string | null;
  season_label: string | null;
  notes: string | null;
  created_at: string;
};
export type ProfessionalCategory = {
  id: string;
  type: "COMP" | "FORM" | "CAMP";
  label: string;
  siglas?: string | null;
  country: string | null;
  notes: string | null;
  updated_at: string;
};
export type ClubReference = { id: string; name: string; country?: string | null; city?: string | null; province?: string | null; region?: string | null; latitude?: number | null; longitude?: number | null; maps_url?: string | null; active?: boolean | null };
export type PlayerReference = { id: string; first_name?: string | null; last_name?: string | null };

const categoriesPath = () => path.join(process.cwd(), "data", "staging", "professional-categories.json");
const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const acronym = (value: unknown) => clean(value, 16).toUpperCase().replace(/[^A-Z0-9-]+/g, "") || null;
const nullable = (value: unknown, maximum: number) => clean(value, maximum) || null;
const categoryType = (value: unknown): ProfessionalCategory["type"] => {
  const type = clean(value, 8).toUpperCase();
  return type === "FORM" || type === "CAMP" ? type : "COMP";
};
const fullName = (player: PlayerReference) => [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
export const validProfessionalCategoryId = (value: string) => /^[A-Z0-9][A-Z0-9-]{0,39}$/.test(value);
const defaultCategories = (): ProfessionalCategory[] => [
  { id: "CAT001", type: "COMP", label: "DHA", siglas: null, country: "España", notes: "División de Honor A", updated_at: new Date(0).toISOString() },
  { id: "CAT002", type: "COMP", label: "Premiership Women's Rugby", siglas: null, country: "Inglaterra", notes: null, updated_at: new Date(0).toISOString() },
  { id: "CAT003", type: "COMP", label: "Top 14", siglas: null, country: "Francia", notes: null, updated_at: new Date(0).toISOString() },
  { id: "CAT004", type: "COMP", label: "Liga Iberdrola", siglas: null, country: "España", notes: "División de Honor A - Femenino", updated_at: new Date(0).toISOString() },
  { id: "CAT005", type: "COMP", label: "DHB", siglas: null, country: "España", notes: "División de Honor B", updated_at: new Date(0).toISOString() },
  { id: "CAT006", type: "COMP", label: "Élite Italia", siglas: null, country: "Italia", notes: null, updated_at: new Date(0).toISOString() },
];

export async function readLocalPlayers() {
  const raw = await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8").catch(() => "[]");
  return JSON.parse(raw) as PlayerReference[];
}

export async function readLocalClubs() {
  const raw = await readFile(path.join(process.cwd(), "data", "staging", "clubs.json"), "utf8").catch(() => "[]");
  return withGroupClubs(JSON.parse(raw) as ClubReference[]);
}

export async function readProfessionalClubMilestones(includeUnpublished = false) { return readParticipationRecords(includeUnpublished); }

export async function readProfessionalCategories() {
  const raw = await readFile(categoriesPath(), "utf8").catch(() => "");
  if (!raw) return defaultCategories();
  return (JSON.parse(raw) as ProfessionalCategory[]).filter((category) => category.id && category.label).map((category) => ({
    ...category,
    type: categoryType(category.type),
  }));
}

export async function saveProfessionalCategories(categories: ProfessionalCategory[]) {
  const target = categoriesPath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export function shapeProfessionalClubRecord(record: ProfessionalClubMilestone, clubs: ClubReference[]) {
  const clubId = record.club_id ?? resolveMilestoneClubId(record.club_name, clubs);
  return { ...record, club_id: clubId };
}

export function professionalCategoryFromBody(body: Record<string, unknown>) {
  const label = clean(body.label, 80);
  if (!label) return null;
  return {
    id: slug(clean(body.id, 40)) || slug(label) || randomUUID().slice(0, 8).toUpperCase(),
    type: categoryType(body.type),
    label,
    siglas: acronym(body.siglas),
    country: nullable(body.country, 80),
    notes: nullable(body.notes, 180),
    updated_at: new Date().toISOString(),
  } satisfies ProfessionalCategory;
}
