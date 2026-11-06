import { readClubHistory } from "@/lib/club-history";
import { readTemporaryClubGroups } from "@/lib/temporary-club-groups";
import { readGroupClubs, saveGroupClub, groupPlayerIds, readGroupMemberships } from "@/lib/temporary-group-clubs";
import { readPlayerNickname } from "@/lib/player-nicknames";
import { readCampusMetricsJson } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { mergeMilestoneTrajectory } from "@/lib/milestone-trajectory";
import { findClubDirectoryOverride } from "@/lib/club-directory-overrides";
import { inferClubLocation } from "@/lib/club-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Season = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year?: number | null };
type Metric = { player_id: string; participation_count: number };
type Milestone = { participant_id: string; scope: string; season_label?: string | null; club_text?: string | null; position_text?: string | null };
type MilestoneParticipant = { id: string; player_id: string | null };
type ClubRecord = { id: string; name: string; active: boolean; founded_text: string | null; disappeared_text?: string | null; city: string; province: string; region: string; country: string; latitude: number; longitude: number; maps_url: string; website: string | null; instagram: string | null; sports?: string[]; teams?: unknown };

const selectionFederations: Record<string, string> = { FN003: "FN003", FER: "FN003", FCR: "FT009", FRCV: "FT010", FRM: "FT015" };
const base = path.join(process.cwd(), "data", "staging");

