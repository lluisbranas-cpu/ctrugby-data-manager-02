import { readPlayerNews } from "@/lib/player-news";
import { readHitoPublication, isHitoPublished, saveHitoPublication } from "@/lib/hito-publication";
import { callupLinkKey, legacyCallupLinkKey, readCallupLinks, readMilestoneSourceUrls, validSourceUrl } from "@/lib/player-callup-links";
import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, localAdminAccess, sameOrigin } from "@/lib/catalog";
import {
  applyManualSelectionCallups,
  manualSelectionCallupFromBody,
  readManualSelectionCallups,
  saveManualSelectionCallups,
  selectionFederationIds,
  type ManualSelectionCallup,
  type PlayerReference,
  type SelectionRecord,
} from "@/lib/manual-selection-callups";
import { readLocalPlayers, readProfessionalCategories } from "@/lib/professional-club-milestones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Participant = { id: string; kind: "player" | "staff"; display_name: string; player_id: string | null };
type Milestone = { id: string; participant_id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null };
type Federation = { id: string; name: string; scope?: string | null; country?: string | null; territory?: string | null; active?: boolean | null; website?: string | null; published?: boolean | null; version?: number | null };

const CATALOG_ROW_LIMIT = 10000;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const fullName = (player: PlayerReference) => [player.first_name, player.last_name].filter(Boolean).join(" ").trim();
const sameText = (left: string | null | undefined, right: string | null | undefined) => (left ?? "").trim().toLocaleLowerCase("es-ES") === (right ?? "").trim().toLocaleLowerCase("es-ES");
const latestYear = (label: string | null | undefined) => Math.max(0, ...(String(label ?? "").match(/20\d{2}/g) ?? []).map(Number));
const federationFallbacks: Federation[] = [
  { id: "FN003", name: "España", scope: "FER", country: "España" },
  { id: "FN004", name: "Francia", scope: "FFR", country: "Francia" },
  { id: "FT003", name: "Federación de Rugby del Principado de Asturias", scope: "FRPA", territory: "Asturias" },
  { id: "FT009", name: "Catalunya", scope: "FCR", territory: "Catalunya" },
  { id: "FT010", name: "Comunitat Valenciana", scope: "FRCV", territory: "Comunitat Valenciana" },
  { id: "FT015", name: "Madrid", scope: "FRM", territory: "Madrid" },
];
const federationsFilePath = () => path.join(process.cwd(), "data", "staging", "federations.json");

async function accessState(request: NextRequest) {
  if (!catalogConfigured()) {
    const admin = localAdminAccess(request);
    return { configured: false, admin, canWrite: admin };
  }
  const { admin } = await catalogAccess(request);
  return { configured: true, admin, canWrite: admin };
}

async function playerReferences(request: NextRequest) {
  const localPlayers = await readLocalPlayers();
  if (localAdminAccess(request)) return localPlayers;
  if (!catalogConfigured()) throw new Error("El catálogo no está configurado.");
  const { db, admin } = await catalogAccess(request);
  let query = db.from("catalog_players").select("id,first_name,last_name").order("last_name").order("first_name");
  if (!admin) query = query.eq("published", true);
  const catalogPlayers = await query;
  if (catalogPlayers.error) throw new Error("No se han podido comprobar los jugadores publicados.");
  const byId = new Map((admin ? localPlayers : []).map((player) => [player.id, player]));
  for (const player of catalogPlayers.data ?? []) byId.set(player.id, player);
  return [...byId.values()].sort((a, b) => fullName(a).localeCompare(fullName(b), "es") || a.id.localeCompare(b.id, "es"));
}

