import { readCampusMetricsJson } from "@/lib/campus-participations";
import { currentClubSeason } from "@/lib/current-club";
import { readGroupMemberships } from "@/lib/temporary-group-clubs";
import { groupSearchNames } from "@/app/lib/club-group-membership";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
import { readLocalPlayerContacts, type LocalPlayerContacts } from "@/lib/player-private-contacts";
import { readPlayerProfileOverride } from "@/lib/player-profile-overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; version: number };
type Season = { player_id: string; season_year: number; registration_number: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Club = { id: string; name: string; country: string | null };
type SheetData = { players: Player[]; seasons: Season[]; clubs: Club[] };
type Staff = { first_name?: string | null; last_name?: string | null };
type PrivateProfile = { player_id: string; dni: string | null; category: string | null; birth_year: number | null };
type Publication = { id: string; published: boolean };

const normalizedPersonName = (firstName?: string | null, lastName?: string | null) =>
  [firstName ?? "", lastName ?? ""].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/\s+/g, " ").trim();

async function localStaffDuplicatePlayerIds(players: Player[]) {
  try {
    const staffRaw = await readFile(path.join(process.cwd(), "data", "staging", "staff.json"), "utf8");
    const staffNames = new Set((JSON.parse(staffRaw) as Staff[]).map((staff) => normalizedPersonName(staff.first_name, staff.last_name)).filter(Boolean));
    return new Set(players
      .filter((player) => staffNames.has(normalizedPersonName(player.first_name, player.last_name)) && !player.category && !player.birth_year)
      .map((player) => player.id));
  } catch {
    return new Set<string>();
  }
}

function sheet(rows: (string | number | null)[][], name: string, widths: number[]) {
  const output = XLSX.utils.aoa_to_sheet(rows);
  output["!cols"] = widths.map((wch) => ({ wch }));
  output["!freeze"] = { xSplit: 0, ySplit: 1 };
  return { name, output };
}

const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");
const genderLabel = (value: string | null) => value === "M" ? "Masculino" : value === "F" ? "Femenino" : "";
const clubShield = (clubId: string | null | undefined) => clubId ? `/api/clubs/escudo/${encodeURIComponent(clubId)}` : null;
const birthYearWithAge = (birthYear: number | null | undefined) => birthYear ? `${birthYear} (${new Date().getFullYear() - birthYear})` : null;

async function localContactsMap(ids: string[]) {
  const entries = await Promise.all(ids.map(async (id) => [id, await readLocalPlayerContacts(id)] as const));
  return new Map(entries.filter((entry): entry is readonly [string, LocalPlayerContacts] => Boolean(entry[1])));
}

