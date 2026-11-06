import { currentClubSeason } from "@/lib/current-club";
import { readCampusMetricsJson, saveCampusParticipationMetrics } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { blankPlayerContacts, readLocalPlayerContacts, saveLocalPlayerContacts } from "@/lib/player-private-contacts";
import { readProfessionalCategories } from "@/lib/professional-club-milestones";
import { likidHubPreviewReadOnly } from "@/lib/likidhub-preview";
import { likidHubPreviewParticipationsResponse } from "@/lib/likidhub-preview-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null };
type Metric = { player_id: string; participation_count: number; participation_years: string[]; participation_campus?: Record<string, string>; participation_campuses?: Record<string, string>; participation_registration_numbers?: Record<string, string>; participation_email_enabled?: boolean; participation_pending_year?: boolean };
type Season = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg?: number | null; height_cm?: number | null };
type Club = { id: string; name: string; city?: string | null; province?: string | null; region?: string | null; country?: string | null };

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const fullName = (player?: Player) => [player?.first_name, player?.last_name].filter(Boolean).join(" ") || "Jugador";
const primaryPhotoUrl = async (playerId: string) => {
  const seasonRoot = path.join(process.cwd(), "data", "staging", "player-season-photos", playerId);
  try {
    const { season } = JSON.parse(await readFile(path.join(seasonRoot, "primary.json"), "utf8")) as { season?: string | number };
    const year = String(season ?? "");
    if (!/^20\d{2}$/.test(year)) return null;
    await access(path.join(seasonRoot, `${year}.png`));
    return `/api/jugadores/foto/${playerId}?season=${year}&v=primary`;
  } catch {
    try {
      const latest = (await readdir(seasonRoot))
        .map((name) => name.match(/^(20\d{2})\.png$/)?.[1])
        .filter((year): year is string => Boolean(year))
        .sort((left, right) => Number(right) - Number(left))[0];
      if (latest) return `/api/jugadores/foto/${playerId}?season=${latest}&v=latest`;
    } catch {
      // No season photo; try the prepared profile photo below.
    }
    try {
      await access(path.join(process.cwd(), "data", "staging", "player-photos", "prepared", `${playerId}.png`));
      return `/api/jugadores/foto/${playerId}?v=prepared`;
    } catch {
      return null;
    }
  }
};
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uniqueYears = (value: unknown) => [...new Set(String(value ?? "").split(/[,\s;|]+/).map((item) => item.trim()).filter((item) => /^\d{4}$/.test(item)))].sort();
const cleanRegistrationNumber = (value: string) => /^\d+$/.test(value) ? String(Number(value)) : value;
const campusMapFromText = (value: unknown, years: string[]) => {
  const text = String(value ?? "").trim();
  if (!text) return Object.fromEntries(years.map((year) => [year, "CAM001"]));
  if (/^[A-Za-z0-9_-]+$/.test(text)) return Object.fromEntries(years.map((year) => [year, text.toUpperCase()]));
  const entries = text.split(/[|\n,;]+/).map((item) => item.trim()).filter(Boolean);
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const match = entry.match(/^(\d{4})\s*[:=-]\s*([A-Za-z0-9_-]+)$/);
    if (!match) return null;
    map[match[1]] = match[2].toUpperCase();
  }
  return Object.fromEntries(years.map((year) => [year, map[year] ?? "CAM001"]));
};
const registrationKey = (campus: string, year: string) => `${campus}:${year}`;
const registrationMapFromText = (value: unknown, years: string[], campuses: Record<string, string>) => {
  const text = String(value ?? "").trim();
  if (!text) return {};
  if (!years.length && /^[A-Za-z0-9_-]+$/.test(text)) return {};
  if (/^[A-Za-z0-9_-]+$/.test(text)) return Object.fromEntries(years.map((year) => [registrationKey((campuses[year] ?? "CAM001").toUpperCase(), year), cleanRegistrationNumber(text.toUpperCase())]));
  const entries = text.split(/[|\n,;]+/).map((item) => item.trim()).filter(Boolean);
  const map: Record<string, string> = {};
  for (const entry of entries) {
    const match = entry.match(/^(?:(CAM[A-Za-z0-9_-]*)\s*[:/-]\s*)?(\d{4})\s*[:=-]\s*([A-Za-z0-9_-]+)$/i);
    if (!match) return null;
    const campus = (match[1] ?? campuses[match[2]] ?? "CAM001").toUpperCase();
    map[registrationKey(campus, match[2])] = cleanRegistrationNumber(match[3].toUpperCase());
  }
  return Object.fromEntries(years.flatMap((year) => {
    const key = registrationKey(campuses[year] ?? "CAM001", year);
    return map[key] ? [[key, map[key]]] : [];
  }));
};
const registrationTargets = (body: Record<string, unknown>) => {
  if (Array.isArray(body.registration_targets)) {
    return body.registration_targets.flatMap((target) => {
      if (!target || typeof target !== "object") return [];
      const year = String((target as { year?: unknown }).year ?? "");
      const campus = String((target as { campus?: unknown }).campus ?? "").toUpperCase();
      return /^\d{4}$/.test(year) && campus ? [{ year, campus }] : [];
    });
  }
  const years = Array.isArray(body.years) ? body.years.map((year) => String(year)).filter((year) => /^\d{4}$/.test(year)) : [];
  return years.map((year) => ({ year, campus: String((body.campus ?? "CAM001")).toUpperCase() }));
};
const seasonEndYear = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}$/.test(text)) return Number(text);
  const match = text.match(/^(\d{2}|\d{4})\s*[/–-]\s*(\d{2}|\d{4})$/);
  if (!match) return Number.NaN;
  const start = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const end = Number(match[2].length === 2 ? `${String(start).slice(0, 2)}${match[2]}` : match[2]);
  return end === start + 1 ? end : Number.NaN;
};
const seasonLabel = (year: number | null | undefined) => year ? `${String(year - 1).slice(-2)}/${String(year).slice(-2)}` : "";
const metricFromBody = (body: Record<string, unknown>, players: Map<string, Player>): Metric | null => {
  const playerMatch = String(body.player_id ?? "").trim().toUpperCase().match(/JUG\d{4}/);
  const player_id = playerMatch?.[0] ?? "";
  if (!/^JUG\d{4}$/.test(player_id) || !players.has(player_id)) return null;
  const participation_years = uniqueYears(body.participation_years);
  const participation_count = Number(body.participation_count);
  const participation_pending_year = Boolean(body.participation_pending_year);
  if (!Number.isInteger(participation_count) || participation_count < participation_years.length || participation_count > 99) return null;
  if (participation_count > participation_years.length && !participation_pending_year) return null;
  const participation_campus = campusMapFromText(body.participation_campus, participation_years);
  if (!participation_campus) return null;
  const participation_registration_numbers = registrationMapFromText(body.participation_registration_numbers, participation_years, participation_campus);
  if (!participation_registration_numbers) return null;
  const participation_email_enabled = body.participation_email_enabled === undefined ? true : Boolean(body.participation_email_enabled);
  return { player_id, participation_count, participation_years, participation_campus, ...(Object.keys(participation_registration_numbers).length ? { participation_registration_numbers } : {}), ...(participation_email_enabled === false ? { participation_email_enabled: false } : {}), ...(participation_pending_year ? { participation_pending_year: true } : {}) };
};
async function saveLocalPlayerSeason(player_id: string, season_year: number, club_id: string | null, clubs: Map<string, Club>) {
  const seasonsPath = path.join(process.cwd(), "data", "staging", "player-seasons.json");
  const seasons = JSON.parse(await readFile(seasonsPath, "utf8")) as Season[];
  const existing = seasons.find((season) => season.player_id === player_id && season.season_year === season_year);
  const club = club_id ? clubs.get(club_id) ?? null : null;
  const nextSeason: Season = {
    player_id,
    season_year,
    registration_number: existing?.registration_number ?? null,
    club_id,
    legacy_club_name: club?.name ?? null,
    position_text: existing?.position_text ?? null,
    weight_kg: existing?.weight_kg ?? null,
    height_cm: existing?.height_cm ?? null,
  };
  const nextSeasons = [
    ...seasons.filter((season) => !(season.player_id === player_id && season.season_year === season_year)),
    nextSeason,
  ].sort((left, right) => left.player_id.localeCompare(right.player_id, "es") || left.season_year - right.season_year);
  await writeFile(seasonsPath, `${JSON.stringify(nextSeasons, null, 2)}\n`, "utf8");
}

