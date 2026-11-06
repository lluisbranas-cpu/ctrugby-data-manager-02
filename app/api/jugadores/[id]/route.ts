import { parseBirthInput } from "@/lib/birth-date";
import { normalizePhone } from "@/lib/phone-number";
import { readPlayerCareer, readStaffOptions, savePlayerCareer } from "@/lib/player-career";
import { currentClubSeason, currentRugbySeasonYear } from "@/lib/current-club";
import { readPlayerNickname, savePlayerNickname } from "@/lib/player-nicknames";
import { readCampusMetricsJson, readCampusParticipationMetrics, saveCampusParticipationMetrics } from "@/lib/campus-participations";
import { readHitoPublication, isHitoPublished } from "@/lib/hito-publication";
import { callupLinkKey, legacyCallupLinkKey, readCallupLinks, readMilestoneSourceUrls, validSourceUrl } from "@/lib/player-callup-links";
import { trajectoryProfessionalClubs } from "@/app/lib/trajectory-professional-clubs";
import { requireConsultation } from "@/lib/consultation-access";
import { privatePlayerAccess } from "@/lib/private-player-access";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogClient, catalogConfigured, localAdminAccess, sameOrigin } from "@/lib/catalog";
import { readSeasonCategories, saveSeasonCategories, readCompetitionCategories, saveCompetitionCategories } from "@/lib/player-season-categories";
import { readPlayerProfileOverride, savePlayerProfileOverride } from "@/lib/player-profile-overrides";
import { readLocalPlayerContacts, saveLocalPlayerContacts } from "@/lib/player-private-contacts";
import { readPlayerPrivateConsents, savePlayerPrivateConsents } from "@/lib/player-private-consent";
import { mergeMilestoneTrajectory, mergeStoredPlayerTrajectory } from "@/lib/milestone-trajectory";
import { applyManualSelectionCallups, readManualSelectionCallups, selectionFederationIds, type SelectionRecord } from "@/lib/manual-selection-callups";
import { readProfessionalCategories } from "@/lib/professional-club-milestones";

import { readPlayerEventSizes, parsePlayerEventSizes, savePlayerEventSizes } from "@/lib/player-event-sizes";
import { readPlayerBilling, savePlayerBilling, parseBilling } from "@/lib/player-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Player = { id:string; first_name:string; last_name:string|null; category:string|null; birth_year:number|null; dni?:string|null };
type Season = { player_id?:string; season_year:number; registration_number?:string|null; club_id:string|null; legacy_club_name:string|null; position_text:string|null; weight_kg:number|null; height_cm:number|null; club_name?:string|null; playing_category?:string|null; competition_category?:string|null };
type Metric = { player_id:string; participation_count:number; participation_years:string[]; participation_campus?:Record<string,string>; participation_campuses?:Record<string,string>; participation_registration_numbers?:Record<string,string>; participation_email_enabled?:boolean; participation_pending_year?:boolean };
type Milestone = { id: string; participant_id:string; scope:string; category:string; season_label:string; club_text:string|null; position_text:string|null };
type Participant = { id:string; player_id:string|null };
type PlayerData = {birth_date?:string|null; nickname?:string|null; first_name:string; last_name:string|null; club_id:string|null; position_text:string|null; weight_kg:number|null; height_cm:number|null; category:string|null; birth_year:number|null; instagram:string|null; dni:string|null; allergies:string|null; dietary_conditions:string|null; medications:string|null };
type PlayerContacts = { player_email:string|null; player_phone_e164:string|null; tutor1_name:string|null; tutor1_email:string|null; tutor1_phone_e164:string|null; tutor2_name:string|null; tutor2_email:string|null; tutor2_phone_e164:string|null; updated_at?:string|null };
type ContactKind = "player" | "tutor1" | "tutor2";
const federationIds = selectionFederationIds;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control":"private, no-store", Vary:"Cookie" } });
const validId = (id: string) => /^JUG\d{4}$/.test(id);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validParticipationYear = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (/^\d{4}$/.test(text)) return Number(text) >= 2000 && Number(text) <= 2035;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return false;
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  return Number(match[1]) >= 1 && Number(match[1]) <= 31 && Number(match[2]) >= 1 && Number(match[2]) <= 12 && year >= 2000 && year <= 2035;
};
const normalizeEmail = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
const cleanContactText = (value: unknown, maximum = 120) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
const cleanPlayerName = (value: unknown, maximum = 120) => typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : "";
const cleanLongText = (value: unknown, maximum = 500) => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, " ").slice(0, maximum) : null;
const cleanDni = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().replace(/\s+/g, "").toUpperCase().slice(0, 32) : null;
const normalizePersonName = (firstName: string | null | undefined, lastName: string | null | undefined) => [firstName, lastName].filter(Boolean).join(" ").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/\s+/g, " ");
const blankContacts = (): PlayerContacts => ({ player_email:null, player_phone_e164:null, tutor1_name:null, tutor1_email:null, tutor1_phone_e164:null, tutor2_name:null, tutor2_email:null, tutor2_phone_e164:null });
const contactCredentials = (contacts: PlayerContacts, kind: ContactKind) => kind === "player"
  ? { email: contacts.player_email, phone: contacts.player_phone_e164, label: "jugador" }
  : kind === "tutor1"
    ? { email: contacts.tutor1_email, phone: contacts.tutor1_phone_e164, label: "tutor 1" }
    : { email: contacts.tutor2_email, phone: contacts.tutor2_phone_e164, label: "tutor 2" };
