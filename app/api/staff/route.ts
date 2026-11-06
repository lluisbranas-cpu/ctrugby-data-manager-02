import { playerCareerLinks } from "@/lib/player-career";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Staff = { id: string; first_name?: string | null; last_name?: string | null };
type Participant = { id: string; kind: "player" | "staff"; display_name: string; player_id: string | null; staff_id: string | null };
type Milestone = { id: string; participant_id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null };
type StaffMilestone = Omit<Milestone, "participant_id"> & { featured?: boolean };
type Source = { milestone_id: string; source_type: string; source_ctr_id: string | null; source_name: string };
type MilestonePatch = Partial<Pick<Milestone, "scope" | "category" | "season_label" | "club_text" | "position_text">>;
type ProfilePatch = {
  first_name?: string;
  last_name?: string | null;
  section?: string | null;
  associated_kind?: string | null;
  associated_id?: string | null;
  headline?: string | null;
  location?: string | null;
  profile_status?: string | null;
  primary_role?: string | null;
  summary?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
};
type FeaturedPatch = { staff_id?: string; milestone_id?: string; featured?: boolean };
type StaffProfile = {
  staff_id: string | null;
  display_name?: string | null;
  section?: string | null;
  associated_kind?: string | null;
  associated_id?: string | null;
  headline?: string | null;
  location?: string | null;
  profile_status?: string | null;
  primary_role?: string | null;
  specialties?: string[];
  summary?: string | null;
  profile_url?: string | null;
  source_url?: string | null;
  source_captured_at?: string | null;
  links?: { kind: string; url: string; label?: string | null }[];
  roles?: { organization?: string | null; title?: string | null; location?: string | null; start_label?: string | null; end_label?: string | null; source_url?: string | null }[];
  credentials?: { title: string; issuer?: string | null; date_label?: string | null }[];
  sources?: { source_type: string; source_url: string; source_label?: string | null; captured_at?: string | null; notes?: string | null }[];
};
type AssociatedOption = { kind: "club" | "campus" | "federation"; id: string; name: string; shield_url: string | null };
type Club = { id: string; name: string };
type Federation = { id: string; name: string };
type CategoryOption = { id: string; type?: string | null; label: string; country?: string | null };

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const fullName = (person?: Staff) => [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() || "Staff";
const yearsFromLabel = (label: string | null | undefined) => [...new Set(String(label ?? "").match(/20\d{2}/g) ?? [])].map(Number);
const latestYear = (label: string | null | undefined) => Math.max(0, ...yearsFromLabel(label));
const readJsonArray = async <T,>(file: string) => JSON.parse(await readFile(file, "utf8").catch(() => "[]")) as T[];
const readJsonObject = async <T,>(file: string, fallback: T) => JSON.parse(await readFile(file, "utf8").catch(() => JSON.stringify(fallback))) as T;
const defaultRoleCategories = ["Dirección técnica", "Entrenadores", "Árbitros y especialistas", "Especialistas clínic", "Jugadores formadores"];
const isLocalAdmin = (request: NextRequest) => ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
const clean = (value: unknown) => String(value ?? "").trim() || null;
const socialUrl = (value: unknown, network: "linkedin" | "instagram") => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  const handle = text.replace(/^@/, "");
  return network === "instagram" ? `https://www.instagram.com/${handle}/` : text;
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
const mergedProfile = (associatedOptions: AssociatedOption[], ctrugby?: StaffProfile, linkedin?: StaffProfile) => ({
  associated_kind: ctrugby?.associated_kind ?? null,
  associated_id: ctrugby?.associated_id ?? null,
  associated_label: associatedLabel(associatedOptions, ctrugby?.associated_kind, ctrugby?.associated_id),
  associated_url: associatedHref(ctrugby?.associated_kind, ctrugby?.associated_id),
  associated_shield_url: associatedShieldUrl(ctrugby?.associated_kind, ctrugby?.associated_id),
  section: ctrugby?.section ?? null,
  headline: linkedin?.headline ?? ctrugby?.headline ?? null,
  location: linkedin?.location ?? null,
  profile_status: linkedin?.profile_status ?? (ctrugby ? "ctrugby" : "draft"),
  primary_role: ctrugby?.primary_role ?? linkedin?.primary_role ?? null,
  specialties: [...new Set([...(ctrugby?.specialties ?? []), ...(linkedin?.specialties ?? [])])],
  summary: ctrugby?.summary ?? linkedin?.summary ?? null,
  ctrugby_url: ctrugby?.profile_url ?? ctrugby?.source_url ?? null,
  linkedin_url: linkedin?.links?.find((link) => link.kind === "linkedin")?.url ?? ctrugby?.links?.find((link) => link.kind === "linkedin")?.url ?? null,
  instagram_url: ctrugby?.links?.find((link) => link.kind === "instagram")?.url ?? linkedin?.links?.find((link) => link.kind === "instagram")?.url ?? null,
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
    const admin = catalogConfigured() ? (await catalogAccess(request)).admin : false;
    const root = path.join(process.cwd(), "data", "staging");
    const [staffRaw, participantsRaw, milestonesRaw, sourcesRaw, ctrugbyProfiles, linkedinProfiles, featuredByStaff, roleCategories, clubs, federations, campuses] = await Promise.all([
      readFile(path.join(root, "staff.json"), "utf8"),
      readFile(path.join(root, "milestone-participants.json"), "utf8"),
      readFile(path.join(root, "milestones.json"), "utf8"),
      readFile(path.join(root, "milestone-sources.json"), "utf8").catch(() => "[]"),
      readJsonArray<StaffProfile>(path.join(root, "staff-ctrugby-profiles.json")),
      readJsonArray<StaffProfile>(path.join(root, "staff-linkedin-profiles.json")),
      readJsonObject<Record<string, string[]>>(path.join(root, "staff-featured-milestones.json"), {}),
      readJsonArray<string>(path.join(root, "staff-role-categories.json")).then((items) => items.length ? items : defaultRoleCategories),
      readJsonArray<Club>(path.join(root, "clubs.json")),
      readJsonArray<Federation>(path.join(root, "federations.json")),
      readJsonArray<CategoryOption>(path.join(root, "professional-categories.json")),
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
    const associatedOptions: AssociatedOption[] = [
      ...clubs.map((club) => ({ kind: "club" as const, id: club.id, name: club.name, shield_url: associatedShieldUrl("club", club.id) })),
      ...campuses.filter((category) => category.type === "FORM" || category.type === "CAMP").map((category) => ({ kind: "campus" as const, id: category.id, name: category.label, shield_url: associatedShieldUrl("campus", category.id) })),
      ...federations.map((federation) => ({ kind: "federation" as const, id: federation.id, name: federation.name, shield_url: associatedShieldUrl("federation", federation.id) })),
    ].sort((a, b) => a.kind.localeCompare(b.kind, "es") || a.name.localeCompare(b.name, "es"));
    const staff = JSON.parse(staffRaw) as Staff[];
    const participants = JSON.parse(participantsRaw) as Participant[];
    const milestones = JSON.parse(milestonesRaw) as Milestone[];
    const sources = JSON.parse(sourcesRaw) as Source[];
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));
    const staffIdByName = new Map(staff.map((person) => [fullName(person).toLocaleLowerCase("es-ES"), person.id]));
    const sourceByMilestone = new Map(sources.map((source) => [source.milestone_id, source]));
    const ctrugbyByStaff = new Map(ctrugbyProfiles.filter((profile) => profile.staff_id).map((profile) => [profile.staff_id!, profile]));
    const linkedinByStaff = new Map(linkedinProfiles.filter((profile) => profile.staff_id).map((profile) => [profile.staff_id!, profile]));
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
        profile: mergedProfile(associatedOptions, ctrugbyByStaff.get(person.id), linkedinByStaff.get(person.id)),
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
      can_create: admin && isLocalAdmin(request) && process.env.NODE_ENV !== "production",
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
    if (creating || body.action === "update-profile") {
      const firstName = clean(body.first_name);
      if (!firstName) return reply({ error: "Indica el nombre del miembro del staff." }, 400);
      const profilePatch: ProfilePatch = {
        first_name: firstName,
        last_name: clean(body.last_name),
        section: clean(body.section),
        associated_kind: clean(body.associated_kind),
        associated_id: clean(body.associated_id),
        headline: clean(body.headline),
        location: clean(body.location),
        profile_status: clean(body.profile_status) ?? "draft",
        primary_role: clean(body.primary_role),
        summary: clean(body.summary),
        linkedin_url: socialUrl(body.linkedin_url, "linkedin"),
        instagram_url: socialUrl(body.instagram_url, "instagram"),
      };
      if (catalogConfigured() && !localAdmin) {
        const { admin } = await catalogAccess(request);
        if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
        return reply({ error: "La edición de perfiles de staff todavía no está conectada al catálogo remoto." }, 501);
      }
      if (process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
      const root = path.join(process.cwd(), "data", "staging");
      const staffFile = path.join(root, "staff.json");
      const profilesFile = path.join(root, "staff-ctrugby-profiles.json");
      const staff = JSON.parse(await readFile(staffFile, "utf8")) as Staff[];
      if (creating) {
        const nextNumber = Math.max(0, ...staff.map((person) => /^STF\d+$/.test(person.id) ? Number(person.id.slice(3)) : 0)) + 1;
        body.id = `STF${String(nextNumber).padStart(4, "0")}`;
        staff.push({ id: body.id, first_name: firstName, last_name: profilePatch.last_name });
      }
      if (!body.id) return reply({ error: "Miembro de staff no válido." }, 400);
      const staffIndex = staff.findIndex((person) => person.id === body.id);
      if (staffIndex < 0) return reply({ error: "Miembro de staff no encontrado." }, 404);
      staff[staffIndex] = { ...staff[staffIndex], first_name: profilePatch.first_name, last_name: profilePatch.last_name };
      const profiles = await readJsonArray<StaffProfile>(profilesFile);
      const profileIndex = profiles.findIndex((profile) => profile.staff_id === body.id);
      const current = profileIndex >= 0 ? profiles[profileIndex] : { staff_id: body.id };
      const nextProfile: StaffProfile = {
        ...current,
        staff_id: body.id,
        display_name: [profilePatch.first_name, profilePatch.last_name].filter(Boolean).join(" "),
        section: profilePatch.section,
        associated_kind: profilePatch.associated_id ? profilePatch.associated_kind : null,
        associated_id: profilePatch.associated_id ? profilePatch.associated_id : null,
        headline: profilePatch.headline,
        location: profilePatch.location,
        profile_status: profilePatch.profile_status,
        primary_role: profilePatch.primary_role,
        summary: profilePatch.summary,
        links: upsertLink(upsertLink(current.links, "linkedin", profilePatch.linkedin_url ?? null, "LinkedIn"), "instagram", profilePatch.instagram_url ?? null, "Instagram"),
      };
      if (profileIndex >= 0) profiles[profileIndex] = nextProfile;
      else profiles.push(nextProfile);
      await Promise.all([
        writeFile(staffFile, `${JSON.stringify(staff, null, 2)}\n`, "utf8"),
        writeFile(profilesFile, `${JSON.stringify(profiles, null, 2)}\n`, "utf8"),
      ]);
      return reply({ ok: true, id: body.id }, creating ? 201 : 200);
    }
    if (body.action === "toggle-featured-milestone") {
      if (catalogConfigured() && !localAdmin) {
        const { admin } = await catalogAccess(request);
        if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
        return reply({ error: "Los destacados de staff todavía no están conectados al catálogo remoto." }, 501);
      }
      if (process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
      const staffId = clean(body.staff_id);
      const milestoneId = clean(body.milestone_id);
      if (!staffId || !milestoneId) return reply({ error: "Hito no válido." }, 400);
      const file = path.join(process.cwd(), "data", "staging", "staff-featured-milestones.json");
      const featuredByStaff = await readJsonObject<Record<string, string[]>>(file, {});
      const current = new Set(featuredByStaff[staffId] ?? []);
      if (body.featured) current.add(milestoneId);
      else current.delete(milestoneId);
      featuredByStaff[staffId] = [...current].sort();
      await writeFile(file, `${JSON.stringify(featuredByStaff, null, 2)}\n`, "utf8");
      return reply({ ok: true });
    }
    if (body.action === "update-role-categories") {
      if (catalogConfigured() && !localAdmin) {
        const { admin } = await catalogAccess(request);
        if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
        return reply({ error: "La tabla de rol Rugby todavía no está conectada al catálogo remoto." }, 501);
      }
      if (process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
      const categories = Array.isArray((body as { categories?: unknown }).categories)
        ? [...new Set(((body as { categories: unknown[] }).categories).map(clean).filter((item): item is string => Boolean(item)))]
        : [];
      if (!categories.length) return reply({ error: "Añade al menos un rol Rugby." }, 400);
      const file = path.join(process.cwd(), "data", "staging", "staff-role-categories.json");
      await writeFile(file, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
      return reply({ ok: true });
    }
    if (body.action !== "update-milestone") return reply({ error: "Acción no disponible." }, 400);
    const patch: MilestonePatch = {
      scope: body.scope?.trim() || null,
      category: body.category?.trim() || null,
      season_label: body.season_label?.trim() || null,
      club_text: body.club_text?.trim() || null,
      position_text: body.position_text?.trim() || null,
    };
    if (catalogConfigured() && !localAdmin) {
      const { db, admin } = await catalogAccess(request);
      if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
      const result = await db.from("catalog_milestones").update(patch).eq("id", body.id);
      if (result.error) return reply({ error: result.error.message || "No se ha podido guardar el hito." }, 503);
      return reply({ ok: true });
    }
    if (process.env.NODE_ENV === "production") return reply({ error: "Edición local no disponible en producción." }, 403);
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
