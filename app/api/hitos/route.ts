import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
import { resolveMilestoneClubId } from "@/lib/milestone-trajectory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Participant = { id: string; kind: "player" | "staff"; display_name: string; player_id: string | null; staff_id: string | null };
type Milestone = { id: string; participant_id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null; image_key?: string | null };
type Source = {
  milestone_id: string;
  source_type: string;
  source_ctr_id: string | null;
  source_name: string;
  source_url?: string | null;
  source_photo_url?: string | null;
  source_captured_at?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
};
type Club = { id: string; name: string; country?: string | null };
type Row = Milestone & { participant?: Participant | null; source?: Source | null };

const CATALOG_ROW_LIMIT = 10000;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const yearsFromLabel = (label: string | null | undefined) => [...new Set(String(label ?? "").match(/20\d{2}/g) ?? [])].map(Number);
const latestYear = (label: string | null | undefined) => Math.max(0, ...yearsFromLabel(label));
const scopeKind = (scope: string | null | undefined) => String(scope ?? "").startsWith("FN") ? "national" : "regional";
const normalize = (value: string | null | undefined) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const foreignClubSignals = [
  "act brumbies", "ealing trailfinders", "fcg amazones", "harlequins", "montpellier", "niort rugby", "pau rugby",
  "rugby club toulonnais", "sale sharks", "stade bourdelais", "stade francais", "stade montois", "stade nicois",
  "stade rennais", "stade toulousain", "usap", "perpignan", "vpc andorra",
];

function isForeignClub(clubText: string | null | undefined, club: Club | undefined) {
  if (club?.country && club.country !== "España") return true;
  const key = normalize(clubText);
  return Boolean(key) && foreignClubSignals.some((signal) => key.includes(signal));
}

function shape(rows: Row[], admin: boolean, configured: boolean, clubs: Club[] = [], origin = "") {
  const clubsById = new Map(clubs.map((club) => [club.id, club]));
  const milestones = rows.filter(row => row.participant ? row.participant.kind === "staff" : row.source?.source_type === "staff").map((row) => {
    const clubId = resolveMilestoneClubId(row.club_text, clubs);
    const club = clubId ? clubsById.get(clubId) : undefined;
    const international = isForeignClub(row.club_text, club);
    return {
      id: row.id,
      participant_id: row.participant_id,
      participant_name: row.participant?.display_name ?? row.source?.source_name ?? "Participante",
      participant_kind: "staff",
      player_id: row.participant?.player_id ?? (row.source?.source_type === "player" ? row.source.source_ctr_id : null),
      staff_id: row.participant?.staff_id ?? (row.source?.source_type === "staff" ? row.source.source_ctr_id : null),
      scope: row.scope,
      scope_kind: scopeKind(row.scope),
      category: row.category,
      season_label: row.season_label,
      club_text: row.club_text,
      club_id: clubId,
      club_country: club?.country ?? (international ? "Internacional" : null),
      international,
      position_text: row.position_text,
      latest_year: latestYear(row.season_label),
      image_key: row.image_key ?? null,
      source_name: row.source?.source_name ?? null,
      source_type: row.source?.source_type ?? null,
      source_ctr_id: row.source?.source_ctr_id ?? null,
      source_url: row.source?.source_url ?? null,
      source_photo_url: row.source?.source_photo_url ?? null,
      source_captured_at: row.source?.source_captured_at ?? null,
      source_sheet: row.source?.source_sheet ?? null,
      source_row: row.source?.source_row ?? null,
      milestone_url: origin ? `${origin}/hitos?hito=${encodeURIComponent(row.id)}` : `/hitos?hito=${encodeURIComponent(row.id)}`,
    };
  }).sort((a, b) => b.latest_year - a.latest_year || a.participant_name.localeCompare(b.participant_name, "es"));
  const yearSet = new Set(milestones.flatMap((milestone) => yearsFromLabel(milestone.season_label)));
  const playerSet = new Set(milestones.map((milestone) => milestone.player_id).filter(Boolean));
  const staffSet = new Set(milestones.map((milestone) => milestone.staff_id).filter(Boolean));
  const internationalSet = new Set(milestones.filter((milestone) => milestone.international).map((milestone) => milestone.player_id ?? milestone.participant_id));
  return { configured, admin, summary: { milestones: milestones.length, players: playerSet.size, staff: staffSet.size, years: yearSet.size, international_players: internationalSet.size }, years: [...yearSet].sort((a, b) => b - a), milestones };
}

