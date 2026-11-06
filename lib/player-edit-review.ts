import { parseBirthInput } from "./birth-date";
import { currentRugbySeasonYear } from "./current-club";
import { readPlayerEventSizes, parsePlayerEventSizes, savePlayerEventSizes } from "./player-event-sizes";
import { readPlayerNickname, savePlayerNickname } from "./player-nicknames";
import { readPlayerCareer, readStaffOptions, savePlayerCareer } from "./player-career";
import { readPlayerBilling } from "./player-billing";
import { readPlayerPrivateConsents } from "./player-private-consent";
import { savePlayerProfileOverride } from "./player-profile-overrides";
import { saveLocalPlayerContacts, type LocalPlayerContacts } from "./player-private-contacts";
import { trajectoryProfessionalClubs } from "@/app/lib/trajectory-professional-clubs";
import { readCampusParticipationMetrics } from "./campus-participations";
import { remoteReviewLinks } from "@/lib/player-review-links.mjs";
import { catalogServiceClient } from "@/lib/catalog";
import { usesRemoteReviewStorage, readRemoteReview, saveRemoteReview } from "@/lib/player-review-storage";
import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readSeasonCategories, readCompetitionCategories } from "@/lib/player-season-categories";
import { readProfessionalCategories } from "@/lib/professional-club-milestones";
import { parseBilling, savePlayerBilling } from "@/lib/player-billing";
import { savePlayerPrivateConsents } from "@/lib/player-private-consent";
import { readHitoPublication, isHitoPublished } from "@/lib/hito-publication";
import { createPlayerReviewPdf } from "@/lib/player-review-pdf";
import { playerPdfFilename } from "@/lib/player-pdf-filename";
import { applyManualSelectionCallups, readManualSelectionCallups, selectionFederationIds, type SelectionRecord } from "@/lib/manual-selection-callups";

export type PlayerEditToken = {
  token: string;
  player_id: string;
  created_at: string;
  expires_at: string;
  status: "active" | "closed";
};

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; dni?: string | null };
type Season = { player_id?: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null; club_name?: string | null; playing_category?: string | null; competition_category?: string | null };
type Contacts = { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null };
type Participant = { id: string; player_id: string | null };
type Milestone = { id: string; participant_id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null };
type DriveOutboxConfig = { folder_id: string; folder_name: string; folder_url: string; mode: string; local_outbox?: string };
type PlayerReviewShortLink = { code: string; token: string; player_id: string; created_at: string; status: "active" | "closed" };

const base = () => path.join(process.cwd(), "data", "staging");
const tokenDir = () => path.join(base(), "player-edit-tokens");
const tokenFile = (token: string) => path.join(tokenDir(), `${token}.json`);
const shortLinksFile = () => path.join(base(), "player-review-short-links.json");
async function outboxRoot() {
  const driveConfig = await readJson<DriveOutboxConfig | null>(path.join(base(), "player-edit-drive-config.json"), null);
  return process.env.CTRUGBY_PLAYER_EDIT_DRIVE_DIR || driveConfig?.local_outbox || path.join(base(), "player-edit-drive-outbox");
}

