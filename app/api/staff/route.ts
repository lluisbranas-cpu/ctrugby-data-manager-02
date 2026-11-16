import { playerCareerLinks } from "@/lib/player-career";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { readOperationalDocument, upsertOperationalDocument } from "@/lib/operational-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Staff = { id: string; first_name?: string | null; last_name?: string | null };
type Participant = { id: string; kind: "player" | "staff"; display_name: string; player_id: string | null; staff_id: string | null };
type Milestone = { id: string; participant_id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null };
type StaffMilestone = Omit<Milestone, "participant_id"> & { featured?: boolean };
type Source = { milestone_id: string; source_type: string; source_ctr_id: string | null; source_name: string };
type MilestonePatch = Partial<Pick<Milestone, "scope" | "category" | "season_label" | "club_text" | "position_text">>;
type ProfilePatch = {
  nickname?: string | null;
  first_name?: string;
  last_name?: string | null;
  nationality_country?: string | null;
  secondary_nationality_country?: string | null;
  section?: string | null;
  selected_roles?: string[];
  associated_kind?: string | null;
  associated_id?: string | null;
  headline?: string | null;
  location?: string | null;
  profile_status?: string | null;
  primary_role?: string | null;
  summary?: string | null;
  professional_trajectory?: string | null;
  technical_staff_experience?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
};
type FeaturedPatch = { staff_id?: string; milestone_id?: string; featured?: boolean };
type StaffProfile = {
  nickname?: string | null;
  staff_id: string | null;
  display_name?: string | null;
  nationality_country?: string | null;
  secondary_nationality_country?: string | null;
  section?: string | null;
  selected_roles?: string[];
  associated_kind?: string | null;
  associated_id?: string | null;
  headline?: string | null;
  location?: string | null;
  profile_status?: string | null;
  primary_role?: string | null;
  specialties?: string[];
  summary?: string | null;
  professional_trajectory?: string | null;
  technical_staff_experience?: string | null;
  profile_url?: string | null;
  source_url?: string | null;
  source_captured_at?: string | null;
  links?: { kind: string; url: string; label?: string | null }[];
  roles?: { organization?: string | null; title?: string | null; location?: string | null; start_label?: string | null; end_label?: string | null; source_url?: string | null }[];
  credentials?: { title: string; issuer?: string | null; date_label?: string | null }[];
  sources?: { source_type: string; source_url: string; source_label?: string | null; captured_at?: string | null; notes?: string | null }[];
  campus_participations?: Omit<StaffCampusParticipation, "staff_id">[];
};
type AssociatedOption = { kind: "club" | "campus" | "federation"; id: string; name: string; shield_url: string | null };
type Club = { id: string; name: string };
type Federation = { id: string; name: string };
type CategoryOption = { id: string; type?: string | null; label: string; country?: string | null };
type StaffPrivateData = { staff_id: string; email?: string | null; phone?: string | null };
type MotivationalPhrase = { id: string; text: string };
type StaffCredential = { title: string; issuer?: string | null; date_label?: string | null };
type StaffCampusParticipation = { staff_id: string; campus_id: string; year: number };

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const fullName = (person?: Staff) => [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() || "Staff";
const yearsFromLabel = (label: string | null | undefined) => [...new Set(String(label ?? "").match(/20\d{2}/g) ?? [])].map(Number);
const latestYear = (label: string | null | undefined) => Math.max(0, ...yearsFromLabel(label));
const readJsonArray = async <T,>(file: string) => JSON.parse(await readFile(file, "utf8").catch(() => "[]")) as T[];
const readStaffDocument = async <T,>(key: string, file: string, fallback: T, preferLocal = false) => {
  if (catalogConfigured() && !preferLocal) {
    const remote = await readOperationalDocument<T>("staff", key);
    if (remote) return remote.payload;
  }
  return JSON.parse(await readFile(file, "utf8").catch(() => JSON.stringify(fallback))) as T;
};
const saveStaffDocument = async (key: string, payload: unknown) => upsertOperationalDocument("staff", key, payload);
const defaultRoleCategories = ["Dirección técnica", "Entrenadores", "Árbitros y especialistas", "Especialistas clínic", "Jugadores formadores"];
const isLocalAdmin = (request: NextRequest) => ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
const clean = (value: unknown) => String(value ?? "").trim() || null;
const socialUrl = (value: unknown, network: "linkedin" | "instagram" | "facebook") => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  const handle = text.replace(/^@/, "");
  return network === "instagram" ? `https://www.instagram.com/${handle}/` : network === "facebook" ? `https://www.facebook.com/${handle}/` : text;
};
const associatedShieldUrl = (kind: string | null | undefined, id: string | null | undefined) => {
  if (!kind || !id) return null;
  if (kind === "club" && /^[A-Z]{3}\d{4}$/.test(id)) return `/api/clubs/escudo/${encodeURIComponent(id)}`;
  if (kind === "federation" && /^F[A-Z]\d{3}$/.test(id)) return `/api/federaciones/escudo/${encodeURIComponent(id)}`;
  if (kind === "campus" && /^[A-Z0-9-]{1,24}$/.test(id)) return `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo`;
  return null;
};
const associatedHref = (kind: string | null | undefined, id: string | null | undefined) => {
  if (!kind || !id) return null;
  if (kind === "club") return `/clubs/${encodeURIComponent(id)}`;
  if (kind === "federation") return `/federaciones/${encodeURIComponent(id)}`;
  if (kind === "campus") return "/categorias";
  return null;
};
const associatedLabel = (options: AssociatedOption[], kind: string | null | undefined, id: string | null | undefined) => options.find((option) => option.kind === kind && option.id === id)?.name ?? null;
const upsertLink = (links: StaffProfile["links"] | undefined, kind: string, url: string | null, label: string) => {
  const next = [...(links ?? []).filter((link) => link.kind !== kind)];
  if (url) next.push({ kind, url, label });
  return next;
};
const mergedProfile = (staffId: string, associatedOptions: AssociatedOption[], ctrugby?: StaffProfile, linkedin?: StaffProfile) => ({
  nickname: ctrugby?.nickname ?? null,
  associated_kind: ctrugby?.associated_kind ?? null,
  associated_id: ctrugby?.associated_id ?? null,
  associated_label: associatedLabel(associatedOptions, ctrugby?.associated_kind, ctrugby?.associated_id),
  associated_url: associatedHref(ctrugby?.associated_kind, ctrugby?.associated_id),
  associated_shield_url: associatedShieldUrl(ctrugby?.associated_kind, ctrugby?.associated_id),
  custom_associated_shield_url: `/api/staff/escudo/${staffId}`,
  section: ctrugby?.section ?? null,
  nationality_country: ctrugby?.nationality_country ?? null,
  secondary_nationality_country: ctrugby?.secondary_nationality_country ?? null,
  headline: linkedin?.headline ?? ctrugby?.headline ?? null,
  location: linkedin?.location ?? null,
  profile_status: linkedin?.profile_status ?? (ctrugby ? "ctrugby" : "draft"),
  primary_role: ctrugby?.primary_role ?? linkedin?.primary_role ?? null,
  specialties: [...new Set([...(ctrugby?.specialties ?? []), ...(linkedin?.specialties ?? [])])],
  summary: ctrugby?.summary ?? linkedin?.summary ?? null,
  professional_trajectory: ctrugby?.professional_trajectory ?? null,
  technical_staff_experience: ctrugby?.technical_staff_experience ?? null,
  ctrugby_url: ctrugby?.profile_url ?? ctrugby?.source_url ?? null,
  linkedin_url: linkedin?.links?.find((link) => link.kind === "linkedin")?.url ?? ctrugby?.links?.find((link) => link.kind === "linkedin")?.url ?? null,
  instagram_url: ctrugby?.links?.find((link) => link.kind === "instagram")?.url ?? linkedin?.links?.find((link) => link.kind === "instagram")?.url ?? null,
  facebook_url: ctrugby?.links?.find((link) => link.kind === "facebook")?.url ?? linkedin?.links?.find((link) => link.kind === "facebook")?.url ?? null,
  links: [...(ctrugby?.profile_url ? [{ kind: "ctrugby", url: ctrugby.profile_url, label: "Ficha CTRugby" }] : []), ...(ctrugby?.links ?? []), ...(linkedin?.links ?? [])],
  roles: [...(ctrugby?.roles ?? []), ...(ctrugby?.primary_role ? [{ organization: "CTRugby", title: ctrugby.primary_role, location: null, start_label: null, end_label: null, source_url: ctrugby.source_url ?? null }] : []), ...(linkedin?.roles ?? [])],
  credentials: [...(ctrugby?.credentials ?? []), ...(linkedin?.credentials ?? [])],
  sources: [
    ...(ctrugby ? [{ source_type: "ctrugby", source_url: ctrugby.source_url ?? "https://ctrugby.net/staff-ii/", source_label: "CTRugby", captured_at: ctrugby.source_captured_at ?? null, notes: "Perfil publico CTRugby" }] : []),
    ...(ctrugby?.sources ?? []), ...(linkedin?.sources ?? []),
  ],
});

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const catalog = catalogConfigured() ? await catalogAccess(request) : null;
    const admin = catalog?.admin ?? false;
    const localAdmin = isLocalAdmin(request);
    const root = path.join(process.cwd(), "data", "staging");
    const [staffRaw, participantsRaw, milestonesRaw, sourcesRaw, ctrugbyProfiles, linkedinProfiles, privateProfiles, featuredByStaff, roleCategories, roleAssignments, campusParticipations, clubs, federations, campuses, catalogClubs, motivationalPhrases, credentialsByStaff] = await Promise.all([
      readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []),
      readFile(path.join(root, "milestone-participants.json"), "utf8"),
      readFile(path.join(root, "milestones.json"), "utf8"),
      readFile(path.join(root, "milestone-sources.json"), "utf8").catch(() => "[]"),
      readStaffDocument<StaffProfile[]>("ctrugby-profiles", path.join(root, "staff-ctrugby-profiles.json"), []),
      readStaffDocument<StaffProfile[]>("linkedin-profiles", path.join(root, "staff-linkedin-profiles.json"), []),
      readStaffDocument<StaffPrivateData[]>("private-data", path.join(root, "staff-private-data.json"), []),
      readStaffDocument<Record<string, string[]>>("featured-milestones", path.join(root, "staff-featured-milestones.json"), {}),
      readStaffDocument<string[]>("role-categories", path.join(root, "staff-role-categories.json"), [], localAdmin).then((items) => items.length ? items : defaultRoleCategories),
      readStaffDocument<Record<string, string[]>>("role-assignments", path.join(root, "staff-role-assignments.json"), {}, localAdmin),
      readStaffDocument<StaffCampusParticipation[]>("campus-participations", path.join(root, "staff-campus-participations.json"), [], localAdmin),
      readJsonArray<Club>(path.join(root, "clubs.json")),
      readJsonArray<Federation>(path.join(root, "federations.json")),
      readJsonArray<CategoryOption>(path.join(root, "professional-categories.json")),
      catalog?.db.from("catalog_clubs").select("id,name").order("name") ?? Promise.resolve({ data: [] as Club[] }),
      readStaffDocument<Record<string, MotivationalPhrase[]>>("motivational-phrases", path.join(root, "staff-motivational-phrases.json"), {}, localAdmin),
      readStaffDocument<Record<string, StaffCredential[]>>("credentials", path.join(root, "staff-credentials.json"), {}, localAdmin),
    ]);
    for (const career of await playerCareerLinks()) {
      const url = "/jugadores/" + career.player_id;
      for (const profile of ctrugbyProfiles) profile.links = (profile.links ?? []).filter(link => !(link.kind === "player" && link.url === url));
      if (career.staff_id) {
        let profile = ctrugbyProfiles.find(profile => profile.staff_id === career.staff_id);
        if (!profile) { profile = { staff_id: career.staff_id }; ctrugbyProfiles.push(profile); }
        profile.links = [...(profile.links ?? []).filter(link => link.kind !== "player"), { kind: "player", url, label: "Ver ficha de jugador" }];
      }
    }
    const clubsById = new Map(clubs.map((club) => [club.id, club]));
    for (const club of catalogClubs.data ?? []) clubsById.set(club.id, club);
    const associatedOptions: AssociatedOption[] = [
      ...[...clubsById.values()].map((club) => ({ kind: "club" as const, id: club.id, name: club.name, shield_url: associatedShieldUrl("club", club.id) })),
      ...campuses.filter((category) => category.type === "FORM" || category.type === "CAMP").map((category) => ({ kind: "campus" as const, id: category.id, name: category.label, shield_url: associatedShieldUrl("campus", category.id) })),
      ...federations.map((federation) => ({ kind: "federation" as const, id: federation.id, name: federation.name, shield_url: associatedShieldUrl("federation", federation.id) })),
    ].sort((a, b) => a.kind.localeCompare(b.kind, "es") || a.name.localeCompare(b.name, "es"));
    const staff = staffRaw as Staff[];
    const participants = JSON.parse(participantsRaw) as Participant[];
    const milestones = JSON.parse(milestonesRaw) as Milestone[];
    const sources = JSON.parse(sourcesRaw) as Source[];
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));
    const staffIdByName = new Map(staff.map((person) => [fullName(person).toLocaleLowerCase("es-ES"), person.id]));
    const sourceByMilestone = new Map(sources.map((source) => [source.milestone_id, source]));
    const ctrugbyByStaff = new Map(ctrugbyProfiles.filter((profile) => profile.staff_id).map((profile) => [profile.staff_id!, profile]));
    const linkedinByStaff = new Map(linkedinProfiles.filter((profile) => profile.staff_id).map((profile) => [profile.staff_id!, profile]));
    const privateByStaff = new Map(privateProfiles.map((profile) => [profile.staff_id, profile]));
    const campusParticipationsByStaff = new Map<string, Omit<StaffCampusParticipation, "staff_id">[]>();
    for (const participation of campusParticipations) campusParticipationsByStaff.set(participation.staff_id, [...(campusParticipationsByStaff.get(participation.staff_id) ?? []), { campus_id: participation.campus_id, year: participation.year }]);
    const milestonesByStaff = new Map<string, Milestone[]>();

    for (const milestone of milestones) {
      const participant = participantById.get(milestone.participant_id);
      const source = sourceByMilestone.get(milestone.id);
      const staffId = participant?.staff_id
        ?? (participant?.kind === "staff" ? staffIdByName.get(participant.display_name.toLocaleLowerCase("es-ES")) : null)
        ?? (source?.source_type === "staff" ? source.source_ctr_id : null);
      if (!staffId) continue;
      milestonesByStaff.set(staffId, [...(milestonesByStaff.get(staffId) ?? []), milestone]);
    }

    const rows = staff.map((person) => {
      const personMilestones = [...(milestonesByStaff.get(person.id) ?? [])].sort((a, b) => latestYear(b.season_label) - latestYear(a.season_label));
      const scopeCounts = new Map<string, number>();
      const yearSet = new Set<number>();
      for (const milestone of personMilestones) {
        if (milestone.scope) scopeCounts.set(milestone.scope, (scopeCounts.get(milestone.scope) ?? 0) + 1);
        for (const year of yearsFromLabel(milestone.season_label)) yearSet.add(year);
      }
      return {
        id: person.id,
        first_name: person.first_name ?? "",
        last_name: person.last_name ?? null,
        display_name: fullName(person),
        milestone_count: personMilestones.length,
        latest_year: latestYear(personMilestones[0]?.season_label),
        seasons: [...yearSet].sort((a, b) => b - a),
        scopes: [...scopeCounts.entries()].map(([scope, count]) => ({ scope, count })).sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope, "es")),
        latest_milestone: personMilestones[0] ? {
          id: personMilestones[0].id,
          scope: personMilestones[0].scope,
          category: personMilestones[0].category,
          season_label: personMilestones[0].season_label,
          club_text: personMilestones[0].club_text,
          position_text: personMilestones[0].position_text,
        } : null,
        milestones: personMilestones.map((milestone) => ({
          id: milestone.id,
          scope: milestone.scope,
          category: milestone.category,
          season_label: milestone.season_label,
          club_text: milestone.club_text,
          position_text: milestone.position_text,
          featured: featuredByStaff[person.id]?.includes(milestone.id) ?? false,
        } satisfies StaffMilestone)),
        profile: (() => {
          const merged = mergedProfile(person.id, associatedOptions, ctrugbyByStaff.get(person.id), linkedinByStaff.get(person.id));
          const selectedRoles = roleAssignments[person.id] ?? (merged.section ? [merged.section] : []);
          const credentials = Object.prototype.hasOwnProperty.call(credentialsByStaff, person.id) ? credentialsByStaff[person.id] : merged.credentials;
          return { ...merged, credentials, section: selectedRoles[0] ?? null, selected_roles: selectedRoles, campus_participations: campusParticipationsByStaff.get(person.id) ?? [], motivational_phrases: motivationalPhrases[person.id] ?? [] };
        })(),
        private_data: admin ? privateByStaff.get(person.id) ?? null : null,
      };
    }).sort((a, b) => b.milestone_count - a.milestone_count || a.display_name.localeCompare(b.display_name, "es"));

    const yearSet = new Set(rows.flatMap((row) => row.seasons));
    const scopeMap = rows.reduce((map, row) => {
      for (const item of row.scopes) map.set(item.scope, (map.get(item.scope) ?? 0) + item.count);
      return map;
    }, new Map<string, number>());

    return reply({
      configured: true,
      admin,
      can_create: admin,
      summary: {
        staff: rows.length,
        with_milestones: rows.filter((row) => row.milestone_count > 0).length,
        milestones: rows.reduce((total, row) => total + row.milestone_count, 0),
        scopes: scopeMap.size,
      },
      years: [...yearSet].sort((a, b) => b - a).map((year) => ({
        year,
        staff: rows.filter((row) => row.seasons.includes(year)).length,
        milestones: [...milestonesByStaff.values()].flat().filter((milestone) => yearsFromLabel(milestone.season_label).includes(year)).length,
      })),
      scopes: [...scopeMap.entries()].map(([scope, count]) => ({ scope, count })).sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope, "es")),
      profile_imports: linkedinProfiles.filter((profile) => !profile.staff_id),
      staff_role_categories: roleCategories,
      associated_options: associatedOptions,
      staff: rows,
    });
  } catch {
    return reply({ error: "No se han podido cargar los datos de staff." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Solicitud no disponible." }, 403);
  if (!catalogConfigured() || !(await catalogAccess(request)).admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const body = await request.json() as { action?: string; id?: string } & MilestonePatch & ProfilePatch & FeaturedPatch;
    const creating = body.action === "create-profile";
    if (!body.id && !creating) return reply({ error: "Acción no disponible." }, 400);
    const localAdmin = isLocalAdmin(request);
    if (body.action === "update-motivational-phrases") {
      const staffId = clean(body.id);
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      const input = (body as { phrases?: unknown }).phrases;
      if (!Array.isArray(input) || input.length > 100) return reply({ error: "La lista de frases no es válida." }, 400);
      const phrases: MotivationalPhrase[] = [];
      for (const item of input) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return reply({ error: "Revisa las frases motivacionales." }, 400);
        const phrase = item as { id?: unknown; text?: unknown };
        const id = typeof phrase.id === "string" ? phrase.id.trim() : "";
        const text = typeof phrase.text === "string" ? phrase.text.trim() : "";
        if (!id || id.length > 80 || !text || text.length > 500) return reply({ error: "Cada frase debe tener un identificador y texto de hasta 500 caracteres." }, 400);
        phrases.push({ id, text });
      }
      if (new Set(phrases.map((phrase) => phrase.id)).size !== phrases.length) return reply({ error: "No se permiten frases duplicadas." }, 400);
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const file = path.join(root, "staff-motivational-phrases.json");
      const records = await readStaffDocument<Record<string, MotivationalPhrase[]>>("motivational-phrases", file, {}, localAdmin);
      records[staffId] = phrases;
      if (localAdmin) {
        await writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8");
      } else {
        await Promise.all([saveStaffDocument("motivational-phrases", records), writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8")]);
      }
      return reply({ ok: true, id: staffId, phrases });
    }
    if (body.action === "update-credentials") {
      const staffId = clean(body.id);
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      const input = (body as { credentials?: unknown }).credentials;
      if (!Array.isArray(input) || input.length > 100) return reply({ error: "La lista de acreditaciones no es válida." }, 400);
      const credentials: StaffCredential[] = [];
      for (const item of input) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return reply({ error: "Revisa las líneas de formación y acreditación." }, 400);
        const credential = item as { title?: unknown; issuer?: unknown; date_label?: unknown };
        const title = typeof credential.title === "string" ? credential.title.trim() : "";
        const issuer = clean(credential.issuer);
        const dateLabel = clean(credential.date_label);
        if (!title || title.length > 240 || (issuer?.length ?? 0) > 160 || (dateLabel?.length ?? 0) > 80) {
          return reply({ error: "Cada línea requiere un título de hasta 240 caracteres; revisa también entidad y fecha." }, 400);
        }
        credentials.push({ title, issuer, date_label: dateLabel });
      }
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const file = path.join(root, "staff-credentials.json");
      const records = await readStaffDocument<Record<string, StaffCredential[]>>("credentials", file, {}, localAdmin);
      records[staffId] = credentials;
      if (localAdmin) {
        await writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8");
      } else {
        await Promise.all([saveStaffDocument("credentials", records), writeFile(file, `${JSON.stringify(records, null, 2)}\n`, "utf8")]);
      }
      return reply({ ok: true, id: staffId, credentials });
    }
    if (body.action === "update-text-block") {
      const staffId = clean(body.id);
      const field = (body as { field?: unknown }).field;
      const value = (body as { value?: unknown }).value;
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      if (field !== "summary" && field !== "professional_trajectory" && field !== "technical_staff_experience") return reply({ error: "Bloque no válido." }, 400);
      if (typeof value !== "string" || value.length > 20_000) return reply({ error: "El contenido no es válido." }, 400);
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const profilesFile = path.join(root, "staff-ctrugby-profiles.json");
      const profiles = await readStaffDocument<StaffProfile[]>("ctrugby-profiles", profilesFile, []);
      const index = profiles.findIndex((profile) => profile.staff_id === staffId);
      const current = index >= 0 ? profiles[index] : { staff_id: staffId };
      const next = { ...current, staff_id: staffId, [field]: clean(value) } as StaffProfile;
      if (index >= 0) profiles[index] = next; else profiles.push(next);
      await Promise.all([saveStaffDocument("ctrugby-profiles", profiles), writeFile(profilesFile, `${JSON.stringify(profiles, null, 2)}\n`, "utf8")]);
      return reply({ ok: true, id: staffId });
    }
    if (body.action === "update-private") {
      const staffId = clean(body.id);
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      const email = clean((body as { email?: unknown }).email);
      const phone = clean((body as { phone?: unknown }).phone);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Indica un correo electrónico válido." }, 400);
      if (phone && !/^[+()\d\s.-]{6,30}$/.test(phone)) return reply({ error: "Indica un teléfono válido." }, 400);
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición privada no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const privateFile = path.join(root, "staff-private-data.json");
      const records = await readStaffDocument<StaffPrivateData[]>("private-data", privateFile, []);
      const next = { staff_id: staffId, email, phone };
      const index = records.findIndex((record) => record.staff_id === staffId);
      if (index >= 0) records[index] = next; else records.push(next);
      await Promise.all([saveStaffDocument("private-data", records), writeFile(privateFile, `${JSON.stringify(records, null, 2)}\n`, "utf8")]);
      return reply({ ok: true, id: staffId });
    }
    if (creating || body.action === "update-profile") {
      const firstName = clean(body.first_name);
      if (!firstName) return reply({ error: "Indica el nombre del miembro del staff." }, 400);
      const profilePatch: ProfilePatch = {
        nickname: clean(body.nickname),
        first_name: firstName,
        last_name: clean(body.last_name),
        nationality_country: clean(body.nationality_country),
        secondary_nationality_country: clean(body.secondary_nationality_country),
        section: body.section === undefined ? undefined : clean(body.section),
        associated_kind: clean(body.associated_kind),
        associated_id: clean(body.associated_id),
        headline: clean(body.headline),
        location: clean(body.location),
        profile_status: clean(body.profile_status) ?? "draft",
        primary_role: clean(body.primary_role),
        summary: clean(body.summary),
        professional_trajectory: clean(body.professional_trajectory),
        technical_staff_experience: clean(body.technical_staff_experience),
        linkedin_url: socialUrl(body.linkedin_url, "linkedin"),
        instagram_url: socialUrl(body.instagram_url, "instagram"),
        facebook_url: socialUrl(body.facebook_url, "facebook"),
      };
      if (!catalogConfigured()) {
        const { admin } = await catalogAccess(request);
        if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
        return reply({ error: "La edición de perfiles de staff todavía no está conectada al catálogo remoto." }, 501);
      }
      if (!catalogConfigured() && process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staffFile = path.join(root, "staff.json");
      const profilesFile = path.join(root, "staff-ctrugby-profiles.json");
      const staff = await readStaffDocument<Staff[]>("directory", staffFile, []);
      if (creating) {
        const nextNumber = Math.max(0, ...staff.map((person) => /^STF\d+$/.test(person.id) ? Number(person.id.slice(3)) : 0)) + 1;
        body.id = `STF${String(nextNumber).padStart(4, "0")}`;
        staff.push({ id: body.id, first_name: firstName, last_name: profilePatch.last_name });
      }
      if (!body.id) return reply({ error: "Miembro de staff no válido." }, 400);
      const staffIndex = staff.findIndex((person) => person.id === body.id);
      if (staffIndex < 0) return reply({ error: "Miembro de staff no encontrado." }, 404);
      staff[staffIndex] = { ...staff[staffIndex], first_name: profilePatch.first_name, last_name: profilePatch.last_name };
      const profiles = await readStaffDocument<StaffProfile[]>("ctrugby-profiles", profilesFile, []);
      const profileIndex = profiles.findIndex((profile) => profile.staff_id === body.id);
      const current = profileIndex >= 0 ? profiles[profileIndex] : { staff_id: body.id };
      const nextProfile: StaffProfile = {
        ...current,
        staff_id: body.id,
        display_name: [profilePatch.first_name, profilePatch.last_name].filter(Boolean).join(" "),
        nickname: profilePatch.nickname,
        nationality_country: profilePatch.nationality_country,
        secondary_nationality_country: profilePatch.secondary_nationality_country,
        ...(profilePatch.section === undefined ? {} : { section: profilePatch.section }),
        associated_kind: profilePatch.associated_id ? profilePatch.associated_kind : null,
        associated_id: profilePatch.associated_id ? profilePatch.associated_id : null,
        headline: profilePatch.headline,
        location: profilePatch.location,
        profile_status: profilePatch.profile_status,
        primary_role: profilePatch.primary_role,
        summary: profilePatch.summary,
        professional_trajectory: profilePatch.professional_trajectory,
        technical_staff_experience: profilePatch.technical_staff_experience,
        links: upsertLink(upsertLink(upsertLink(current.links, "linkedin", profilePatch.linkedin_url ?? null, "LinkedIn"), "instagram", profilePatch.instagram_url ?? null, "Instagram"), "facebook", profilePatch.facebook_url ?? null, "Facebook"),
      };
      if (profileIndex >= 0) profiles[profileIndex] = nextProfile;
      else profiles.push(nextProfile);
      await Promise.all([
        saveStaffDocument("directory", staff),
        saveStaffDocument("ctrugby-profiles", profiles),
        writeFile(staffFile, `${JSON.stringify(staff, null, 2)}\n`, "utf8"),
        writeFile(profilesFile, `${JSON.stringify(profiles, null, 2)}\n`, "utf8"),
      ]);
      return reply({ ok: true, id: body.id }, creating ? 201 : 200);
    }
    if (body.action === "toggle-featured-milestone") {
      if (!catalogConfigured()) {
        const { admin } = await catalogAccess(request);
        if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
        return reply({ error: "Los destacados de staff todavía no están conectados al catálogo remoto." }, 501);
      }
      if (!catalogConfigured() && process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
      const staffId = clean(body.staff_id);
      const milestoneId = clean(body.milestone_id);
      if (!staffId || !milestoneId) return reply({ error: "Hito no válido." }, 400);
      const file = path.join(process.cwd(), "data", "staging", "staff-featured-milestones.json");
      const featuredByStaff = await readStaffDocument<Record<string, string[]>>("featured-milestones", file, {});
      const current = new Set(featuredByStaff[staffId] ?? []);
      if (body.featured) current.add(milestoneId);
      else current.delete(milestoneId);
      featuredByStaff[staffId] = [...current].sort();
      await Promise.all([saveStaffDocument("featured-milestones", featuredByStaff), writeFile(file, `${JSON.stringify(featuredByStaff, null, 2)}\n`, "utf8")]);
      return reply({ ok: true });
    }
    if (body.action === "update-campus-participations") {
      const staffId = clean(body.id);
      const input = (body as { participations?: unknown }).participations;
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      if (!Array.isArray(input) || input.length > 100) return reply({ error: "La lista de participaciones no es válida." }, 400);
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const campusOptions = await readJsonArray<CategoryOption>(path.join(root, "professional-categories.json"));
      const campusIds = new Set(campusOptions.filter((campus) => campus.type === "FORM" || campus.type === "CAMP").map((campus) => campus.id));
      const participations: StaffCampusParticipation[] = [];
      for (const item of input) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return reply({ error: "Revisa las participaciones de campus." }, 400);
        const row = item as { campus_id?: unknown; year?: unknown };
        const campusId = typeof row.campus_id === "string" ? row.campus_id.trim() : "";
        const year = typeof row.year === "number" ? row.year : Number(row.year);
        if (!campusIds.has(campusId) || !Number.isInteger(year) || year < 1900 || year > 2100) return reply({ error: "Cada participación debe tener un campus y un año válidos." }, 400);
        participations.push({ staff_id: staffId, campus_id: campusId, year });
      }
      if (new Set(participations.map((row) => `${row.campus_id}:${row.year}`)).size !== participations.length) return reply({ error: "No se puede repetir el mismo campus y año." }, 400);
      const file = path.join(root, "staff-campus-participations.json");
      const records = await readStaffDocument<StaffCampusParticipation[]>("campus-participations", file, [], localAdmin);
      const next = [...records.filter((row) => row.staff_id !== staffId), ...participations];
      if (localAdmin) {
        await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
      } else {
        await Promise.all([saveStaffDocument("campus-participations", next), writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8")]);
      }
      return reply({ ok: true, id: staffId, participations: participations.map(({ campus_id, year }) => ({ campus_id, year })) });
    }
    if (body.action === "update-role-assignments") {
      const staffId = clean(body.id);
      const input = (body as { roles?: unknown }).roles;
      if (!staffId || !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro de staff no válido." }, 400);
      if (!Array.isArray(input) || input.length > 30 || input.some((role) => typeof role !== "string" || !role.trim() || role.trim().length > 120)) return reply({ error: "La selección de roles no es válida." }, 400);
      const roles = input.map((role) => (role as string).trim());
      if (new Set(roles.map((role) => role.toLocaleLowerCase("es-ES"))).size !== roles.length) return reply({ error: "No se permiten roles duplicados." }, 400);
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staff = await readStaffDocument<Staff[]>("directory", path.join(root, "staff.json"), []);
      if (!staff.some((person) => person.id === staffId)) return reply({ error: "Miembro de staff no encontrado." }, 404);
      const categories = await readStaffDocument<string[]>("role-categories", path.join(root, "staff-role-categories.json"), defaultRoleCategories, localAdmin);
      if (roles.some((role) => !categories.includes(role))) return reply({ error: "Selecciona roles de la tabla configurada en administración." }, 400);
      const file = path.join(root, "staff-role-assignments.json");
      const assignments = await readStaffDocument<Record<string, string[]>>("role-assignments", file, {}, localAdmin);
      assignments[staffId] = roles;
      if (localAdmin) {
        await writeFile(file, `${JSON.stringify(assignments, null, 2)}\n`, "utf8");
      } else {
        await Promise.all([saveStaffDocument("role-assignments", assignments), writeFile(file, `${JSON.stringify(assignments, null, 2)}\n`, "utf8")]);
      }
      return reply({ ok: true, id: staffId, roles });
    }
    if (body.action === "update-role-categories") {
      if (!catalogConfigured() && (!localAdmin || process.env.NODE_ENV === "production")) return reply({ error: "Edición local no disponible en producción." }, 403);
      const rawCategories = (body as { categories?: unknown }).categories;
      if (!Array.isArray(rawCategories) || rawCategories.some((role) => typeof role !== "string" || !role.trim() || role.trim().length > 120)) return reply({ error: "Revisa los nombres de los roles Rugby." }, 400);
      const categories = rawCategories.map((role) => (role as string).trim());
      if (!categories.length) return reply({ error: "Añade al menos un rol Rugby." }, 400);
      if (new Set(categories.map((role) => role.toLocaleLowerCase("es-ES"))).size !== categories.length) return reply({ error: "No se permiten nombres de rol duplicados." }, 400);
      const root = path.join(process.cwd(), "data", "staging");
      const categoriesFile = path.join(root, "staff-role-categories.json");
      const currentCategories = await readStaffDocument<string[]>("role-categories", categoriesFile, defaultRoleCategories, localAdmin);
      const inputRenames = (body as { renames?: unknown }).renames;
      if (inputRenames !== undefined && !Array.isArray(inputRenames)) return reply({ error: "La correspondencia de roles no es válida." }, 400);
      const renames = new Map<string, string>();
      for (const item of (inputRenames ?? []) as unknown[]) {
        if (!item || typeof item !== "object" || Array.isArray(item)) return reply({ error: "La correspondencia de roles no es válida." }, 400);
        const rename = item as { from?: unknown; to?: unknown };
        const from = typeof rename.from === "string" ? rename.from.trim() : "";
        const to = typeof rename.to === "string" ? rename.to.trim() : "";
        if (!currentCategories.includes(from) || !categories.includes(to) || renames.has(from)) return reply({ error: "No se ha podido validar el cambio de nombre de un rol." }, 400);
        renames.set(from, to);
      }
      const assignmentsFile = path.join(root, "staff-role-assignments.json");
      const profilesFile = path.join(root, "staff-ctrugby-profiles.json");
      const assignments = await readStaffDocument<Record<string, string[]>>("role-assignments", assignmentsFile, {}, localAdmin);
      const remoteProfiles = renames.size ? await readStaffDocument<StaffProfile[]>("ctrugby-profiles", profilesFile, []) : [];
      const localProfiles = renames.size && localAdmin ? await readStaffDocument<StaffProfile[]>("ctrugby-profiles", profilesFile, [], true) : [];
      const profilesByStaff = new Map(remoteProfiles.filter((profile) => profile.staff_id).map((profile) => [profile.staff_id!, profile]));
      for (const profile of localProfiles) if (profile.staff_id) profilesByStaff.set(profile.staff_id, profile);
      const profiles = [...profilesByStaff.values()];
      for (const [staffId, roles] of Object.entries(assignments)) {
        assignments[staffId] = roles.map((role) => renames.get(role) ?? role);
      }
      for (const profile of profiles) {
        if (profile.section && renames.has(profile.section)) {
          const renamed = renames.get(profile.section) ?? profile.section;
          if (localAdmin && profile.staff_id && !Object.prototype.hasOwnProperty.call(assignments, profile.staff_id)) assignments[profile.staff_id] = [renamed];
          profile.section = renamed;
        }
        if (profile.selected_roles) profile.selected_roles = profile.selected_roles.map((role) => renames.get(role) ?? role);
      }
      const writes: Promise<unknown>[] = [writeFile(categoriesFile, `${JSON.stringify(categories, null, 2)}\n`, "utf8")];
      if (!localAdmin) writes.push(saveStaffDocument("role-categories", categories));
      if (renames.size) {
        writes.push(writeFile(assignmentsFile, `${JSON.stringify(assignments, null, 2)}\n`, "utf8"));
        if (!localAdmin) writes.push(writeFile(profilesFile, `${JSON.stringify(profiles, null, 2)}\n`, "utf8"), saveStaffDocument("role-assignments", assignments), saveStaffDocument("ctrugby-profiles", profiles));
      }
      await Promise.all(writes);
      return reply({ ok: true, categories });
    }
    if (body.action !== "update-milestone") return reply({ error: "Acción no disponible." }, 400);
    const patch: MilestonePatch = {
      scope: body.scope?.trim() || null,
      category: body.category?.trim() || null,
      season_label: body.season_label?.trim() || null,
      club_text: body.club_text?.trim() || null,
      position_text: body.position_text?.trim() || null,
    };
    if (catalogConfigured()) {
      const { db, admin } = await catalogAccess(request);
      if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
      const result = await db.from("catalog_milestones").update(patch).eq("id", body.id);
      if (result.error) return reply({ error: result.error.message || "No se ha podido guardar el hito." }, 503);
      return reply({ ok: true });
    }
    if (!catalogConfigured() && process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
    const file = path.join(process.cwd(), "data", "staging", "milestones.json");
    const milestones = JSON.parse(await readFile(file, "utf8")) as Milestone[];
    const index = milestones.findIndex((milestone) => milestone.id === body.id);
    if (index < 0) return reply({ error: "Hito no encontrado." }, 404);
    milestones[index] = { ...milestones[index], ...patch };
    await writeFile(file, `${JSON.stringify(milestones, null, 2)}\n`, "utf8");
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se han podido guardar los datos de staff." }, 500);
  }
}
