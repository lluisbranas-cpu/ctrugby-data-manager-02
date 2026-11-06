import { readPlayerNews, readDeletedPlayerNews } from "./player-news";
import { selectionFromBody } from "./news-selection";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type ManualSelectionAction = "include" | "exclude";
export type PlayerReference = { id: string; first_name?: string | null; last_name?: string | null };
export type SelectionRecord = {
  id: string;
  player_id: string;
  player_name: string | null;
  federation_id: string;
  scope: string | null;
  category: string | null;
  format: string | null;
  season_label: string | null;
  club_text: string | null;
  position_text: string | null;
  source: "milestone" | "manual";
  manual_override_id?: string | null;
  notes?: string | null;
};
export type ManualSelectionCallup = {
  source_news_id?: string;
  replaces_ids?: string[];
  replacement_only?: boolean;
  preserve_record?: boolean;
  position_text?: string | null;
  id: string;
  action: ManualSelectionAction;
  player_id: string;
  player_name: string;
  federation_id: string;
  scope: string | null;
  category: string | null;
  format: string | null;
  season_label: string | null;
  club_text: string | null;
  notes: string | null;
  created_at: string;
};

const filePath = () => path.join(process.cwd(), "data", "staging", "manual-selection-callups.json");
const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const nullable = (value: unknown, maximum: number) => clean(value, maximum) || null;
const seasonLabel = (value: unknown) => {
  const text = clean(value, 40);
  const long = text.match(/\b(20\d{2})\D+(20\d{2})\b/);
  if (long) return `${long[1].slice(-2)}-${long[2].slice(-2)}`;
  const short = text.match(/\b(\d{2})\D+(\d{2})\b/);
  return short ? `${short[1]}-${short[2]}` : text || null;
};
const fullName = (player: PlayerReference) => [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
const sameText = (left: string | null | undefined, right: string | null | undefined) =>
  String(left ?? "").trim().toLocaleLowerCase("es-ES") === String(right ?? "").trim().toLocaleLowerCase("es-ES");

export const selectionFederationIds: Record<string, string> = {
  FN003: "FN003",
  FER: "FN003",
  "SELECCIÓN FER": "FN003",
  FN004: "FN004",
  FFR: "FN004",
  "SELECCIÓN FFR": "FN004",
  FT003: "FT003",
  FRPA: "FT003",
  "SELECCIÓN FRPA": "FT003",
  FT009: "FT009",
  FCR: "FT009",
  "SELECCIÓN FCR": "FT009",
  FT010: "FT010",
  FVR: "FT010",
  "SELECCIÓN FVR": "FT010",
  FRCV: "FT010",
  "SELECCIÓN FRCV": "FT010",
  FT015: "FT015",
  FMR: "FT015",
  "SELECCIÓN FMR": "FT015",
  FRM: "FT015",
  "SELECCIÓN FRM": "FT015",
};
const canonicalFederationId = (value: string) => selectionFederationIds[value.toUpperCase()] ?? value.toUpperCase();

export async function readManualSelectionCallups(): Promise<ManualSelectionCallup[]> {
  const raw = await readFile(filePath(), "utf8").catch(() => "[]");
  const local = (JSON.parse(raw) as ManualSelectionCallup[]).map((record) => ({
    ...record,
    action: (record.action === "exclude" ? "exclude" : "include") as ManualSelectionAction,
    federation_id: canonicalFederationId(record.federation_id),
    scope: record.scope ?? null,
    category: record.category ?? null,
    format: record.format || "XV",
    season_label: record.season_label ?? null,
    club_text: record.club_text ?? null,
    notes: record.notes ?? null,
  }));
  const news = [...await readPlayerNews(), ...(await readDeletedPlayerNews()).map(record => ({...record, published: false}))].filter(record => record.type === "seleccion");
  const migratedIds = new Set(news.flatMap(record => record.selection?.migration_sources?.map(source => String(source.record.id)) ?? []));
  const fromNews: ManualSelectionCallup[] = news.filter(record => record.published || record.selection?.migration_sources?.length).flatMap((record): ManualSelectionCallup[] => {
    const selection = selectionFromBody(record.selection); if (!selection) return [];
    return [{id: record.id, source_news_id: record.id, replaces_ids: selection.migration_sources?.map(source => String(source.record.id)), replacement_only: !record.published, preserve_record: selection.migration_sources?.some(source => source.kind === "selection-milestone"), action: "include", player_id: record.player_id, player_name: selection.player_name || record.player_id, federation_id: selection.federation_id, scope: selection.scope !== undefined ? selection.scope : selection.federation_id.startsWith("FN") ? "Nacional" : "Territorial", category: selection.category || null, format: selection.format, season_label: selection.season_label !== undefined ? selection.season_label : record.date_or_season || null, club_text: selection.club_text ?? null, position_text: selection.position_text ?? null, notes: selection.notes !== undefined ? selection.notes : [record.title, selection.event].filter(Boolean).join(" · "), created_at: selection.created_at || record.updated_at}];
  });
  return [...local.filter(record => !migratedIds.has(record.id)), ...fromNews];
}

export async function saveManualSelectionCallups(records: ManualSelectionCallup[]) {
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(records.filter(record => !record.source_news_id), null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export function manualSelectionCallupFromBody(body: Record<string, unknown>, players: PlayerReference[]) {
  const playerId = clean(body.player_id, 7).toUpperCase();
  const federationId = canonicalFederationId(clean(body.federation_id, 12));
  const action = body.action === "exclude" ? "exclude" : "include";
  if (!/^JUG[0-9]{4}$/.test(playerId) || !federationId) return null;
  const player = players.find((item) => item.id === playerId);
  const playerName = clean(body.player_name, 180) || (player ? fullName(player) : playerId);
  return {
    id: `SEL-${Date.now()}-${randomUUID().slice(0, 8)}`,
    action,
    player_id: playerId,
    player_name: playerName,
    federation_id: federationId,
    scope: nullable(body.scope, 80),
    category: nullable(body.category, 100),
    format: nullable(body.format, 12) || "XV",
    season_label: seasonLabel(body.season_label),
    club_text: nullable(body.club_text, 160),
    notes: nullable(body.notes, 240),
    created_at: new Date().toISOString(),
  } satisfies ManualSelectionCallup;
}

export function selectionRecordKey(record: Pick<SelectionRecord, "player_id" | "federation_id" | "scope" | "season_label" | "category" | "format" | "club_text" | "notes">) {
  return [record.player_id, record.federation_id, record.scope ?? "", record.season_label ?? "", record.category ?? "", record.format ?? "", record.club_text ?? "", record.notes ?? ""].map((item) => item.toLocaleLowerCase("es-ES")).join("|");
}

export function manualCallupMatchesRecord(callup: ManualSelectionCallup, record: SelectionRecord) {
  if (callup.player_id !== record.player_id || callup.federation_id !== record.federation_id) return false;
  if (callup.season_label && !sameText(callup.season_label, record.season_label)) return false;
  if (callup.category && !sameText(callup.category, record.category)) return false;
  if (callup.format && !sameText(callup.format, record.format)) return false;
  return true;
}

export function applyManualSelectionCallups(records: SelectionRecord[], callups: ManualSelectionCallup[]) {
  const replaced = new Set(callups.flatMap(callup => callup.replaces_ids ?? []));
  records = records.filter(record => !replaced.has(record.id));
  callups = callups.filter(callup => !callup.replacement_only);
  const exclusions = callups.filter((callup) => callup.action === "exclude");
  const included = records.filter((record) => !exclusions.some((callup) => manualCallupMatchesRecord(callup, record)));
  const known = new Set(included.map(selectionRecordKey));
  for (const callup of callups.filter((item) => item.action === "include")) {
    const record: SelectionRecord = {
      id: callup.id,
      player_id: callup.player_id,
      player_name: callup.player_name,
      federation_id: callup.federation_id,
      scope: callup.scope,
      category: callup.category,
      format: callup.format || "XV",
      season_label: callup.season_label,
      club_text: callup.club_text,
      position_text: callup.position_text ?? null,
      source: "manual",
      manual_override_id: callup.id,
      notes: callup.notes,
    };
    const key = selectionRecordKey(record);
    if (callup.preserve_record || !known.has(key)) {
      included.push(record);
      known.add(key);
    }
  }
  return included;
}