export const isValidPlayerId = (id: string) => /^JUG\d{4}$/.test(id);
export const isValidToken = (token: string) => /^[a-f0-9]{48}$/.test(token);
export const isValidShortCode = (code: string) => /^[A-Za-z0-9_-]{8,16}$/.test(code);
export const fullName = (player: Pick<Player, "first_name" | "last_name"> | null | undefined) => [player?.first_name, player?.last_name].filter(Boolean).join(" ");

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filename, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export async function createPlayerEditToken(playerId: string) {
  if (!isValidPlayerId(playerId)) throw new Error("Jugador no valido.");
  if (usesRemoteReviewStorage()) {
    const { record } = await (await remoteReviewLinks()).ensure(playerId);
    return { token: record.token, player_id: record.player_id, created_at: record.created_at, expires_at: record.expires_at, status: record.status };
  }
  await mkdir(tokenDir(), { recursive: true });
  for (const name of await readdir(tokenDir()).catch(() => [] as string[])) {
    if (!name.endsWith(".json")) continue;
    const existing = await readJson<PlayerEditToken | null>(path.join(tokenDir(), name), null);
    if (existing?.player_id === playerId && existing.status === "active" && Date.parse(existing.expires_at) > Date.now()) {
      const refreshed = { ...existing, expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() };
      await writeFile(tokenFile(refreshed.token), `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
      return refreshed;
    }
  }
  const token = randomBytes(24).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const record: PlayerEditToken = {
    token,
    player_id: playerId,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    status: "active",
  };
  await writeFile(tokenFile(token), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return record;
}

export async function readPlayerEditToken(token: string) {
  if (!isValidToken(token)) return null;
  const record = usesRemoteReviewStorage()
    ? await (await remoteReviewLinks()).read("tokens", token)
    : await readJson<PlayerEditToken | null>(tokenFile(token), null);
  if (!record || record.status !== "active" || Date.parse(record.expires_at) < Date.now()) return null;
  return record;
}

export async function getOrCreatePlayerReviewShortLink(playerId: string, token: string) {
  if (!isValidPlayerId(playerId) || !isValidToken(token)) throw new Error("Enlace no valido.");
  if (usesRemoteReviewStorage()) {
    const record = await (await remoteReviewLinks()).read("tokens", token);
    if (!record || record.player_id !== playerId) throw new Error("Enlace no válido.");
    return { code: record.code, token: record.token, player_id: record.player_id, created_at: record.created_at, status: record.status };
  }
  const current = await readJson<PlayerReviewShortLink[]>(shortLinksFile(), []);
  const existing = current.find((item) => item.player_id === playerId && item.status === "active");
  if (existing) return existing;
  let code = "";
  do {
    code = randomBytes(6).toString("base64url");
  } while (current.some((item) => item.code === code));
  const link: PlayerReviewShortLink = { code, token, player_id: playerId, created_at: new Date().toISOString(), status: "active" };
  await writeFile(shortLinksFile(), `${JSON.stringify([link, ...current], null, 2)}\n`, "utf8");
  return link;
}

export async function readPlayerReviewShortLink(code: string) {
  if (!isValidShortCode(code)) return null;
  if (usesRemoteReviewStorage()) {
    const record = await (await remoteReviewLinks()).read("codes", code);
    if (!record || record.status !== "active" || Date.parse(record.expires_at) < Date.now()) return null;
    return { code: record.code, token: record.token, player_id: record.player_id, created_at: record.created_at, status: record.status };
  }
  const links = await readJson<PlayerReviewShortLink[]>(shortLinksFile(), []);
  const link = links.find((item) => item.code === code && item.status === "active") ?? null;
  if (!link) return null;
  const token = await readPlayerEditToken(link.token);
  return token && token.player_id === link.player_id ? link : null;
}

export async function loadPlayerReviewData(playerId: string): Promise<PlayerReviewData | null> {
  if (process.env.NODE_ENV !== "production") {
    const local = await loadLocalPlayerReviewData(playerId);
    if (local) return local;
  }
  if (usesRemoteReviewStorage()) {
    {
      const db = catalogServiceClient();
      const bucket = process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private";
      const info = await db.storage.getBucket(bucket);
      if (info.error || info.data?.public !== false) throw new Error("Los enlaces requieren un almacén privado. Contacta con CTRugby.");
      const stored = await db.storage.from(bucket).download(`player-review-data/${playerId}.json`);
      if (stored.error) throw new Error("No se ha podido cargar la ficha privada. Contacta con CTRugby.");
      const data = JSON.parse(await stored.data.text()) as PlayerReviewData;
      return { ...data, professional_club_records: trajectoryProfessionalClubs(data.seasons, data.clubs, data.professional_categories) };
    }
  }
  return loadLocalPlayerReviewData(playerId);
}

export type PlayerReviewData = NonNullable<Awaited<ReturnType<typeof loadLocalPlayerReviewData>>>;

export async function loadLocalPlayerReviewData(playerId: string) {
  const [players, seasons, clubs, profiles, contacts, participationMetrics, campusCategories, participants, milestones, manualSelectionCallups] = await Promise.all([
    readJson<Player[]>(path.join(base(), "players.json"), []),
    readJson<Season[]>(path.join(base(), "player-seasons.json"), []),
    readJson<Array<{ id: string; name: string }>>(path.join(base(), "clubs.json"), []),
    readJson<Record<string, unknown>>(path.join(base(), "player-profiles", `${playerId}.json`), {}),
    readJson<Contacts | null>(path.join(base(), "player-private-contacts", `${playerId}.json`), null),
    readCampusParticipationMetrics(),
    readProfessionalCategories(),
    readJson<Participant[]>(path.join(base(), "milestone-participants.json"), []),
    readJson<Milestone[]>(path.join(base(), "milestones.json"), []),
    readManualSelectionCallups(),
  ]);
  let player = players.find((item) => item.id === playerId);
  // Newly created players may not yet be present in the local import files.
  if (!player) {
    const db = catalogServiceClient();
    const storedPlayer = await db.from("catalog_players").select("id,first_name,last_name").eq("id", playerId).maybeSingle();
    if (storedPlayer.error) throw new Error("No se ha podido cargar el jugador desde la base de datos.");
    if (!storedPlayer.data) return null;
    const [storedProfile, storedSeasons] = await Promise.all([
      db.schema("app_private").from("player_profiles").select("*").eq("player_id", playerId).maybeSingle(),
      db.schema("app_private").from("player_seasons").select("*").eq("player_id", playerId),
    ]);
    if ((storedProfile.error && storedProfile.error.code !== "PGRST106") || (storedSeasons.error && storedSeasons.error.code !== "PGRST106")) throw new Error("No se han podido cargar los datos privados del jugador.");
    Object.assign(profiles, storedProfile.data ?? {});
    player = { ...storedPlayer.data, category: null, birth_year: null };
    seasons.push(...(storedSeasons.data ?? []) as Season[]);
  }
  const categories = await readSeasonCategories(playerId);
  const competitionCategories = await readCompetitionCategories(playerId);
  const deletedYears = new Set(await readJson<number[]>(path.join(base(), "player-season-deletions", `${playerId}.json`), []));
  const playerSeasons = seasons
    .filter((item) => item.player_id === playerId && !deletedYears.has(item.season_year))
    .map((season) => ({
      ...season,
      club_name: season.club_id ? clubs.find((club) => club.id === season.club_id)?.name ?? season.legacy_club_name : season.legacy_club_name,
      playing_category: categories[String(season.season_year)] || null,
      competition_category: competitionCategories[String(season.season_year)] || null,
    }))
    .sort((left, right) => right.season_year - left.season_year);
  const current = playerSeasons[0] ?? null;
  const seasonPhotoYears: number[] = [];
  try {
    for (const name of await readdir(path.join(base(), "player-season-photos", playerId))) {
      const match = name.match(/^(20\d{2})\.png$/);
      if (match) seasonPhotoYears.push(Number(match[1]));
    }
  } catch {
    // The player may not have season photos yet.
  }
  let profilePhotoUrl: string | null = null;
  let coverPhotoUrl: string | null = null;
  let primaryPhotoSeason: string | null = null;
  if (seasonPhotoYears.length) {
    const latest = Math.max(...seasonPhotoYears);
    profilePhotoUrl = `/api/jugadores/foto/${playerId}?season=${latest}&v=review`;
  } else {
    try {
      await access(path.join(base(), "player-photos", "prepared", `${playerId}.png`));
      profilePhotoUrl = `/api/jugadores/foto/${playerId}?v=review`;
    } catch {
      profilePhotoUrl = null;
    }
  }
  try {
    await access(path.join(process.cwd(), "public", "player-covers", `${playerId}.webp`));
    coverPhotoUrl = `/api/jugadores/portada/${playerId}?v=review`;
  } catch {
    coverPhotoUrl = null;
  }
  try {
    const storedPrimary = JSON.parse(await readFile(path.join(base(), "player-season-photos", playerId, "primary.json"), "utf8")) as { season?: unknown };
    primaryPhotoSeason = typeof storedPrimary.season === "string" && /^20\d{2}$/.test(storedPrimary.season) ? storedPrimary.season : null;
  } catch {
    primaryPhotoSeason = seasonPhotoYears.length ? String(Math.max(...seasonPhotoYears)) : null;
  }
  const participantIds = new Set(participants.filter((participant) => participant.player_id === playerId).map((participant) => participant.id));
  const selectionRecords = milestones.filter((milestone) => participantIds.has(milestone.participant_id)).map((milestone): SelectionRecord | null => {
    const federation_id = milestone.scope ? selectionFederationIds[milestone.scope] : null;
    if (!federation_id) return null;
    return { id: milestone.id, player_id: playerId, player_name: null, federation_id, scope: milestone.scope, category: milestone.category, format: null, season_label: milestone.season_label, club_text: milestone.club_text, position_text: milestone.position_text, source: "milestone", manual_override_id: null, notes: null };
  }).filter(Boolean) as SelectionRecord[];
  const publication = await readHitoPublication();
  const selections = applyManualSelectionCallups(selectionRecords, manualSelectionCallups)
    .filter((selection) => selection.player_id === playerId && isHitoPublished(publication, selection.id))
    .map((selection) => ({
      federation_id: selection.federation_id,
      scope: selection.scope,
      category: selection.category,
      format: selection.format,
      season_label: selection.season_label,
      club_text: selection.club_text,
    }))
    .sort((left, right) => String(right.season_label ?? "").localeCompare(String(left.season_label ?? ""), "es"));
  const professional_club_records = trajectoryProfessionalClubs(playerSeasons, clubs, campusCategories);

  return {
    player: {
      ...player,
      birth_date: typeof profiles.birth_date === "string" ? profiles.birth_date : null,
      nickname: await readPlayerNickname(playerId),
      club_id: current?.club_id ?? null,
      category: typeof profiles.category === "string" ? profiles.category : player.category,
      birth_year: typeof profiles.birth_year === "number" ? profiles.birth_year : player.birth_year,
      dni: typeof profiles.dni === "string" ? profiles.dni : player.dni ?? null,
      instagram: typeof profiles.instagram === "string" ? profiles.instagram : null,
      height_cm: typeof profiles.height_cm === "number" ? profiles.height_cm : current?.height_cm ?? null,
      weight_kg: typeof profiles.weight_kg === "number" ? profiles.weight_kg : current?.weight_kg ?? null,
      allergies: typeof profiles.allergies === "string" ? profiles.allergies : null,
      dietary_conditions: typeof profiles.dietary_conditions === "string" ? profiles.dietary_conditions : null,
      medications: typeof profiles.medications === "string" ? profiles.medications : null,
    },
    event_sizes: await readPlayerEventSizes(playerId),
    career: await readPlayerCareer(playerId),
    staff_options: await readStaffOptions(),
    billing: await readPlayerBilling(playerId),
    private_consents: await readPlayerPrivateConsents(playerId),
    current_season: current,
    seasons: playerSeasons
      .filter((season) => Boolean(season.competition_category || season.playing_category || season.club_name || season.legacy_club_name || season.position_text))
      .map((season) => ({
        ...season,
        photo_url: seasonPhotoYears.includes(season.season_year) ? `/api/jugadores/foto/${playerId}?season=${season.season_year}&v=review` : null,
      })),
    clubs: clubs.map((club) => ({ id: club.id, name: club.name })).sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" })),
    campus_types: campusCategories.filter((category) => category.type === "CAMP").map((category) => ({ id: category.id, label: category.label, siglas: category.siglas ?? null })).sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" })),
    professional_categories: campusCategories.filter((category) => category.type !== "CAMP").map((category) => ({ id: category.id, label: category.label, siglas: category.siglas ?? null })).sort((left, right) => left.label.localeCompare(right.label, "es", { sensitivity: "base" })),
    participations: (() => {
      const metric = participationMetrics.find((item) => item.player_id === playerId);
      const campusByYear = metric?.participation_campus ?? metric?.participation_campuses ?? {};
      return (metric?.participation_years ?? []).map((year) => ({ year, campus: campusByYear[year] ?? "" })).sort((left, right) => Number(right.year) - Number(left.year));
    })(),
    selections,
    professional_club_records,
    contacts,
    profile_photo_url: profilePhotoUrl,
    cover_photo_url: coverPhotoUrl,
    primary_photo_season: primaryPhotoSeason,
  };
}

export async function readLatestPlayerReviewSubmission(token: PlayerEditToken) {
  if (usesRemoteReviewStorage()) return readRemoteReview(token);
  const root = await outboxRoot();
  let latest: { submitted_at: string; payload: Record<string, unknown> } | null = null;
  try {
    for (const directory of await readdir(/*turbopackIgnore: true*/ root)) {
      const submission = await readJson<Record<string, unknown> | null>(path.join(root, directory, "submission.json"), null);
      if (!submission || submission.token !== token.token || submission.player_id !== token.player_id || typeof submission.submitted_at !== "string") continue;
      const payload = submission.payload && typeof submission.payload === "object" ? submission.payload as Record<string, unknown> : null;
      if (!payload) continue;
      if (!latest || Date.parse(submission.submitted_at) > Date.parse(latest.submitted_at)) latest = { submitted_at: submission.submitted_at, payload };
    }
  } catch {
    return null;
  }
  return latest;
}

async function applyReviewChanges(token: PlayerEditToken, payload: Record<string, unknown>) {
  const player = payload.player as Record<string, unknown> | undefined;
  const contacts = payload.contacts as Record<string, unknown> | undefined;
  if (!player || !contacts) throw new Error("Faltan los datos de la ficha.");
  const text = (input: unknown, limit: number) => typeof input === "string" ? input.trim().slice(0, limit) || null : null;
  const number = (input: unknown, min: number, max: number) => typeof input === "number" && Number.isFinite(input) && input >= min && input <= max ? input : null;
  const birth = parseBirthInput(player.birth_date ?? player.birth_year);
  if (!birth) throw new Error("Indica nacimiento como AAAA o DD/MM/AAAA.");
  const firstName = text(player.first_name, 100);
  if (!firstName) throw new Error("El nombre es obligatorio.");
  const db = catalogServiceClient();
  const now = new Date().toISOString();
  const stored = await db.from("catalog_players").select("id").eq("id", token.player_id).maybeSingle();
  if (stored.error) throw new Error("No se ha podido comprobar el jugador.");
  const databaseId = stored.data?.id ?? token.player_id.replace(/^JUG/, "CTR");
  const name = await db.from("catalog_players").update({ first_name: firstName, last_name: text(player.last_name, 160), updated_at: now }).eq("id", databaseId);
  if (name.error) throw new Error("No se ha podido actualizar el nombre del jugador.");
  const profile = await db.schema("app_private").from("player_profiles").upsert({
    player_id: databaseId, category: text(player.category, 8), birth_year: number(player.birth_year, 1900, 2035), instagram: text(player.instagram, 120), dni: text(player.dni, 32), allergies: text(player.allergies, 2000), dietary_conditions: text(player.dietary_conditions, 2000), medications: text(player.medications, 2000), updated_at: now,
  });
  if (profile.error && profile.error.code !== "PGRST106") throw new Error("No se ha podido actualizar el perfil privado.");
  const contact = await db.schema("app_private").from("player_private_contacts").upsert({
    player_id: databaseId, player_email: text(contacts.player_email, 320), player_phone_e164: text(contacts.player_phone_e164, 32), tutor1_name: text(contacts.tutor1_name, 160), tutor1_email: text(contacts.tutor1_email, 320), tutor1_phone_e164: text(contacts.tutor1_phone_e164, 32), tutor2_name: text(contacts.tutor2_name, 160), tutor2_email: text(contacts.tutor2_email, 320), tutor2_phone_e164: text(contacts.tutor2_phone_e164, 32), updated_at: now,
  });
  if (contact.error && !["PGRST106", "42501"].includes(contact.error.code)) throw new Error("No se han podido actualizar los datos de contacto.");
  await savePlayerProfileOverride(token.player_id, {birth_date:birth.birth_date,category: text(player.category, 8), birth_year: number(player.birth_year, 1900, 2035), instagram: text(player.instagram, 120), dni: text(player.dni, 32), allergies: text(player.allergies, 2000), dietary_conditions: text(player.dietary_conditions, 2000), medications: text(player.medications, 2000)});
  const profileFile = path.join(base(), "player-profiles", token.player_id + ".json");
  const localProfile = await readJson<Record<string, unknown>>(profileFile, {});
  await writeFile(profileFile, JSON.stringify({...localProfile, height_cm: number(player.height_cm, 1, 250), weight_kg: number(player.weight_kg, 1, 260), position_text: text(player.position_text, 240)}) + "\n", "utf8");
  const localContacts = Object.fromEntries(["player_email", "player_phone_e164", "tutor1_name", "tutor1_email", "tutor1_phone_e164", "tutor2_name", "tutor2_email", "tutor2_phone_e164"].map(field => [field, text(contacts[field], field.includes("email") ? 320 : 160)])) as LocalPlayerContacts;
  await saveLocalPlayerContacts(token.player_id, localContacts);
  if (player.nickname !== undefined) await savePlayerNickname(token.player_id, text(player.nickname, 80));
  if (payload.event_sizes !== undefined) {
    const sizes = parsePlayerEventSizes(payload.event_sizes);
    if (!sizes) throw new Error("Revisa las tallas del jugador.");
    await savePlayerEventSizes(token.player_id, sizes);
  }
  if (payload.career && typeof payload.career === "object") {
    const career = payload.career as {retired?: unknown; staff_id?: unknown};
    if (typeof career.retired !== "boolean" || (career.staff_id !== null && (typeof career.staff_id !== "string" || !(await readStaffOptions()).some(item => item.id === career.staff_id)))) throw new Error("Revisa la situación y la ficha de staff.");
    await savePlayerCareer(token.player_id, {retired: career.retired, staff_id: career.staff_id as string | null});
  }
  const directoryFile = path.join(base(), "players.json");
  const directory = await readJson<Array<Record<string, unknown>>>(directoryFile, []);
  const directoryPlayer = directory.find(item => item.id === token.player_id);
  if (directoryPlayer) Object.assign(directoryPlayer, {first_name: firstName, last_name: text(player.last_name, 160), category: text(player.category, 8), birth_year: number(player.birth_year, 1900, 2035)});
  await writeFile(directoryFile, JSON.stringify(directory, null, 2) + "\n", "utf8");
  const seasonsFile = path.join(base(), "player-seasons.json");
  const seasons = await readJson<Array<Record<string, unknown>>>(seasonsFile, []);
  const latestSeason = seasons.filter(item => item.player_id === token.player_id).sort((a,b) => Number(b.season_year)-Number(a.season_year))[0];
  if (latestSeason) Object.assign(latestSeason, {height_cm: number(player.height_cm, 1, 250), weight_kg: number(player.weight_kg, 1, 260), position_text: text(player.position_text, 240), ...(player.club_id !== undefined ? {club_id: text(player.club_id, 20)} : {})});
  else if (player.club_id || player.position_text || player.height_cm || player.weight_kg) seasons.push({player_id: token.player_id, season_year: currentRugbySeasonYear(), club_id: text(player.club_id, 20), position_text: text(player.position_text, 240), height_cm: number(player.height_cm, 1, 250), weight_kg: number(player.weight_kg, 1, 260)});
  await writeFile(seasonsFile, JSON.stringify(seasons, null, 2) + "\n", "utf8");
  const billing = parseBilling(payload.billing);
  if (billing) await savePlayerBilling(token.player_id, billing);
  const consent = payload.private_consents;
  if (consent && typeof consent === "object" && !Array.isArray(consent)) {
    const values = consent as Record<string, unknown>;
    await savePlayerPrivateConsents(token.player_id, { food: values.food === true, medical: values.medical === true, technical: values.technical === true });
  }
}

export async function savePlayerReviewSubmission(token: PlayerEditToken, payload: Record<string, unknown>, files: Array<{ field: string; filename: string; bytes: Buffer; type: string }>, generatedPdf?: Buffer) {
  const submittedAt = new Date().toISOString();
  const safeTime = submittedAt.replace(/[:.]/g, "-");
  const pdf = generatedPdf ?? await createPlayerReviewPdf(token.player_id, submittedAt, payload);
  const pdfFilename = playerPdfFilename(token.player_id, new Date(submittedAt));
  if (usesRemoteReviewStorage()) {
    const saved = await saveRemoteReview(token, payload, files, `${safeTime}_${randomUUID()}`, submittedAt, pdf, pdfFilename);
    await applyReviewChanges(token, payload);
    const data = await loadLocalPlayerReviewData(token.player_id);
    const refreshed = await catalogServiceClient().storage.from(process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private").upload("player-review-data/" + token.player_id + ".json", JSON.stringify(data), {contentType: "application/json", upsert: true, cacheControl: "0"});
    if (refreshed.error) throw new Error("Los datos se han guardado, pero no se ha podido actualizar la ficha privada.");
    return saved;
  }
  const folder = path.join(await outboxRoot(), `${safeTime}_${token.player_id}_${randomUUID().slice(0, 8)}`);
  const imageFolder = path.join(folder, "imagenes");
  const driveConfig = await readJson<DriveOutboxConfig | null>(path.join(base(), "player-edit-drive-config.json"), null);
  await mkdir(imageFolder, { recursive: true });
  await writeFile(path.join(folder, pdfFilename), pdf);
  const savedFiles = [];
  for (const [index, file] of files.entries()) {
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const name = `${String(index + 1).padStart(2, "0")}_${file.field}.${extension}`;
    await writeFile(path.join(imageFolder, name), file.bytes);
    savedFiles.push({ field: file.field, filename: name, original_filename: file.filename, type: file.type, size: file.bytes.length });
  }
  await writeFile(path.join(folder, "submission.json"), `${JSON.stringify({
    player_id: token.player_id,
    token: token.token,
    submitted_at: submittedAt,
    status: "pending_import",
    drive_target: driveConfig,
    payload,
    files: savedFiles,
  }, null, 2)}\n`, "utf8");
  await applyReviewChanges(token, payload);
  return { folder, submitted_at: submittedAt, files: savedFiles.length };
}