function mergeFederations(items: Federation[]) {
  const byId = new Map(federationFallbacks.map((federation) => [federation.id, federation]));
  for (const federation of items) byId.set(federation.id, { ...byId.get(federation.id), ...federation });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

async function federationReferences(request: NextRequest) {
  const raw = await readFile(federationsFilePath(), "utf8").catch(() => "[]");
  const local = (JSON.parse(raw) as Federation[]).filter((federation) => federation.id && federation.name);
  if (localAdminAccess(request)) return mergeFederations(local);
  if (!catalogConfigured()) throw new Error("El catálogo no está configurado.");
  const { db, admin } = await catalogAccess(request);
  let query = db.from("catalog_federations").select("id,name,scope,country,territory,active,website,published,version").order("name");
  if (!admin) query = query.eq("published", true);
  const catalogFederations = await query;
  if (catalogFederations.error) throw new Error("No se han podido comprobar las federaciones publicadas.");
  return mergeFederations([...(catalogFederations.data ?? []) as Federation[], ...(admin ? local : [])]);
}

async function saveLocalFederations(records: Federation[]) {
  const target = federationsFilePath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const nullable = (value: unknown, maximum: number) => clean(value, maximum) || null;
const nextFederationId = (scope: string, federations: Federation[]) => {
  const prefix = scope === "Territorial" ? "FT" : "FN";
  const next = Math.max(0, ...federations.map((item) => item.id.match(new RegExp(`^${prefix}(\\d{3})$`))?.[1]).filter(Boolean).map(Number)) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
};
const federationFromBody = (body: Record<string, unknown>, federations: Federation[]) => {
  const scope = body.scope === "Territorial" ? "Territorial" : "Nacional";
  const requestedId = clean(body.id, 5).toUpperCase();
  const id = requestedId || nextFederationId(scope, federations);
  const name = clean(body.name, 160);
  const territory = clean(body.territory, 120);
  const country = clean(body.country, 120);
  const website = nullable(body.website, 500);
  if (!/^F[NT][0-9]{3}$/.test(id) || !name || !territory || !country || (website && !/^https?:\/\//i.test(website))) return null;
  return { id, name, scope, territory, country, active: body.active === false ? false : true, website } satisfies Federation;
};

async function baseSelectionRecords(request: NextRequest, players: PlayerReference[]) {
  const playerNames = new Map(players.map((player) => [player.id, fullName(player) || player.id]));
  if (catalogConfigured()) {
    const { db } = await catalogAccess(request);
    const rows = await db.from("catalog_milestones").select("id,participant_id,scope,category,season_label,club_text,position_text,participant:catalog_participants(id,kind,display_name,player_id)").range(0, CATALOG_ROW_LIMIT - 1);
    if (!rows.error) {
      return ((rows.data ?? []) as (Milestone & { participant?: Participant | Participant[] | null })[])
        .map((row) => {
          const participant = Array.isArray(row.participant) ? row.participant[0] : row.participant;
          const playerId = participant?.player_id ?? null;
          const federationId = row.scope ? selectionFederationIds[row.scope] : null;
          if (!playerId || !federationId) return null;
          return {
            id: row.id,
            player_id: playerId,
            player_name: playerNames.get(playerId) ?? participant?.display_name ?? playerId,
            federation_id: federationId,
            scope: row.scope,
            category: row.category,
            format: "XV",
            season_label: row.season_label,
            club_text: row.club_text,
            position_text: row.position_text,
            source: "milestone",
            manual_override_id: null,
            notes: null,
          } satisfies SelectionRecord;
        })
        .filter(Boolean) as SelectionRecord[];
    }
  }
  const base = path.join(process.cwd(), "data", "staging");
  const [milestonesRaw, participantsRaw] = await Promise.all([
    readFile(path.join(base, "milestones.json"), "utf8"),
    readFile(path.join(base, "milestone-participants.json"), "utf8"),
  ]);
  const participants = new Map((JSON.parse(participantsRaw) as Participant[]).map((participant) => [participant.id, participant]));
  return (JSON.parse(milestonesRaw) as Milestone[])
    .map((milestone) => {
      const participant = participants.get(milestone.participant_id);
      const playerId = participant?.player_id ?? null;
      const federationId = milestone.scope ? selectionFederationIds[milestone.scope] : null;
      if (!playerId || !federationId) return null;
      return {
        id: milestone.id,
        player_id: playerId,
        player_name: playerNames.get(playerId) ?? participant?.display_name ?? playerId,
        federation_id: federationId,
        scope: milestone.scope,
        category: milestone.category,
        format: "XV",
        season_label: milestone.season_label,
        club_text: milestone.club_text,
        position_text: milestone.position_text,
        source: "milestone",
        manual_override_id: null,
        notes: null,
      } satisfies SelectionRecord;
    })
    .filter(Boolean) as SelectionRecord[];
}

const withManualStatus = (records: SelectionRecord[], callups: ManualSelectionCallup[]) =>
  records.map((record) => ({
    ...record,
    excluded: callups.some((callup) => callup.action === "exclude" && callup.player_id === record.player_id && callup.federation_id === record.federation_id && (!callup.season_label || sameText(callup.season_label, record.season_label)) && (!callup.category || sameText(callup.category, record.category))),
  }));

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const [access, players, federations, manual, professionalCategories] = await Promise.all([accessState(request), playerReferences(request), federationReferences(request), readManualSelectionCallups(), readProfessionalCategories()]);
    const baseRows = await baseSelectionRecords(request, players);
    const effective = applyManualSelectionCallups(baseRows, manual);
    const playerIds = [...new Set([...baseRows, ...manual].map((item) => item.player_id))];
    const linksByPlayer = new Map(await Promise.all(playerIds.map(async (id) => [id, await readCallupLinks(id)] as const)));
    const sourceUrls = await readMilestoneSourceUrls();
    const publication = await readHitoPublication();
    const withSource = <T extends Parameters<typeof callupLinkKey>[0] & {id: string; player_id: string}>(record: T) => {
      const source_key = callupLinkKey(record);
      return {...record, published: isHitoPublished(publication, record.id), source_key, source_url: validSourceUrl(linksByPlayer.get(record.player_id)?.[source_key]) || validSourceUrl(linksByPlayer.get(record.player_id)?.[legacyCallupLinkKey(record)]) || sourceUrls.get(record.id) || null};
    };
    return reply({
      ...access,
      players: players.map((player) => ({ id: player.id, name: fullName(player) || player.id })),
      federations: federations.map((federation) => ({ id: federation.id, name: federation.name, scope: federation.scope ?? null, country: federation.country ?? null, territory: federation.territory ?? null, active: federation.active ?? true, website: federation.website ?? null })),
      categories: professionalCategories.map((category) => ({ id: category.id, label: category.label, type: category.type, country: category.country ?? null })),
      manual: manual.filter((item) => !item.replacement_only).filter((item) => access.admin || isHitoPublished(publication, item.id)).map(withSource),
      records: withManualStatus(baseRows, manual).filter((item) => access.admin || isHitoPublished(publication, item.id)).map(withSource).sort((a, b) => Number(a.excluded) - Number(b.excluded) || latestYear(b.season_label) - latestYear(a.season_label) || (a.player_name ?? a.player_id).localeCompare(b.player_name ?? b.player_id, "es")),
      effective_records: effective.filter((item) => access.admin || isHitoPublished(publication, item.id)).map(withSource).sort((a, b) => latestYear(b.season_label) - latestYear(a.season_label) || (a.player_name ?? a.player_id).localeCompare(b.player_name ?? b.player_id, "es")),
    });
  } catch {
    return reply({ error: "No se han podido cargar las convocatorias manuales." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const access = await accessState(request);
    if (!access.canWrite) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id === "string" && (await readPlayerNews()).some(item => item.id === body.id && item.type === "seleccion")) return reply({error: "Este registro se gestiona en la tabla de Noticias y convocatorias."}, 409);
    if (body.action === "set-publication") {
      if (!access.admin) return reply({error: "Acceso de administrador requerido."}, 403);
      if (typeof body.id !== "string" || typeof body.published !== "boolean") return reply({error: "Estado no válido."}, 400);
      const [players, manual] = await Promise.all([playerReferences(request), readManualSelectionCallups()]);
      const baseRecords = await baseSelectionRecords(request, players);
      if (![...baseRecords, ...manual].some((item) => item.id === body.id)) return reply({error: "Hito no encontrado."}, 404);
      await saveHitoPublication(body.id, body.published);
      return reply({ok: true, published: body.published});
    }
    if (body.action === "upsert-federation") {
      const current = await federationReferences(request);
      const record = federationFromBody(body, current);
      if (!record) return reply({ error: "Revisa los datos de la selección." }, 400);
      const originalId = clean(body.original_id, 5).toUpperCase() || record.id;
      const duplicate = current.some((item) => item.id === record.id && item.id !== originalId);
      if (duplicate) return reply({ error: "Ya existe una selección con ese ID." }, 409);
      if (catalogConfigured()) {
        const { db } = await catalogAccess(request);
        const payload = { id: record.id, name: record.name, scope: record.scope, territory: record.territory, country: record.country, active: record.active, website: record.website, published: true, version: 1 };
        const result = originalId === record.id
          ? await db.from("catalog_federations").upsert(payload, { onConflict: "id" }).select("id,name,scope,territory,country,active,website").single()
          : await db.from("catalog_federations").insert(payload).select("id,name,scope,territory,country,active,website").single();
        if (result.error) return reply({ error: "No se ha podido guardar la selección." }, 503);
        return reply({ ok: true, federation: result.data });
      }
      const raw = await readFile(federationsFilePath(), "utf8").catch(() => "[]");
      const local = (JSON.parse(raw) as Federation[]).filter((federation) => federation.id && federation.name);
      await saveLocalFederations([record, ...local.filter((item) => item.id !== originalId && item.id !== record.id)].sort((a, b) => a.id.localeCompare(b.id, "es")));
      return reply({ ok: true, federation: record });
    }
    if (body.action === "delete-federation") {
      const id = clean(body.id, 5).toUpperCase();
      if (!/^F[NT][0-9]{3}$/.test(id)) return reply({ error: "Selección no válida." }, 400);
      const [players, manual] = await Promise.all([playerReferences(request), readManualSelectionCallups()]);
      const baseRows = await baseSelectionRecords(request, players);
      if (manual.some((record) => record.federation_id === id) || baseRows.some((record) => record.federation_id === id)) return reply({ error: "No se puede eliminar una selección con convocatorias asociadas." }, 409);
      if (catalogConfigured()) {
        const { db } = await catalogAccess(request);
        const result = await db.from("catalog_federations").delete().eq("id", id);
        if (result.error) return reply({ error: "No se ha podido eliminar la selección." }, 503);
        return reply({ ok: true });
      }
      const raw = await readFile(federationsFilePath(), "utf8").catch(() => "[]");
      const local = (JSON.parse(raw) as Federation[]).filter((federation) => federation.id && federation.name);
      const remaining = local.filter((item) => item.id !== id);
      if (remaining.length === local.length) return reply({ error: "Selección no encontrada." }, 404);
      await saveLocalFederations(remaining);
      return reply({ ok: true });
    }
    if (body.action === "delete-record") {
      if (typeof body.id !== "string" || !body.id) return reply({ error: "Registro no válido." }, 400);
      const current = await readManualSelectionCallups();
      const remaining = current.filter((item) => item.id !== body.id);
      if (remaining.length === current.length) return reply({ error: "Registro no encontrado." }, 404);
      await saveManualSelectionCallups(remaining);
      return reply({ ok: true });
    }
    const [players, current] = await Promise.all([playerReferences(request), readManualSelectionCallups()]);
    const record = manualSelectionCallupFromBody(body, players);
    if (!record) return reply({ error: "Indica jugador y selección." }, 400);
    if (body.id && typeof body.id === "string") {
      const existing = current.find((item) => item.id === body.id);
      if (!existing) return reply({ error: "Registro no encontrado." }, 404);
      const updated = { ...record, id: existing.id, created_at: existing.created_at };
      await saveManualSelectionCallups(current.map((item) => item.id === existing.id ? updated : item));
      return reply({ ok: true, record: updated });
    }
    const duplicate = current.some((item) => item.action === record.action && item.player_id === record.player_id && item.federation_id === record.federation_id && sameText(item.scope, record.scope) && sameText(item.season_label, record.season_label) && sameText(item.category, record.category) && sameText(item.format, record.format) && sameText(item.club_text, record.club_text) && sameText(item.notes, record.notes));
    if (duplicate) return reply({ error: "Ya existe una regularización igual para este jugador." }, 409);
    await saveManualSelectionCallups([record, ...current]);
    return reply({ ok: true, record }, 201);
  } catch {
    return reply({ error: "No se ha podido guardar la convocatoria manual." }, 400);
  }
}