const asContacts = (value: unknown): PlayerContacts | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const contacts: PlayerContacts = {
    player_email: normalizeEmail(data.player_email),
    player_phone_e164: normalizePhone(data.player_phone_e164),
    tutor1_name: cleanContactText(data.tutor1_name),
    tutor1_email: normalizeEmail(data.tutor1_email),
    tutor1_phone_e164: normalizePhone(data.tutor1_phone_e164),
    tutor2_name: cleanContactText(data.tutor2_name),
    tutor2_email: normalizeEmail(data.tutor2_email),
    tutor2_phone_e164: normalizePhone(data.tutor2_phone_e164),
  };
  const emails = [contacts.player_email, contacts.tutor1_email, contacts.tutor2_email].filter(Boolean);
  const phones = [contacts.player_phone_e164, contacts.tutor1_phone_e164, contacts.tutor2_phone_e164].filter(Boolean);
  if (emails.some((email) => !emailPattern.test(email!)) || phones.some((phone) => !/^\+[1-9][0-9]{7,14}$/.test(phone!))) return null;
  return contacts;
};
async function createOrFindPortalUser(email: string, phone: string) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!process.env.SUPABASE_URL || !serviceRoleKey) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para crear accesos privados.");
  const service = createClient(process.env.SUPABASE_URL, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const users = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error("No se ha podido revisar las cuentas privadas.");
  const existing = users.data.users.find((user) => user.email?.trim().toLowerCase() === email);
  if (existing) {
    const updated = await service.auth.admin.updateUserById(existing.id, { phone, phone_confirm: true, user_metadata: { ...(existing.user_metadata ?? {}), ctrugby_portal: true } });
    if (updated.error) throw new Error("No se ha podido actualizar la cuenta privada.");
    return updated.data.user;
  }
  const created = await service.auth.admin.createUser({ email, phone, email_confirm: true, phone_confirm: true, user_metadata: { ctrugby_portal: true } });
  if (created.error || !created.data.user) throw new Error("No se ha podido crear la cuenta privada.");
  return created.data.user;
}
const asSeason = (value: unknown): Season | null => {
  if (!value || typeof value !== "object") return null;
  const season = value as Record<string, unknown>; const year = Number(season.season_year);
  if (!Number.isInteger(year) || year < 2000 || year > 2035) return null;
  if (season.competition_category !== undefined && season.competition_category !== null && (typeof season.competition_category !== "string" || season.competition_category.length > 240)) return null;
  if (season.playing_category !== undefined && season.playing_category !== null && (typeof season.playing_category !== "string" || season.playing_category.length > 40)) return null;
  if (season.registration_number !== undefined && season.registration_number !== null && (typeof season.registration_number !== "string" || season.registration_number.length > 40)) return null;
  return { competition_category: typeof season.competition_category === "string" ? season.competition_category.trim() || null : season.competition_category === null ? null : undefined, season_year: year, registration_number: typeof season.registration_number === "string" ? season.registration_number.trim() || null : season.registration_number === null ? null : undefined, club_id: typeof season.club_id === "string" ? season.club_id : null, legacy_club_name: typeof season.legacy_club_name === "string" ? season.legacy_club_name : null, position_text: typeof season.position_text === "string" ? season.position_text : null, weight_kg: typeof season.weight_kg === "number" && Number.isFinite(season.weight_kg) ? season.weight_kg : null, height_cm: typeof season.height_cm === "number" && Number.isFinite(season.height_cm) ? season.height_cm : null, playing_category: typeof season.playing_category === "string" ? season.playing_category.trim() || null : season.playing_category === null ? null : undefined };
};
const resolveSeasons = (seasons: Season[], clubs: Map<string, string>) => seasons.map((season) => ({ ...season, club_name: season.club_name ?? (season.club_id ? clubs.get(season.club_id) ?? season.legacy_club_name : season.legacy_club_name) })).sort((a, b) => b.season_year - a.season_year);
const asPlayerData = (value: unknown): PlayerData | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.nickname !== undefined && data.nickname !== null && (typeof data.nickname !== "string" || data.nickname.length > 80)) return null;
  const nickname = data.nickname === undefined ? undefined : cleanPlayerName(data.nickname, 80) || null;
  const first_name = cleanPlayerName(data.first_name, 100);
  const last_name = cleanPlayerName(data.last_name, 160) || null;
  const number = (field: "weight_kg" | "height_cm", maximum: number) => data[field] === null || data[field] === "" ? null : typeof data[field] === "number" && Number.isFinite(data[field]) && data[field] > 0 && data[field] <= maximum ? data[field] : undefined;
  const weight_kg = number("weight_kg", 250); const height_cm = number("height_cm", 250);
  const birth = parseBirthInput(data.birth_date ?? data.birth_year);
  if (!birth) return null;
  const birth_year = birth.birth_year;
  const instagram = data.instagram === null || data.instagram === "" || data.instagram === undefined ? null : typeof data.instagram === "string" ? data.instagram.trim() : undefined;
  const dni = cleanDni(data.dni);
  const allergies = cleanLongText(data.allergies);
  const dietary_conditions = cleanLongText(data.dietary_conditions);
  const medications = cleanLongText(data.medications);
  if (!first_name || weight_kg === undefined || height_cm === undefined || birth_year === undefined || instagram === undefined || (data.club_id !== null && data.club_id !== undefined && typeof data.club_id !== "string") || (data.position_text !== null && data.position_text !== undefined && typeof data.position_text !== "string") || (data.category !== null && data.category !== undefined && typeof data.category !== "string")) return null;
  const category = typeof data.category === "string" && data.category ? data.category : null;
  if (category !== null && !["M", "F"].includes(category)) return null;
  if (instagram !== null && !/^@[^@\s]+$/.test(instagram)) return null;
  return { birth_date: birth.birth_date, nickname, first_name, last_name, club_id: typeof data.club_id === "string" && data.club_id ? data.club_id : null, position_text: typeof data.position_text === "string" && data.position_text.trim() ? data.position_text.trim() : null, weight_kg, height_cm, category, birth_year, instagram, dni, allergies, dietary_conditions, medications };
};
async function updateLocalPlayerName(id: string, first_name: string, last_name: string | null) {
  try {
    const playersPath = path.join(process.cwd(), "data", "staging", "players.json");
    const players = JSON.parse(await readFile(playersPath, "utf8")) as Array<Player & { published?: boolean; version?: number }>;
    if (!players.some((player) => player.id === id)) return;
    await writeFile(playersPath, `${JSON.stringify(players.map((player) => player.id === id ? { ...player, first_name, last_name } : player), null, 2)}\n`, "utf8");
  } catch {
    // Local staging data is auxiliary; the catalog update is the source of truth.
  }
}
async function saveLocalPlayerSeasons(id: string, seasons: Season[]) {
  const seasonsPath = path.join(process.cwd(), "data", "staging", "player-seasons.json");
  const current = JSON.parse(await readFile(seasonsPath, "utf8")) as Season[];
  const next = [
    ...current.filter((season) => season.player_id !== id),
    ...seasons.map((season) => ({ ...season, player_id: id })),
  ].sort((left, right) => String(left.player_id ?? "").localeCompare(String(right.player_id ?? ""), "es") || left.season_year - right.season_year);
  const temporary = seasonsPath + "." + randomUUID() + ".tmp";
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(temporary, seasonsPath);
}
const deletedSeasonsFilename = (id: string) => path.join(process.cwd(), "data", "staging", "player-season-deletions", `${id}.json`);
async function readDeletedLocalPlayerSeasons(id: string) {
  try {
    const years = JSON.parse(await readFile(deletedSeasonsFilename(id), "utf8")) as unknown;
    return new Set(Array.isArray(years) ? years.filter((year): year is number => Number.isInteger(year)) : []);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set<number>();
    throw error;
  }
}
async function saveDeletedLocalPlayerSeasons(id: string, years: Set<number>) {
  const target = deletedSeasonsFilename(id);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify([...years].sort((a, b) => a - b), null, 2)}\n`, "utf8");
  await rename(temporary, target);
}
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const id=(await params).id.toUpperCase(); if(!validId(id)) return reply({error:"Jugador no válido."},400); if(!catalogConfigured()) return reply({configured:false},503);
  try {
    const {db,admin}=await catalogAccess(request);
    const localAdmin = localAdminAccess(request);
    const privateAccessTask = admin ? Promise.resolve(true) : privatePlayerAccess(request, id);
    const base=path.join(process.cwd(),"data","staging");
    const [found,privateAccess,privateProfile,playersRaw,metricsRaw,milestonesRaw,participantsRaw,clubsRaw,playerSeasonsRaw,clubsResult,campusCategories,profileOverride,profileResult,trajectoryResult,manualSelectionCallups,callupLinks,localFederationsRaw,sourceUrls,publication,categories,competitionCategories]=await Promise.all([
      db.from("catalog_players").select("id,first_name,last_name,published,version").eq("id",id).maybeSingle(),
      privateAccessTask,
      privateAccessTask.then((allowed) => allowed && !admin ? db.rpc("app_player_private_profile", { p_player_id: id }) : null),
      readFile(path.join(base,"players.json"),"utf8"), readCampusMetricsJson(), readFile(path.join(base,"milestones.json"),"utf8"), readFile(path.join(base,"milestone-participants.json"),"utf8"), readFile(path.join(base,"clubs.json"),"utf8"), readFile(path.join(base,"player-seasons.json"),"utf8"), db.from("catalog_clubs").select("id,name"),
      readProfessionalCategories(),
      readPlayerProfileOverride(id),
      admin ? db.schema("app_private").from("player_profiles").select("category,birth_year,instagram,dni,allergies,dietary_conditions,medications").eq("player_id", id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      db.rpc("player_trajectory_public",{p_player_id:id}),
      readManualSelectionCallups(), readCallupLinks(id),
      readFile(path.join(base, "federations.json"), "utf8").catch(() => "[]"), readMilestoneSourceUrls(),
      readHitoPublication(), readSeasonCategories(id), readCompetitionCategories(id),
    ]);
    const staged=(JSON.parse(playersRaw) as Player[]).find(player=>player.id===id);
    const player = found.data ?? (localAdmin && staged ? { id: staged.id, first_name: staged.first_name, last_name: staged.last_name, published: true, version: 1 } : null);
    if(found.error||!player) return reply({error:"Jugador no encontrado."},404);
    if (privateProfile?.error) return reply({ error: "No se han podido cargar los datos privados de la ficha." }, 503);
    if(trajectoryResult.error) return reply({error:"No se ha podido leer la trayectoria del jugador. Comprueba la migración de trayectorias."},503);
    // The database is the shared source of truth. Local files remain only as
    // backward-compatible fallbacks for profiles that have not yet migrated.
    const privateFields = Array.isArray(privateProfile?.data) ? privateProfile.data[0] : null;
    const profile = profileResult.data ? { ...profileOverride, ...profileResult.data } : privateFields ? { ...profileOverride, ...privateFields } : profileOverride;
    const localClubs = JSON.parse(clubsRaw) as { id: string; name: string }[];
    const allClubs = [...localClubs, ...(clubsResult.data ?? []).filter((club) => !localClubs.some((localClub) => localClub.id === club.id))];
    const clubs=new Map(allClubs.map(club=>[club.id,club.name]));
    const participantIds=new Set((JSON.parse(participantsRaw) as Participant[]).filter(participant=>participant.player_id===id).map(participant=>participant.id));
    const allMilestones = JSON.parse(milestonesRaw) as Milestone[];
    const playerParticipants = [...participantIds].map((participantId) => ({ id: participantId, player_id: id }));
    const trajectoryByYear = new Map(((trajectoryResult.data ?? []) as Season[]).map((season) => [season.season_year, { ...season, player_id: season.player_id ?? id }]));
    for (const season of (JSON.parse(playerSeasonsRaw) as Season[]).filter((item) => item.player_id === id)) trajectoryByYear.set(season.season_year, { ...season, player_id: id });
    const trajectorySeasons = [...trajectoryByYear.values()];
    const deletedYears = await readDeletedLocalPlayerSeasons(id);
    const seasons=resolveSeasons(mergeMilestoneTrajectory(trajectorySeasons, allMilestones, playerParticipants, allClubs).filter((season) => !deletedYears.has(season.season_year)),clubs);
    const seasonPhotos = await Promise.all(seasons.map(async (season) => {
      const filename = path.join(base, "player-season-photos", id, `${season.season_year}.png`);
      try { await access(filename); return season.season_year; } catch { return null; }
    }));
    let primarySeason: number | null = null;
    try { primarySeason = Number((JSON.parse(await readFile(path.join(base, "player-season-photos", id, "primary.json"), "utf8")) as { season?: number }).season) || null; } catch { primarySeason = null; }
    const seasonsWithPhotos = seasons.map((season) => ({ ...season, playing_category: categories[String(season.season_year)] || null, competition_category: competitionCategories[String(season.season_year)] || null, season_photo_url: seasonPhotos.includes(season.season_year) ? "/api/jugadores/foto/" + id + "?season=" + season.season_year + "&v=20260928" : null, season_photo_primary: primarySeason === season.season_year }));
    let contacts = blankContacts();
    if (admin) {
      const contactsResult = await db.schema("app_private").from("player_private_contacts").select("*").eq("player_id", id).maybeSingle();
      const savedLocalContacts = localAdmin ? await readLocalPlayerContacts(id) : null;
      if (savedLocalContacts) contacts = {...contacts,...savedLocalContacts};
      else if (!contactsResult.error && contactsResult.data) contacts = { ...contacts, ...(contactsResult.data as Partial<PlayerContacts>) };
      else {
        const localContacts = await readLocalPlayerContacts(id);
        if (localContacts) contacts = { ...contacts, ...localContacts };
      }
    }
    const metricRaw=(JSON.parse(metricsRaw) as Metric[]).find(metric=>metric.player_id===id);
    const metric = metricRaw ? { ...metricRaw, participation_campus: metricRaw.participation_campus ?? metricRaw.participation_campuses ?? undefined, participation_campuses: undefined, participation_registration_numbers: metricRaw.participation_registration_numbers ?? {} } : undefined;
    const selectionRecords = allMilestones.filter(milestone=>participantIds.has(milestone.participant_id)).map((milestone): SelectionRecord | null => {
      const federation_id = federationIds[milestone.scope] ?? null;
      if (!federation_id) return null;
      return { id: milestone.id, player_id: id, player_name: null, federation_id, scope: milestone.scope, category: milestone.category, format: null, season_label: milestone.season_label, club_text: milestone.club_text, position_text: milestone.position_text, source: "milestone", manual_override_id: null, notes: null };
    }).filter(Boolean) as SelectionRecord[];
    const localFederations = JSON.parse(localFederationsRaw) as {id: string; website?: string | null}[];
    const federationWebsites = new Map(localFederations.map((item) => [item.id, validSourceUrl(item.website)]));
    const selections=applyManualSelectionCallups(selectionRecords, manualSelectionCallups).filter(selection=>selection.player_id===id && isHitoPublished(publication, selection.id)).map(selection=>({ ...selection, participant_id: selection.id, source_key: callupLinkKey(selection), source_url: validSourceUrl(callupLinks[callupLinkKey(selection)]) || validSourceUrl(callupLinks[legacyCallupLinkKey(selection)]) || sourceUrls.get(selection.id) || null, federation_website: federationWebsites.get(selection.federation_id) || null }));
    const professionalCategories = campusCategories;
    const professional_club_records = trajectoryProfessionalClubs(seasonsWithPhotos, allClubs, professionalCategories);
    return reply({configured:true,admin,career:await readPlayerCareer(id),staff_options:admin ? await readStaffOptions() : [],private_access:privateAccess,event_sizes:(admin || privateAccess) ? await readPlayerEventSizes(id) : null,player:{...player,nickname:await readPlayerNickname(id),category:profile?.category??staged?.category??null,birth_year:profile?.birth_year??staged?.birth_year??null,birth_date:privateAccess ? profileOverride?.birth_date??null : null,instagram:profile?.instagram??null,dni:admin ? profile?.dni ?? staged?.dni ?? null : null,allergies:privateAccess ? profile?.allergies??null : null,dietary_conditions:privateAccess ? profile?.dietary_conditions??null : null,medications:privateAccess ? profile?.medications??null : null},current_season:seasonsWithPhotos[0]??null,seasons:seasonsWithPhotos,professional_category_references:professionalCategories,professional_categories:professionalCategories.filter(category=>category.type!=="CAMP").map(category=>category.label),clubs:admin?(clubsResult.data??[]):[],contacts:admin?contacts:null,billing:admin?await readPlayerBilling(id):null,private_consents:admin ? await readPlayerPrivateConsents(id) : null,participation:metric??{participation_count:0,participation_years:[]},campuses:campusCategories.filter((category)=>category.type==="CAMP").map(category=>({id:category.id,label:category.label,siglas:category.siglas??null})),selections,professional_club_records});
  } catch { return reply({error:"No se ha podido cargar la ficha del jugador."},503); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{id:string}> }) {
  const id=(await params).id.toUpperCase(); if(!validId(id)) return reply({error:"Jugador no válido."},400); if(!sameOrigin(request)) return reply({error:"Origen no permitido."},403); if(!catalogConfigured()) return reply({error:"El catálogo todavía no está conectado."},503);
  try {
    const {db,admin}=await catalogAccess(request); if(!admin) return reply({error:"Acceso de administrador requerido."},403);
    const localAdmin = localAdminAccess(request);
    // Local previews use the JUG directory, matching the displayed player profile.
    const findPlayer = async () => {
      if (localAdmin) {
        const players = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8")) as Player[];
        return {data: players.find(player => player.id === id) ?? null, error: null};
      }
      return db.from("catalog_players").select("id").eq("id", id).maybeSingle();
    };
    const body=await request.json() as {seasons?:unknown;season?:unknown;participations?:unknown;playerData?:unknown;playerContacts?:unknown;billing?:unknown;billingContact?:unknown;eventSizes?:unknown;privateConsent?:unknown;provisionAccess?:unknown;privatePlayerData?:unknown};
    if (body.privatePlayerData !== undefined) {
      if (!body.privatePlayerData || typeof body.privatePlayerData !== "object" || Array.isArray(body.privatePlayerData)) return reply({error:"Datos privados no válidos."},400);
      const input = body.privatePlayerData as Record<string, unknown>;
      const fields = ["dni", "instagram", "allergies", "medications", "player_email", "player_phone_e164"];
      if (fields.some(field => input[field] !== null && typeof input[field] !== "string")) return reply({error:"Datos privados no válidos."},400);
      const instagram = cleanContactText(input.instagram,120);
      if (instagram && !/^@[^@\s]+$/.test(instagram)) return reply({error:"Instagram debe empezar por @ y no contener espacios."},400);
      const contactInput = asContacts({...blankContacts(), player_email: input.player_email, player_phone_e164: input.player_phone_e164});
      if (!contactInput) return reply({error:"Revisa el correo y el teléfono del jugador. Usa formato internacional, por ejemplo +34600111222."},400);
      const found = await findPlayer();
      if (found.error || !found.data) return reply({error:"Jugador no encontrado."},404);
      const storedProfile = localAdmin
        ? JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "player-profiles", id + ".json"), "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return "{}"; throw error; }))
        : await readPlayerProfileOverride(id) ?? {};
      const profile = {...storedProfile, dni: cleanDni(input.dni), instagram, allergies: cleanLongText(input.allergies), medications: cleanLongText(input.medications)};
      const existingContacts = await readLocalPlayerContacts(id);
      const contacts = {...blankContacts(), ...existingContacts, player_email: contactInput.player_email, player_phone_e164: contactInput.player_phone_e164};
      if (!localAdmin) {
        const savedProfile = await db.schema("app_private").from("player_profiles").upsert({player_id:id, dni:profile.dni, instagram:profile.instagram, allergies:profile.allergies, medications:profile.medications, updated_at:new Date().toISOString()});
        if (savedProfile.error) return reply({error:"No se han podido guardar los datos privados."},503);
        const savedContacts = await db.rpc("admin_upsert_player_private_contacts", {p_player_id:id, p_player_email:contacts.player_email, p_player_phone_e164:contacts.player_phone_e164, p_tutor1_name:contacts.tutor1_name, p_tutor1_email:contacts.tutor1_email, p_tutor1_phone_e164:contacts.tutor1_phone_e164, p_tutor2_name:contacts.tutor2_name, p_tutor2_email:contacts.tutor2_email, p_tutor2_phone_e164:contacts.tutor2_phone_e164});
        if (savedContacts.error) return reply({error:"No se han podido guardar los contactos privados."},503);
      }
      await savePlayerProfileOverride(id,profile);
      const savedContacts = await saveLocalPlayerContacts(id,contacts);
      return reply({ok:true,private_player_data:{dni:profile.dni,instagram:profile.instagram,allergies:profile.allergies,medications:profile.medications},contacts:savedContacts});
    }
    if (body.privateConsent !== undefined) { const consent = body.privateConsent as { kind?: unknown; value?: unknown }; if (!consent || !["food", "medical", "technical"].includes(String(consent.kind)) || typeof consent.value !== "boolean") return reply({error:"La autorización no es válida."},400); const current = await readPlayerPrivateConsents(id); const kind = consent.kind as "food" | "medical" | "technical"; return reply({ok:true,private_consents:await savePlayerPrivateConsents(id, { ...current, [kind]: consent.value })}); }
    if (body.eventSizes !== undefined) {
      const sizes = parsePlayerEventSizes(body.eventSizes);
      if (!sizes) return reply({error:"Revisa las tallas (máximo 30 caracteres por campo)."},400);
      const found = await findPlayer();
      if (found.error || !found.data) return reply({error:"Jugador no encontrado."},404);
      return reply({ok:true,event_sizes:await savePlayerEventSizes(id,sizes)});
    }
    if (body.billing !== undefined) {
      const billing = parseBilling(body.billing);
      if (!billing) return reply({error:"Revisa los datos de facturación y la longitud de los campos."},400);
      if (!billing.dni.trim() || billing.dni.length > 20) return reply({error:"Indica el DNI del titular de facturación (máximo 20 caracteres)."},400);
      billing.dni = billing.dni.toUpperCase();
      const found = await findPlayer();
      if (found.error || !found.data) return reply({error:"Jugador no encontrado."},404);
      let savedContacts: PlayerContacts | undefined;
      if (body.billingContact !== undefined) {
        if (!body.billingContact || typeof body.billingContact !== "object" || Array.isArray(body.billingContact)) return reply({error:"Datos del titular no válidos."},400);
        const input = body.billingContact as Record<string, unknown>;
        const parsed = asContacts({...blankContacts(),tutor1_name:billing.full_name,tutor1_email:input.email,tutor1_phone_e164:input.phone});
        if (!parsed) return reply({error:"Revisa el correo y el teléfono del titular."},400);
        const currentContacts = await readLocalPlayerContacts(id);
        savedContacts = {...blankContacts(),...currentContacts,tutor1_name:parsed.tutor1_name,tutor1_email:parsed.tutor1_email,tutor1_phone_e164:parsed.tutor1_phone_e164};
      }
      const savedBilling = await savePlayerBilling(id,billing);
      if (savedContacts) await saveLocalPlayerContacts(id,savedContacts);
      return reply({ok:true,billing:savedBilling,...(savedContacts ? {contacts:savedContacts} : {})});
    }
    if (body.participations !== undefined) {
      const payload = body.participations;
      const entries = Array.isArray(payload) ? payload : payload && typeof payload === "object" && Array.isArray((payload as { entries?: unknown }).entries) ? (payload as { entries: unknown[] }).entries : null;
      if (!entries) return reply({error:"Las participaciones no tienen un formato válido."},400);
      const participations = entries.map((entry) => entry && typeof entry === "object" ? entry as { year?: unknown; campus?: unknown } : null);
      if (participations.some((entry) => !entry || !validParticipationYear(entry.year) || typeof entry.campus !== "string" || !entry.campus.trim() || ((entry as { registration_number?: unknown }).registration_number !== undefined && typeof (entry as { registration_number?: unknown }).registration_number !== "string")) || new Set(participations.map((entry) => String(entry!.year))).size !== participations.length) return reply({error:"Cada participación debe tener un año o fecha válida, campus y registro válidos."},400);
      const manualCount = !Array.isArray(payload) && payload && typeof payload === "object" ? Number((payload as { participation_count?: unknown }).participation_count) : participations.length;
      const pendingYear = !Array.isArray(payload) && payload && typeof payload === "object" ? Boolean((payload as { participation_pending_year?: unknown }).participation_pending_year) : false;
      if (!Number.isInteger(manualCount) || manualCount < participations.length || manualCount > 99) return reply({error:"El número de participaciones no es válido."},400);
      if (manualCount > participations.length && !pendingYear) return reply({error:"Marca pendiente identificar año para participaciones sin edición conocida."},400);
      const metrics = await readCampusParticipationMetrics();
      const participation_years = participations.map((entry) => String(entry!.year));
      const participation_campus = Object.fromEntries(participations.map((entry) => [String(entry!.year), String(entry!.campus).trim()]));
      const currentMetric = metrics.find((metric) => metric.player_id === id);
      const participation_registration_numbers = Object.fromEntries(participations.flatMap((entry) => {
        const registration = String((entry as { registration_number?: unknown }).registration_number ?? "").trim().toUpperCase();
        return registration ? [[String(entry!.year), registration]] : [];
      }));
      const nextMetric: Metric = { player_id: id, participation_count: manualCount, participation_years, participation_campus, ...(Object.keys(participation_registration_numbers).length ? { participation_registration_numbers } : {}), ...(currentMetric?.participation_email_enabled === false ? { participation_email_enabled: false } : {}), ...(pendingYear ? { participation_pending_year: true } : {}) };
      const nextMetrics = metrics.some((metric) => metric.player_id === id) ? metrics.map((metric) => metric.player_id === id ? nextMetric : metric) : [...metrics, nextMetric];
      await saveCampusParticipationMetrics(nextMetrics, metrics);
      return reply({ok:true,participation:nextMetric});
    }
    if (body.playerData !== undefined) {
      if (!body.playerData || typeof body.playerData !== "object") return reply({error:"Datos de jugador no válidos."},400);
      const input = body.playerData as { retired?: unknown; staff_id?: unknown };
      if (input.retired !== undefined && typeof input.retired !== "boolean") return reply({error:"Estado de retirada no válido."},400);
      const career = await readPlayerCareer(id);
      const nextCareer = { retired: input.retired === undefined ? career.retired : input.retired as boolean, staff_id: input.staff_id === undefined ? career.staff_id : input.staff_id as string | null };
      if (nextCareer.staff_id !== null && (typeof nextCareer.staff_id !== "string" || !(await readStaffOptions()).some(p => p.id === nextCareer.staff_id))) return reply({error:"Ficha de staff no válida."},400);
      const playerData = asPlayerData(body.playerData); if (!playerData) return reply({error:"Los datos del jugador no son válidos."},400);
      const base=path.join(process.cwd(),"data","staging");
      const [trajectoryResult, clubsResult, milestonesRaw, participantsRaw, clubsRaw, storedSeasonsRaw, deletedYears] = await Promise.all([
        db.rpc("player_trajectory_public",{p_player_id:id}),
        db.from("catalog_clubs").select("id,name"),
        readFile(path.join(base,"milestones.json"),"utf8"),
        readFile(path.join(base,"milestone-participants.json"),"utf8"),
        readFile(path.join(base,"clubs.json"),"utf8"),
        readFile(path.join(base,"player-seasons.json"),"utf8"),
        readDeletedLocalPlayerSeasons(id),
      ]);
      if (trajectoryResult.error) return reply({error:"No se ha podido leer la trayectoria actual."},503);
      const localClubs = JSON.parse(clubsRaw) as { id: string; name: string }[];
      const allClubs = [...localClubs, ...(clubsResult.data ?? []).filter((club) => !localClubs.some((localClub) => localClub.id === club.id))];
      const clubs = new Map(allClubs.map(club=>[club.id,club.name]));
      if (playerData.club_id && !clubs.has(playerData.club_id)) return reply({error:"El club seleccionado no existe."},400);
      if (!localAdmin) {
        const existingPlayers = await db.from("catalog_players").select("id,first_name,last_name");
        if (existingPlayers.error) return reply({error:"No se ha podido comprobar el nombre del jugador."},503);
        const submittedName = normalizePersonName(playerData.first_name, playerData.last_name);
        const duplicatePlayer = (existingPlayers.data ?? []).find((player) => player.id !== id && normalizePersonName(player.first_name, player.last_name) === submittedName);
        if (duplicatePlayer) return reply({error:`Ya existe un jugador con ese nombre (${duplicatePlayer.id}). Revisa la ficha existente antes de cambiarlo.`},409);
        const nameUpdate = await db.from("catalog_players").update({ first_name: playerData.first_name, last_name: playerData.last_name, updated_at: new Date().toISOString() }).eq("id", id).select("id");
        if (nameUpdate.error) return reply({error:nameUpdate.error.message || "No se ha podido guardar el nombre del jugador."},503);
      }
      await updateLocalPlayerName(id, playerData.first_name, playerData.last_name);
      const rawSeasons: (Season | null)[] = ((trajectoryResult.data ?? []) as unknown[]).map(asSeason);
      if (rawSeasons.some((season)=>!season)) return reply({error:"La trayectoria actual no tiene un formato válido."},400);
      const participantIds=new Set((JSON.parse(participantsRaw) as Participant[]).filter(participant=>participant.player_id===id).map(participant=>participant.id));
      const playerParticipants = [...participantIds].map((participantId) => ({ id: participantId, player_id: id }));
      const allMilestones = JSON.parse(milestonesRaw) as Milestone[];
      const storedSeasons = JSON.parse(storedSeasonsRaw) as Season[];
      const visibleSeasons = mergeStoredPlayerTrajectory(rawSeasons as Season[], storedSeasons, id);
      const seasons = mergeMilestoneTrajectory(visibleSeasons, allMilestones, playerParticipants, allClubs).filter((season) => !deletedYears.has(season.season_year));
      if (!seasons.length && (playerData.club_id || playerData.position_text || playerData.height_cm !== null || playerData.weight_kg !== null)) {
        seasons.push({player_id:id,season_year:currentRugbySeasonYear(),club_id:nextCareer.retired ? null : playerData.club_id,legacy_club_name:null,position_text:playerData.position_text,height_cm:playerData.height_cm,weight_kg:playerData.weight_kg});
      }
      const profilePayload = { player_id: id, category: playerData.category, birth_year: playerData.birth_year, instagram: playerData.instagram, dni: playerData.dni, allergies: playerData.allergies, dietary_conditions: playerData.dietary_conditions, medications: playerData.medications, updated_at: new Date().toISOString() };
      const savedProfile = localAdmin ? {data:profilePayload,error:null} : await db.schema("app_private").from("player_profiles").upsert(profilePayload).select("category,birth_year,instagram,dni,allergies,dietary_conditions,medications").maybeSingle();
      if (savedProfile.error || !savedProfile.data) return reply({error:savedProfile.error?.message || "No se ha podido guardar el perfil privado del jugador."},503);
      const profile = {...savedProfile.data,birth_date:playerData.birth_date};
      await savePlayerProfileOverride(id, profile);
      if (playerData.nickname !== undefined) await savePlayerNickname(id, playerData.nickname);
      const found=localAdmin ? await findPlayer() : await db.from("catalog_players").select("id,first_name,last_name,published,version").eq("id",id).maybeSingle();
      if(found.error||!found.data) return reply({error:"No se ha podido recargar la ficha del jugador."},503);
      const categories = await readSeasonCategories(id);
    const competitionCategories = await readCompetitionCategories(id);
      if (!seasons.length) { await savePlayerCareer(id, nextCareer); return reply({ok:true,career:nextCareer,player:{...found.data,nickname:await readPlayerNickname(id),category:profile.category,birth_year:profile.birth_year,birth_date:profile.birth_date,instagram:profile.instagram,dni:profile.dni,allergies:profile.allergies,dietary_conditions:profile.dietary_conditions,medications:profile.medications},current_season:null,seasons:[]}); }
      const latestYear = Math.max(...seasons.map((season)=>season.season_year));
      const clubYear = currentClubSeason(seasons)?.season_year ?? latestYear;
      const nextSeasons = seasons.map((season) => ({
        ...season,
        ...(!nextCareer.retired && season.season_year === clubYear ? { club_id: playerData.club_id, legacy_club_name: playerData.club_id ? null : season.legacy_club_name } : {}),
        ...(season.season_year === latestYear ? { position_text: playerData.position_text, weight_kg: playerData.weight_kg, height_cm: playerData.height_cm } : {}),
      }));
      if (localAdmin) await saveLocalPlayerSeasons(id, nextSeasons);
      else {
        const saved=await db.rpc("admin_replace_player_trajectory",{p_player_id:id,p_seasons:nextSeasons}); if(saved.error) return reply({error:saved.error.message||"No se han podido guardar los datos del jugador."},503);
      }
      const resolved = resolveSeasons(nextSeasons,clubs).map((season) => ({ ...season, playing_category: categories[String(season.season_year)] || null, competition_category: competitionCategories[String(season.season_year)] || null }));
      await savePlayerCareer(id, nextCareer);
      return reply({ok:true,career:nextCareer,player:{...found.data,nickname:await readPlayerNickname(id),category:profile.category,birth_year:profile.birth_year,birth_date:profile.birth_date,instagram:profile.instagram,dni:profile.dni,allergies:profile.allergies,dietary_conditions:profile.dietary_conditions,medications:profile.medications},current_season:resolved[0],seasons:resolved});
    }
    if (body.playerContacts !== undefined) {
      const contacts = asContacts(body.playerContacts); if (!contacts) return reply({error:"Los contactos privados no son válidos. Usa correos válidos y teléfonos internacionales tipo +34600111222."},400);
      if (localAdmin && body.provisionAccess === undefined) {
        const found = await findPlayer();
        if (found.error || !found.data) return reply({error:"Jugador no encontrado."},404);
        return reply({ok:true,contacts:await saveLocalPlayerContacts(id,contacts)});
      }
      const saved = await db.rpc("admin_upsert_player_private_contacts", {
        p_player_id: id,
        p_player_email: contacts.player_email,
        p_player_phone_e164: contacts.player_phone_e164,
        p_tutor1_name: contacts.tutor1_name,
        p_tutor1_email: contacts.tutor1_email,
        p_tutor1_phone_e164: contacts.tutor1_phone_e164,
        p_tutor2_name: contacts.tutor2_name,
        p_tutor2_email: contacts.tutor2_email,
        p_tutor2_phone_e164: contacts.tutor2_phone_e164,
      });
      if (saved.error) {
        const savedLocalContacts = await saveLocalPlayerContacts(id, contacts);
        return reply({ok:true,contacts:savedLocalContacts});
      }
      const savedContacts = { ...blankContacts(), ...(Array.isArray(saved.data) ? saved.data[0] : saved.data) } as PlayerContacts;
      await saveLocalPlayerContacts(id, savedContacts);
      const accessKind = typeof body.provisionAccess === "string" && ["player", "tutor1", "tutor2"].includes(body.provisionAccess) ? body.provisionAccess as ContactKind : null;
      if (!accessKind) return reply({ok:true,contacts:savedContacts});
      const credentials = contactCredentials(savedContacts, accessKind);
      if (!credentials.email || !credentials.phone) return reply({error:`Indica correo y teléfono del ${credentials.label} antes de crear el acceso.`},400);
      try {
        const user = await createOrFindPortalUser(credentials.email, credentials.phone);
        const linked = await db.rpc("app_link_portal_account", { p_user_id: user.id, p_subject_kind: "player", p_subject_id: id, p_phone_e164: credentials.phone });
        if (linked.error) throw new Error(linked.error.message || "No se ha podido vincular la cuenta privada.");
        const recovery = await catalogClient().auth.resetPasswordForEmail(credentials.email, { redirectTo: new URL("/restablecer", request.nextUrl.origin).toString() });
        if (recovery.error) throw new Error("La cuenta queda vinculada, pero no se ha podido enviar el correo para crear contraseña.");
        return reply({ok:true,contacts:savedContacts,access:{email:credentials.email,kind:accessKind}});
      } catch (cause) {
        return reply({error:cause instanceof Error ? cause.message : "No se ha podido crear el acceso privado."},503);
      }
    }
    const base = path.join(process.cwd(), "data", "staging");
    const [current, localSeasonsRaw, milestonesRaw, participantsRaw, clubsRaw, deletedYears, clubsResult] = await Promise.all([
      db.rpc("player_trajectory_public", { p_player_id: id }),
      readFile(path.join(base, "player-seasons.json"), "utf8"),
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
      readFile(path.join(base, "clubs.json"), "utf8"),
      readDeletedLocalPlayerSeasons(id),
      db.from("catalog_clubs").select("id,name"),
    ]);
    if (current.error) return reply({ error: "No se ha podido leer la trayectoria actual." }, 503);
    const localClubs = JSON.parse(clubsRaw) as { id: string; name: string }[];
    const allClubs = [...localClubs, ...(clubsResult.data ?? []).filter((club) => !localClubs.some((item) => item.id === club.id))];
    const localByYear = new Map(((current.data ?? []) as Season[]).map((season) => [season.season_year, { ...season, player_id: id }]));
    for (const season of (JSON.parse(localSeasonsRaw) as Season[]).filter((item) => item.player_id === id)) localByYear.set(season.season_year, { ...season, player_id: id });
    // Use the same visible trajectory as GET, including history and prior deletions.
    const existing = mergeMilestoneTrajectory([...localByYear.values()], JSON.parse(milestonesRaw) as Milestone[], (JSON.parse(participantsRaw) as Participant[]).filter(participant => participant.player_id === id), allClubs).filter((season) => season.player_id === id && !deletedYears.has(season.season_year));
    let submitted = body.seasons;
    if (body.season !== undefined) {
      const edited = asSeason(body.season);
      if (!edited) return reply({ error: "La temporada no es válida." }, 400);
      const previous = existing.find((season) => season.season_year === edited.season_year);
      if (!previous) return reply({ error: "La temporada ya no existe. Recarga la ficha." }, 409);
      submitted = existing.map((season) => season.season_year === edited.season_year ? { ...edited, registration_number: edited.registration_number === undefined ? previous.registration_number : edited.registration_number } : season);
    }
    if (!Array.isArray(submitted)) return reply({ error: "La trayectoria no tiene un formato válido." }, 400);
    const parsed = submitted.map(asSeason);
    if (parsed.some((season) => !season) || new Set(parsed.map((season) => season!.season_year)).size !== parsed.length) return reply({ error: "Cada temporada debe ser única y válida." }, 400);
    const seasons = parsed as Season[];
    if (!localAdmin) {
      const saved = await db.rpc("admin_replace_player_trajectory", { p_player_id: id, p_seasons: seasons });
      if (saved.error) return reply({ error: saved.error.message || "No se ha podido guardar la trayectoria." }, 503);
    }
    if (body.seasons !== undefined) {
      const submittedYears = new Set(seasons.map((season) => season.season_year));
      for (const season of existing) if (!submittedYears.has(season.season_year)) deletedYears.add(season.season_year);
      for (const year of submittedYears) deletedYears.delete(year);
    }
    // GET and the directory overlay this file on the database, so update both stores.
    await saveLocalPlayerSeasons(id, seasons);
    await saveDeletedLocalPlayerSeasons(id, deletedYears);
    const categories = await saveSeasonCategories(id, seasons);
    const competitionCategories = await saveCompetitionCategories(id, seasons);
    return reply({ ok: true, seasons: resolveSeasons(seasons, new Map(allClubs.map((club) => [club.id, club.name]))).map((season) => ({ ...season, playing_category: categories[String(season.season_year)] || null, competition_category: competitionCategories[String(season.season_year)] || null })) });
  } catch { return reply({error:"No se ha podido procesar la trayectoria."},400); }
}