async function stagedClub(id: string) {
  const raw = await readFile(path.join(base, "clubs.json"), "utf8");
  const found = (JSON.parse(raw) as ClubRecord[]).find((club) => club.id === id) ?? findClubDirectoryOverride(id);
  if (!found) return null;
  const { active, city, country, founded_text, disappeared_text, id: clubId, instagram, latitude, longitude, maps_url, name, province, region, website, teams } = found;
  return { id: clubId, name, active, founded_text, disappeared_text, city, province, region, country, latitude, longitude, maps_url, website, instagram, teams };
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id.toUpperCase();
  const publicTeams = ["ESP0022", "ESP0023", "ESP0010"].includes(id) && _request.nextUrl.searchParams.get("view") === "teams";
  const consultationDenied = publicTeams ? null : await requireConsultation(_request);
  if (consultationDenied) return consultationDenied;
  if (!/^[A-Z]{3}\d{4}$/.test(id)) return NextResponse.json({ error: "Club no válido." }, { status: 400 });
  if (!publicTeams && !catalogConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  try {
    const { db, admin } = publicTeams ? { db: null, admin: false } : await catalogAccess(_request);
    const result = db ? await db.from("catalog_clubs").select("id,name,active,founded_text,disappeared_text,city,province,region,country,latitude,longitude,maps_url,website,instagram").eq("id", id).maybeSingle() : { data: null, error: null };
    if (result.error) return NextResponse.json({ error: "No se ha podido cargar el club." }, { status: 503 });
    const sportResult = db ? await db.from("catalog_club_sports").select("catalog_sports(name)").eq("club_id", id) : { data: [] as { catalog_sports: { name: string } | { name: string }[] | null }[] };
    const sports = sportResult.data?.flatMap((row) => {
      const linked = row.catalog_sports;
      return Array.isArray(linked) ? linked.map((sport) => sport.name) : linked?.name ? [linked.name] : [];
    }) ?? ["Rugby"];
    const history = await readClubHistory(id);
    const groupClub = (await readGroupClubs()).find(club => club.id === id);
    const club = groupClub ?? (publicTeams ? await stagedClub(id) : result.data ? { ...result.data, teams: findClubDirectoryOverride(id)?.teams } : findClubDirectoryOverride(id) ?? (admin || process.env.NODE_ENV !== "production" ? await stagedClub(id) : null));
    if (!club) return NextResponse.json({ error: "Club no encontrado." }, { status: 404 });
    const [seasonsRaw, playersRaw, metricsRaw, milestonesRaw, milestoneParticipantsRaw, clubsRaw] = await Promise.all([
      readFile(path.join(base, "player-seasons.json"), "utf8"), readFile(path.join(base, "players.json"), "utf8"), readCampusMetricsJson(), readFile(path.join(base, "milestones.json"), "utf8"), readFile(path.join(base, "milestone-participants.json"), "utf8"), readFile(path.join(base, "clubs.json"), "utf8"),
    ]);
    const milestones = JSON.parse(milestonesRaw) as Milestone[];
    const milestoneParticipants = JSON.parse(milestoneParticipantsRaw) as MilestoneParticipant[];
    const seasons = mergeMilestoneTrajectory(JSON.parse(seasonsRaw) as Season[], milestones, milestoneParticipants, JSON.parse(clubsRaw) as ClubRecord[]);
    const players = new Map((JSON.parse(playersRaw) as Player[]).map((player) => [player.id, player]));
    const metrics = new Map((JSON.parse(metricsRaw) as Metric[]).map((metric) => [metric.player_id, metric.participation_count]));
    const milestonePlayers = new Map(milestoneParticipants.filter((participant) => participant.player_id).map((participant) => [participant.id, participant.player_id!]));
    const firstClubSeason = id === "ESP0022" ? 2018 : 2023;
    const groupYear = _request.nextUrl.searchParams.get("season");
    const groupCategory = _request.nextUrl.searchParams.get("category");
    const memberIds = groupClub ? await groupPlayerIds(id, groupYear, groupCategory, seasons) : null;
    const groupDefinitions = groupClub ? (await readTemporaryClubGroups()).filter(group => group.club_id === id) : [];
    const memberClubs = new Set(groupDefinitions.flatMap(group => group.club_ids));
    const recent = seasons.filter(season => groupClub ? memberIds!.has(season.player_id) && memberClubs.has(season.club_id || "") && (!groupYear || groupYear === "all" || season.season_year % 100 === Number(groupYear.split("/").at(-1)) % 100) : season.club_id === id && season.season_year >= firstClubSeason);
    const groupMemberships = await readGroupMemberships(seasons);
    const playerRows = [...new Set(recent.map((season) => season.player_id))].map((playerId) => {
      const player = players.get(playerId);
      const clubSeasons = recent.filter((season) => season.player_id === playerId).sort((a, b) => b.season_year - a.season_year);
      const latest = clubSeasons[0];
      return { club_groups: groupMemberships.get(playerId) ?? [], id: playerId, first_name: player?.first_name ?? "Jugador", last_name: player?.last_name ?? null, category: player?.category ?? null, birth_year: player?.birth_year ?? null, position_text: latest?.position_text ?? null, participation_count: metrics.get(playerId) ?? 0, season_year: latest?.season_year ?? null, ...(["ESP0022", "ESP0023", "ESP0010"].includes(id) ? { club_seasons: clubSeasons.map((season) => ({ season_year: season.season_year, position_text: season.position_text, registration_number: season.registration_number ?? null })) } : {}) };
    }).sort((a, b) => `${b.participation_count}`.localeCompare(`${a.participation_count}`) || `${a.last_name ?? ""} ${a.first_name}`.localeCompare(`${b.last_name ?? ""} ${b.first_name}`, "es"));
    const nicknames = new Map(await Promise.all(playerRows.map(async player => [player.id, await readPlayerNickname(player.id)] as const)));
    const cabreraRoster = new Map<string, { roster_category: string; current_club: boolean }>();
    if (id === "ESP0022") {
      const referenceYear = 2026;
      for (const row of playerRows) {
        const player = players.get(row.id);
        const latest = seasons.filter(s => s.player_id === row.id).sort((a, b) => b.season_year - a.season_year)[0];
        const age = player?.birth_year ? referenceYear - player.birth_year : null;
        const limit = age !== null && age >= 0 ? [6, 8, 10, 12, 14, 16, 19].find(n => age < n) : undefined;
        cabreraRoster.set(row.id, { roster_category: age === null || age < 0 ? "Por confirmar" : limit ? "Sub " + limit : "Sénior", current_club: latest?.club_id === id });
      }
    }
    const currentPlayerIds = new Set(playerRows.map((player) => player.id));
    const selectedPlayersByFederation = new Map<string, Set<string>>();
    const selectedFederationIdsByPlayer = new Map<string, Set<string>>();
    const milestonesByPlayer = new Map<string, number>();
    for (const milestone of milestones) {
      const playerId = milestonePlayers.get(milestone.participant_id);
      const federationId = selectionFederations[milestone.scope];
      if (!playerId || !currentPlayerIds.has(playerId)) continue;
      milestonesByPlayer.set(playerId, (milestonesByPlayer.get(playerId) ?? 0) + 1);
      if (!federationId) continue;
      const selectedPlayers = selectedPlayersByFederation.get(federationId) ?? new Set<string>();
      selectedPlayers.add(playerId); selectedPlayersByFederation.set(federationId, selectedPlayers);
      const playerFederations = selectedFederationIdsByPlayer.get(playerId) ?? new Set<string>();
      playerFederations.add(federationId); selectedFederationIdsByPlayer.set(playerId, playerFederations);
    }
    const selectedFederations = [...selectedPlayersByFederation.entries()].map(([federationId, playerIds]) => ({ id: federationId, player_count: playerIds.size })).sort((a, b) => Number(b.id === "FN003") - Number(a.id === "FN003"));
    return NextResponse.json({ configured: true, admin, club: { ...club, sports, history }, group_members: [...memberClubs].map(memberId => ({ id: memberId, name: (JSON.parse(clubsRaw) as ClubRecord[]).find(member => member.id === memberId)?.name || memberId })).sort((a, b) => a.name.localeCompare(b.name, "es")), group_seasons: [...new Set(groupDefinitions.map(group => group.season))].sort().reverse(), group_categories: [...new Set(groupDefinitions.map(group => group.category))].sort((a, b) => a.localeCompare(b, "es", { numeric: true })), players: playerRows.map((player) => ({ ...player, nickname: nicknames.get(player.id) ?? null, ...(cabreraRoster.get(player.id) ?? {}), milestone_count: milestonesByPlayer.get(player.id) ?? 0, selected_federation_ids: [...(selectedFederationIdsByPlayer.get(player.id) ?? new Set<string>())].sort((a, b) => Number(b === "FN003") - Number(a === "FN003")) })), participation_count: playerRows.reduce((sum, player) => sum + player.participation_count, 0), selected_federation_ids: selectedFederations.map((federation) => federation.id), selected_federations: selectedFederations }, { headers: publicTeams ? { "Cache-Control": "public, max-age=300" } : { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido cargar la ficha del club." }, { status: 503 });
  }
}

const editableFields = "id,name,active,founded_text,disappeared_text,city,province,region,country,latitude,longitude,maps_url,website,instagram";
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : null;
const optionalCoordinate = (value: unknown, minimum: number, maximum: number) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined;
};
const optionalHttpsUrl = (value: string | null) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const id = (await context.params).id.toUpperCase();
  if (!/^[A-Z]{3}\d{4}$/.test(id)) return NextResponse.json({ error: "Club no válido." }, { status: 400 });
  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const values = body as Record<string, unknown>;
    const name = text(values.name, 160); const city = text(values.city, 100); const province = text(values.province, 100); const region = text(values.region, 100); const country = text(values.country, 100);
    const mapsUrl = optionalHttpsUrl(text(values.maps_url, 1000)); const website = optionalHttpsUrl(text(values.website, 500)); const instagram = text(values.instagram, 160); const founded = text(values.founded_text, 100);
    const disappeared = Object.hasOwn(values, "disappeared_text") ? text(values.disappeared_text, 160) : undefined;
    if (disappeared && (!/^\d{4}$/.test(disappeared) || Number(disappeared) < 1800 || Number(disappeared) > new Date().getFullYear())) return NextResponse.json({ error: "El año de desaparición debe ser un año válido." }, { status: 400 });
    if (disappeared && values.active === true) return NextResponse.json({ error: "Un club desaparecido debe estar marcado como inactivo." }, { status: 400 });
    const latitude = optionalCoordinate(values.latitude, -90, 90); const longitude = optionalCoordinate(values.longitude, -180, 180);
    if (!name || !city || !province || !region || !country || typeof values.active !== "boolean") return NextResponse.json({ error: "Completa nombre, ciudad, provincia, región y país." }, { status: 400 });
    if (latitude === undefined || longitude === undefined) return NextResponse.json({ error: "Las coordenadas deben estar dentro de rango." }, { status: 400 });
    if (mapsUrl === null || website === null) return NextResponse.json({ error: "Los enlaces deben ser direcciones https:// válidas." }, { status: 400 });
    const { db, admin } = await catalogAccess(request);
    if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    const inferredLocation = latitude === null || longitude === null || !mapsUrl ? inferClubLocation({ name, city, province, region, country }) : null;
    const resolvedLatitude = latitude ?? inferredLocation?.latitude ?? 0;
    const resolvedLongitude = longitude ?? inferredLocation?.longitude ?? 0;
    const resolvedMapsUrl = mapsUrl || inferredLocation?.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, city, province, country].filter(Boolean).join(", "))}`;
    if (id.startsWith("ATC") && (await readGroupClubs()).some(club => club.id === id)) {
      const club = await saveGroupClub(id, { name, city, province, region, country, active: values.active, founded_text: founded || null, ...(disappeared === undefined ? {} : { disappeared_text: disappeared || null }), website: website || null, instagram: instagram || null, latitude: resolvedLatitude, longitude: resolvedLongitude, maps_url: resolvedMapsUrl });
      return NextResponse.json({ club }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
    }
    const update = await db.from("catalog_clubs").update({ name, city, province, region, country, active: values.active, founded_text: founded || null, ...(disappeared === undefined ? {} : { disappeared_text: disappeared || null }), website: website || null, instagram: instagram || null, latitude: resolvedLatitude, longitude: resolvedLongitude, maps_url: resolvedMapsUrl }).eq("id", id).select(editableFields).maybeSingle();
    if (update.error || !update.data) return NextResponse.json({ error: "No se han podido guardar los datos del club." }, { status: 503 });
    return NextResponse.json({ club: update.data }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
  } catch { return NextResponse.json({ error: "No se han podido guardar los datos del club." }, { status: 400 }); }
}