export async function GET(request: NextRequest) {
  if (likidHubPreviewReadOnly()) {
    try { return await likidHubPreviewParticipationsResponse(); }
    catch { return reply({ error: "No se pudieron leer las participaciones LikidHub." }, 503); }
  }
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const admin = catalogConfigured() ? (await catalogAccess(request)).admin : false;
    const root = path.join(process.cwd(), "data", "staging");
    const [playersRaw, metricsRaw, seasonsRaw, clubsRaw, campuses] = await Promise.all([
      readFile(path.join(root, "players.json"), "utf8"),
      readCampusMetricsJson(),
      readFile(path.join(root, "player-seasons.json"), "utf8"),
      readFile(path.join(root, "clubs.json"), "utf8"),
      readProfessionalCategories().then((categories) => categories.filter((category) => category.type === "FORM" || category.type === "CAMP").map((category) => ({ id: category.id, name: category.label, siglas: category.siglas ?? null, kind: category.type, country: category.country, active: true }))),
    ]);
    const players = new Map((JSON.parse(playersRaw) as Player[]).map((player) => [player.id, player]));
    const metrics = JSON.parse(metricsRaw) as Metric[];
    const seasons = JSON.parse(seasonsRaw) as Season[];
    const clubs = new Map((JSON.parse(clubsRaw) as Club[]).map((club) => [club.id, club]));
    const seasonsByPlayer = new Map<string, Season[]>();
    for (const season of seasons) seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);

    const rows = await Promise.all(metrics.map(async (metric) => {
      const player = players.get(metric.player_id);
      const latestSeason = currentClubSeason(seasonsByPlayer.get(metric.player_id) ?? []);
      const club = latestSeason?.club_id ? clubs.get(latestSeason.club_id) : null;
      const contacts = admin ? await readLocalPlayerContacts(metric.player_id) : null;
      return {
        seasons: [...(seasonsByPlayer.get(metric.player_id) ?? [])].sort((a, b) => b.season_year - a.season_year).map((season) => ({ ...season, club_name: season.club_id ? clubs.get(season.club_id)?.name ?? season.legacy_club_name : season.legacy_club_name, season_label: seasonLabel(season.season_year) })),
        player_id: metric.player_id,
        first_name: player?.first_name ?? "Jugador",
        last_name: player?.last_name ?? null,
        display_name: fullName(player),
        primary_photo_url: await primaryPhotoUrl(metric.player_id),
        category: player?.category ?? null,
        birth_year: player?.birth_year ?? null,
        participation_count: metric.participation_count,
        participation_years: [...metric.participation_years].sort(),
        participation_campus: metric.participation_campus ?? metric.participation_campuses ?? {},
        participation_registration_numbers: metric.participation_registration_numbers ?? {},
        participation_email_enabled: metric.participation_email_enabled !== false,
        participation_pending_year: Boolean(metric.participation_pending_year) || metric.participation_count > metric.participation_years.length,
        current_club_id: latestSeason?.club_id ?? null,
        current_club_name: club?.name ?? latestSeason?.legacy_club_name ?? null,
        current_season_year: latestSeason?.season_year ?? null,
        position_text: latestSeason?.position_text ?? null,
        contact_email: contacts?.tutor1_email ?? contacts?.player_email ?? null,
      };
    })).then((items) => items.sort((a, b) => b.participation_count - a.participation_count || a.display_name.localeCompare(b.display_name, "es")));

    const yearMap = new Map<string, Set<string>>();
    const clubMap = new Map<string, { club_id: string | null; club_name: string; playerIds: Set<string>; participations: number }>();
    for (const row of rows) {
      for (const year of row.participation_years) {
        const yearPlayers = yearMap.get(year) ?? new Set<string>();
        yearPlayers.add(row.player_id);
        yearMap.set(year, yearPlayers);
      }
      const key = row.current_club_id ?? row.current_club_name ?? "Sin club";
      const current = clubMap.get(key) ?? { club_id: row.current_club_id, club_name: row.current_club_name ?? "Sin club", playerIds: new Set<string>(), participations: 0 };
      current.playerIds.add(row.player_id);
      current.participations += row.participation_count;
      clubMap.set(key, current);
    }

    const playerOptions = await Promise.all([...players.values()].map(async (player) => {
      const metric = metrics.find((item) => item.player_id === player.id) ?? null;
      const latestSeason = currentClubSeason(seasonsByPlayer.get(player.id) ?? []);
      const club = latestSeason?.club_id ? clubs.get(latestSeason.club_id) : null;
      const contacts = admin ? await readLocalPlayerContacts(player.id) : null;
      return {
        seasons: [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year).map((season) => ({ ...season, club_name: season.club_id ? clubs.get(season.club_id)?.name ?? season.legacy_club_name : season.legacy_club_name, season_label: seasonLabel(season.season_year) })),
        id: player.id,
        name: fullName(player),
        primary_photo_url: await primaryPhotoUrl(player.id),
        category: player.category,
        birth_year: player.birth_year,
        current_club_id: latestSeason?.club_id ?? null,
        current_club_name: club?.name ?? latestSeason?.legacy_club_name ?? null,
        position_text: latestSeason?.position_text ?? null,
        contact_email: contacts?.tutor1_email ?? contacts?.player_email ?? null,
        participation_count: metric?.participation_count ?? 0,
        participation_years: metric?.participation_years ?? [],
        participation_campus: metric?.participation_campus ?? metric?.participation_campuses ?? {},
        participation_registration_numbers: metric?.participation_registration_numbers ?? {},
        participation_email_enabled: metric?.participation_email_enabled !== false,
        participation_pending_year: Boolean(metric?.participation_pending_year) || Boolean(metric && metric.participation_count > metric.participation_years.length),
      };
    }));

    return reply({
      configured: true,
      admin,
      summary: {
        players: rows.length,
        participations: rows.reduce((total, row) => total + row.participation_count, 0),
        years: yearMap.size,
        clubs: [...clubMap.values()].filter((club) => club.club_id).length,
      },
      years: [...yearMap.entries()].map(([year, playerIds]) => ({
        year,
        players: playerIds.size,
        participations: rows.filter((row) => row.participation_years.includes(year)).length,
      })).sort((a, b) => Number(b.year) - Number(a.year)),
      clubs: [...clubMap.values()].map((row) => ({
        club_id: row.club_id,
        club_name: row.club_name,
        players: row.playerIds.size,
        participations: row.participations,
      })).sort((a, b) => b.participations - a.participations || a.club_name.localeCompare(b.club_name, "es")),
      campuses,
      clubOptions: [...clubs.values()].sort((a, b) => a.name.localeCompare(b.name, "es")),
      participations: rows,
      players: playerOptions.sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id, "es")),
    });
  } catch {
    return reply({ error: "No se han podido cargar los datos de participaciones." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const admin = catalogConfigured() ? (await catalogAccess(request)).admin : true;
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const root = path.join(process.cwd(), "data", "staging");
    const [playersRaw, metricsRaw, clubsRaw] = await Promise.all([
      readFile(path.join(root, "players.json"), "utf8"),
      readCampusMetricsJson(),
      readFile(path.join(root, "clubs.json"), "utf8"),
    ]);
    const players = new Map((JSON.parse(playersRaw) as Player[]).map((player) => [player.id, player]));
    const metrics = JSON.parse(metricsRaw) as Metric[];
    const clubs = new Map((JSON.parse(clubsRaw) as Club[]).map((club) => [club.id, club]));
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "set-email-enabled") {
      const player_id = String(body.player_id ?? "").trim().toUpperCase();
      if (!/^JUG\d{4}$/.test(player_id) || typeof body.enabled !== "boolean") return reply({ error: "Solicitud de correo no válida." }, 400);
      let changed = false;
      const nextMetrics = metrics.map((metric) => {
        if (metric.player_id !== player_id) return metric;
        changed = true;
        return { ...metric, participation_email_enabled: body.enabled === true };
      });
      if (!changed) return reply({ error: "Participación no encontrada." }, 404);
      await saveCampusParticipationMetrics(nextMetrics, metrics);
      return reply({ ok: true, player_id, participation_email_enabled: body.enabled });
    }
    if (body.action === "update-list-fields") {
      const player_id = String(body.player_id ?? "").trim().toUpperCase();
      if (!/^JUG\d{4}$/.test(player_id)) return reply({ error: "Jugador no válido." }, 400);
      const targets = registrationTargets(body);
      const registration = typeof body.registration_number === "string" ? cleanRegistrationNumber(body.registration_number.trim().toUpperCase().slice(0, 24)) : undefined;
      const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : undefined;
      if (registration !== undefined && !targets.length) return reply({ error: "Selecciona campus y año para guardar el registro." }, 400);
      if (contactEmail !== undefined && contactEmail && !emailPattern.test(contactEmail)) return reply({ error: "El mail no tiene un formato válido." }, 400);
      let changed = false;
      const nextMetrics = metrics.map((metric) => {
        if (metric.player_id !== player_id) return metric;
        changed = true;
        if (registration === undefined) return metric;
        const nextRegistrations = { ...(metric.participation_registration_numbers ?? {}) };
        for (const target of targets) {
          const key = registrationKey(target.campus, target.year);
          delete nextRegistrations[target.year];
          if (registration) nextRegistrations[key] = registration;
          else delete nextRegistrations[key];
        }
        return { ...metric, participation_registration_numbers: Object.keys(nextRegistrations).length ? nextRegistrations : undefined };
      });
      if (!changed) return reply({ error: "Participación no encontrada." }, 404);
      if (registration !== undefined) await saveCampusParticipationMetrics(nextMetrics, metrics);
      if (contactEmail !== undefined) {
        const currentContacts = await readLocalPlayerContacts(player_id);
        const contacts = { ...blankPlayerContacts(), ...(currentContacts ?? {}) };
        const targetField = contacts.tutor1_email || contacts.tutor1_name || (!contacts.player_email && !contacts.tutor2_email) ? "tutor1_email" : "player_email";
        await saveLocalPlayerContacts(player_id, { ...contacts, [targetField]: contactEmail || null });
      }
      return reply({ ok: true, player_id, registration_number: registration, contact_email: contactEmail });
    }
    if (body.action === "delete") {
      const player_id = String(body.player_id ?? "").trim().toUpperCase();
      if (!/^JUG\d{4}$/.test(player_id)) return reply({ error: "Jugador no válido." }, 400);
      const nextMetrics = metrics.filter((metric) => metric.player_id !== player_id);
      if (nextMetrics.length === metrics.length) return reply({ error: "Participación no encontrada." }, 404);
      await saveCampusParticipationMetrics(nextMetrics, metrics);
      return reply({ ok: true });
    }
    const metric = metricFromBody(body, players);
    if (!metric) return reply({ error: "Indica jugador, total, años, programa y registro con un formato válido." }, 400);
    const submittedSeasonYear = seasonEndYear(body.season_year);
    const submittedClubId = typeof body.club_id === "string" && body.club_id.trim() ? body.club_id.trim() : null;
    if (submittedSeasonYear !== null && (!Number.isInteger(submittedSeasonYear) || submittedSeasonYear < 2000 || submittedSeasonYear > 2035)) return reply({ error: "Indica una temporada válida, por ejemplo 26/27." }, 400);
    if (submittedClubId && !clubs.has(submittedClubId)) return reply({ error: "El club seleccionado no existe." }, 400);
    if (submittedClubId && submittedSeasonYear === null) return reply({ error: "Indica temporada para asociar el club." }, 400);
    const existingMetric = metrics.find((item) => item.player_id === metric.player_id);
    const preservedRegistrations = Object.fromEntries(Object.entries(existingMetric?.participation_registration_numbers ?? {}).filter(([key]) => {
      const year = key.includes(":") ? key.split(":").at(-1) : key;
      return metric.participation_years.includes(year ?? "");
    }));
    const mergedRegistrations = {
      ...preservedRegistrations,
      ...(metric.participation_registration_numbers ?? {}),
    };
    const nextMetric: Metric = {
      ...metric,
      ...(Object.keys(mergedRegistrations).length ? { participation_registration_numbers: mergedRegistrations } : {}),
      ...(metric.participation_email_enabled === false || existingMetric?.participation_email_enabled === false ? { participation_email_enabled: false } : {}),
    };
    const nextMetrics = metrics.some((item) => item.player_id === metric.player_id) ? metrics.map((item) => item.player_id === metric.player_id ? nextMetric : item) : [nextMetric, ...metrics];
    await saveCampusParticipationMetrics(nextMetrics, metrics);
    const contactEmail = typeof body.contact_email === "string" ? body.contact_email.trim().toLowerCase() : "";
    if (contactEmail) {
      if (!emailPattern.test(contactEmail)) return reply({ error: "El mail no tiene un formato válido." }, 400);
      const currentContacts = await readLocalPlayerContacts(metric.player_id);
      const contacts = { ...blankPlayerContacts(), ...(currentContacts ?? {}) };
      await saveLocalPlayerContacts(metric.player_id, { ...contacts, tutor1_email: contactEmail });
    }
    if (submittedSeasonYear !== null) await saveLocalPlayerSeason(metric.player_id, submittedSeasonYear, submittedClubId, clubs);
    return reply({ ok: true, participation: metric }, 201);
  } catch {
    return reply({ error: "No se ha podido guardar la participación." }, 400);
  }
}