function filterLabel(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const year = params.get("year") || "all";
  const gender = params.get("gender") || "all";
  const status = params.get("status") || "all";
  const query = params.get("q")?.trim() || "";
  return [
    `Jugadores: ${params.get("scope") === "ctrugby" ? "Rugby" : "Todos"}`,
    `Año: ${year === "all" ? "Todos" : year}`,
    `Género: ${gender === "all" ? "Todos" : gender === "M" ? "Masculino" : "Femenino"}`,
    `Estado: ${status === "all" ? "Todos" : status === "published" ? "Públicos" : "Ocultos"}`,
    query ? `Búsqueda: ${query}` : null,
  ].filter(Boolean).join(" · ");
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    const result = await db.rpc("admin_player_sheet_data");
    if (result.error) return NextResponse.json({ error: "No se ha podido preparar la hoja. Comprueba la migración de importación de jugadores." }, { status: 503 });
    const data = result.data as SheetData;
    const staffDuplicatePlayerIds = await localStaffDuplicatePlayerIds(data.players);
    const players = data.players.filter((player) => !staffDuplicatePlayerIds.has(player.id));
    const seasons = data.seasons.filter((season) => !staffDuplicatePlayerIds.has(season.player_id));
    if (request.nextUrl.searchParams.get("formato") === "listado") {
      const year = request.nextUrl.searchParams.get("year") || "all";
      const gender = request.nextUrl.searchParams.get("gender") as "all" | "M" | "F" | null ?? "all";
      const status = request.nextUrl.searchParams.get("status") as "all" | "published" | "hidden" | null ?? "all";
      const query = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("es-ES") ?? "";
      const clubsById = new Map(data.clubs.map((club) => [club.id, club]));
      const seasonsByPlayer = new Map<string, Season[]>();
      for (const season of seasons) seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);
      const [profileRows, publicationRows, localContacts] = await Promise.all([
        db.schema("app_private").from("player_profiles").select("player_id,dni,category,birth_year"),
        db.from("catalog_players").select("id,published"),
        localContactsMap(players.map((player) => player.id)),
      ]);
      const profiles = new Map((profileRows.data as PrivateProfile[] | null ?? []).map((profile) => [profile.player_id, profile]));
      const publications = new Map((publicationRows.data as Publication[] | null ?? []).map((publication) => [publication.id, publication.published]));
      const contactsResult = await db.schema("app_private").from("player_private_contacts").select("*");
      const contacts = new Map((contactsResult.data as (LocalPlayerContacts & { player_id: string })[] | null ?? []).map((contact) => [contact.player_id, contact as LocalPlayerContacts]));
      for (const [id, contact] of localContacts) if (!contacts.has(id)) contacts.set(id, contact);
      const profileOverrides = new Map(await Promise.all(players.map(async (player) => [player.id, await readPlayerProfileOverride(player.id)] as const)));
      const groupMemberships = await readGroupMemberships(seasons);
      const participationMetrics = request.nextUrl.searchParams.get("scope") === "ctrugby"
        ? new Map((JSON.parse(await readCampusMetricsJson()) as { player_id: string; participation_count: number }[]).map((metric) => [metric.player_id, metric.participation_count]))
        : null;
      const filtered = players.map((player) => {
        const playerSeasons = [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year);
        const currentSeason = currentClubSeason(playerSeasons);
        const currentClub = currentSeason?.club_id ? clubsById.get(currentSeason.club_id) ?? null : null;
        const profile = profiles.get(player.id);
        const override = profileOverrides.get(player.id);
        const category = override?.category ?? profile?.category ?? player.category;
        const birth_year = override?.birth_year ?? profile?.birth_year ?? player.birth_year;
        const searchable = [...groupSearchNames(groupMemberships.get(player.id), year), player.id, fullName(player), category ?? "", currentSeason?.position_text ?? "", currentClub?.name ?? currentSeason?.legacy_club_name ?? ""].join(" ").toLocaleLowerCase("es-ES");
        return { player, seasons: playerSeasons, currentSeason, currentClub, category, birth_year, dni: override?.dni ?? profile?.dni ?? null, contact: contacts.get(player.id) ?? null, published: publications.get(player.id) ?? true, searchable };
      }).filter((row) => {
        if (participationMetrics && (participationMetrics.get(row.player.id) ?? 0) <= 0) return false;
        if (query && !row.searchable.includes(query)) return false;
        if (year !== "all" && !row.seasons.some((season) => String(season.season_year) === year)) return false;
        if (gender !== "all" && row.category !== gender) return false;
        if (status !== "all" && (status === "published" ? !row.published : row.published)) return false;
        return true;
      }).sort((a, b) => fullName(a.player).localeCompare(fullName(b.player), "es", { sensitivity: "base" }));
      const rows = [
        ["Rugby · Jugadores filtrados"],
        [filterLabel(request)],
        [],
        ["ID", "Nombre", "Sexo", "Escudo club", "Club", "Año nacimiento (edad)", "DNI", "Posición", "Teléfono jugador", "Mail de contacto", "Nombre tutor 1", "Teléfono 1", "Nombre tutor 2", "Teléfono 2"],
        ...filtered.map((row) => [
          row.player.id,
          fullName(row.player),
          genderLabel(row.category),
          clubShield(row.currentClub?.id),
          row.currentClub?.name ?? row.currentSeason?.legacy_club_name ?? null,
          birthYearWithAge(row.birth_year),
          row.dni,
          row.currentSeason?.position_text ?? null,
          row.contact?.player_phone_e164 ?? null,
          row.contact?.tutor1_email ?? row.contact?.player_email ?? null,
          row.contact?.tutor1_name ?? null,
          row.contact?.tutor1_phone_e164 ?? null,
          row.contact?.tutor2_name ?? null,
          row.contact?.tutor2_phone_e164 ?? null,
        ]),
      ];
      const workbook = XLSX.utils.book_new();
      const output = XLSX.utils.aoa_to_sheet(rows);
      output["!cols"] = [14, 32, 14, 34, 34, 20, 16, 18, 20, 34, 28, 20, 28, 20].map((wch) => ({ wch }));
      output["!freeze"] = { xSplit: 0, ySplit: 4 };
      XLSX.utils.book_append_sheet(workbook, output, "Jugadores filtrados");
      const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="ctrugby-jugadores-filtrados.xlsx"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    const guide = [
      ["Rugby · Hoja de trabajo privada"],
      ["Jugadores y temporadas"],
      [],
      ["Qué puedes editar", "Nombre, apellidos, categoría, año de nacimiento, temporadas, número de inscripción, posición, peso, altura y club por ID."],
      ["Acciones", "Actualizar para modificar una fila existente; Nuevo para crear una fila."],
      ["Privacidad", "Mantén Publicar en No. Esta hoja nunca publica fichas."],
      ["IDs", "No cambies el ID de una fila existente. Para un alta usa un ID JUG seguido de cuatro cifras que no exista."],
      ["Temporadas", "Cada fila representa una temporada. Los clubs se indican con su ID oficial de Clubs (referencia)."],
      ["Historial de clubs", "No se edita desde esta hoja; se mantiene en revisión dentro de la aplicación."],
      ["Cómo usarla", "Edita Jugadores y Temporadas, conserva los encabezados y guarda el archivo como .xlsx."],
    ];
    const playerRows = [
      ["Acción", "ID jugador", "Nombre", "Apellidos", "Categoría", "Año nacimiento", "Publicar"],
      ...players.map((player) => ["Actualizar", player.id, player.first_name, player.last_name, player.category, player.birth_year, "No"]),
    ];
    const seasonRows = [
      ["Acción", "ID jugador", "Temporada", "Número inscripción", "ID club", "Club (referencia)", "Posición", "Peso kg", "Altura cm", "Publicar"],
      ...seasons.map((season) => ["Actualizar", season.player_id, season.season_year, season.registration_number, season.club_id, season.legacy_club_name, season.position_text, season.weight_kg, season.height_cm, "No"]),
    ];
    const clubRows = [
      ["ID club", "Nombre", "País"],
      ...data.clubs.map((club) => [club.id, club.name, club.country]),
    ];
    const workbook = XLSX.utils.book_new();
    for (const { name, output } of [
      sheet(guide, "Guía", [22, 95]),
      sheet(playerRows, "Jugadores", [14, 14, 22, 24, 18, 15, 12]),
      sheet(seasonRows, "Temporadas", [14, 14, 12, 18, 14, 30, 20, 12, 12, 12]),
      sheet(clubRows, "Clubs (referencia)", [14, 42, 22]),
    ]) XLSX.utils.book_append_sheet(workbook, output, name);
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ctrugby-jugadores-privado.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de jugadores." }, { status: 500 });
  }
}