async function localRows(): Promise<Row[]> {
  const base = path.join(process.cwd(), "data", "staging");
  const [milestonesRaw, participantsRaw, sourcesRaw] = await Promise.all([
    readFile(path.join(base, "milestones.json"), "utf8"),
    readFile(path.join(base, "milestone-participants.json"), "utf8"),
    readFile(path.join(base, "milestone-sources.json"), "utf8").catch(() => "[]"),
  ]);
  const participants = new Map((JSON.parse(participantsRaw) as Participant[]).map((participant) => [participant.id, participant]));
  const sources = new Map((JSON.parse(sourcesRaw) as Source[]).map((source) => [source.milestone_id, source]));
  return (JSON.parse(milestonesRaw) as Milestone[]).map((milestone) => ({ ...milestone, participant: participants.get(milestone.participant_id) ?? null, source: sources.get(milestone.id) ?? null }));
}

async function localClubs(): Promise<Club[]> {
  const raw = await readFile(path.join(process.cwd(), "data", "staging", "clubs.json"), "utf8").catch(() => "[]");
  return JSON.parse(raw) as Club[];
}

async function localSources(): Promise<Map<string, Source>> {
  const raw = await readFile(path.join(process.cwd(), "data", "staging", "milestone-sources.json"), "utf8").catch(() => "[]");
  return new Map((JSON.parse(raw) as Source[]).map((source) => [source.milestone_id, source]));
}

async function sourceRows(db: Awaited<ReturnType<typeof catalogAccess>>["db"], admin: boolean) {
  if (!admin) {
    const publicSources = await db.from("catalog_milestone_sources_public").select("milestone_id,source_type,source_ctr_id,source_name,source_url,source_photo_url,source_captured_at,source_sheet,source_row").range(0, CATALOG_ROW_LIMIT - 1);
    return (publicSources.data ?? []) as Source[];
  }
  const extended = await db.schema("app_private").from("milestone_sources").select("milestone_id,source_type,source_ctr_id,source_name,source_url,source_photo_url,source_captured_at,source_sheet,source_row").range(0, CATALOG_ROW_LIMIT - 1);
  if (!extended.error) return (extended.data ?? []) as Source[];
  const basic = await db.schema("app_private").from("milestone_sources").select("milestone_id,source_type,source_ctr_id,source_name").range(0, CATALOG_ROW_LIMIT - 1);
  return (basic.data ?? []) as Source[];
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const origin = request.nextUrl.origin;
    if (!catalogConfigured()) return reply({error: "Acceso de administrador requerido."}, 403);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({error: "Acceso de administrador requerido."}, 403);
    const [milestonesResult, clubsResult, sourcesResult, localSourcesResult] = await Promise.all([
      db.from("catalog_milestones").select("id,participant_id,scope,category,season_label,club_text,position_text,image_key,participant:catalog_participants(id,kind,display_name,player_id,staff_id)").order("season_label", { ascending: false }).range(0, CATALOG_ROW_LIMIT - 1),
      db.from("catalog_clubs").select("id,name,country"),
      sourceRows(db, admin),
      localSources(),
    ]);
    if (milestonesResult.error) return reply(shape(await localRows(), admin, false, await localClubs(), origin));
    const sources = new Map((sourcesResult as Source[]).map((source) => [source.milestone_id, source]));
    const rows = (milestonesResult.data ?? []).map((row) => ({ ...row, participant: Array.isArray(row.participant) ? row.participant[0] : row.participant })) as Row[];
    const rowsWithSources = rows.map((row) => ({ ...row, source: sources.get(row.id) ?? localSourcesResult.get(row.id) ?? null }));
    if (!rows.length && process.env.NODE_ENV !== "production") return reply(shape(await localRows(), admin, false, await localClubs(), origin));
    return reply(shape(rowsWithSources, admin, true, (clubsResult.data ?? []) as Club[], origin));
  } catch {
    return reply({ error: "No se han podido cargar los hitos de staff." }, 503);
  }
}
