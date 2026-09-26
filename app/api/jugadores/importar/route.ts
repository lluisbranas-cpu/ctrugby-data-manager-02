import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SheetRow = Record<string, unknown>;
type Issue = { sheet: string; row: number; field: string; message: string };
type PlayerRow = { action: "actualizar" | "nuevo"; id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; version: number };
type SeasonRow = { action: "actualizar" | "nuevo"; player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type CatalogPlayer = { id: string; version: number };

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const optional = (value: unknown, maximum: number, sheet: string, row: number, field: string, issues: Issue[]) => {
  const result = text(value);
  if (result.length > maximum) issues.push({ sheet, row, field, message: `supera ${maximum} caracteres` });
  return result || null;
};
const required = (value: unknown, maximum: number, sheet: string, row: number, field: string, issues: Issue[]) => {
  const result = text(value);
  if (!result) issues.push({ sheet, row, field, message: "es obligatorio" });
  else if (result.length > maximum) issues.push({ sheet, row, field, message: `supera ${maximum} caracteres` });
  return result;
};
const action = (value: unknown, sheet: string, row: number, issues: Issue[]) => {
  const result = text(value).toLocaleLowerCase("es-ES");
  if (result === "actualizar" || result === "nuevo") return result;
  issues.push({ sheet, row, field: "Acción", message: "debe ser Actualizar o Nuevo" });
  return "actualizar" as const;
};
const privateOnly = (value: unknown, sheet: string, row: number, issues: Issue[]) => {
  const result = text(value).toLocaleLowerCase("es-ES");
  if (["no", "false", "0"].includes(result)) return;
  issues.push({ sheet, row, field: "Publicar", message: "debe ser No; la hoja no publica fichas" });
};
const number = (value: unknown, minimum: number, maximum: number, requiredValue: boolean, sheet: string, row: number, field: string, issues: Issue[]) => {
  const raw = text(value);
  if (!raw) {
    if (requiredValue) issues.push({ sheet, row, field, message: "es obligatorio" });
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    issues.push({ sheet, row, field, message: `debe estar entre ${minimum} y ${maximum}` });
    return null;
  }
  return parsed;
};
const sheetRows = (book: XLSX.WorkBook, name: string, issues: Issue[]) => {
  const sheet = book.Sheets[name];
  if (!sheet) {
    issues.push({ sheet: name, row: 0, field: "pestaña", message: "no existe" });
    return [] as SheetRow[];
  }
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: false });
};

function parsePlayers(source: SheetRow[], issues: Issue[]) {
  return source.map((sourceRow, index): PlayerRow => {
    const row = index + 2;
    const sheet = "Jugadores";
    const id = required(sourceRow["ID jugador"], 7, sheet, row, "ID jugador", issues).toUpperCase();
    if (!/^CTR[0-9]{4}$/.test(id)) issues.push({ sheet, row, field: "ID jugador", message: "debe tener el formato CTR0000" });
    const birthYear = number(sourceRow["Año nacimiento"], 1900, 2026, false, sheet, row, "Año nacimiento", issues);
    if (birthYear != null && !Number.isInteger(birthYear)) issues.push({ sheet, row, field: "Año nacimiento", message: "debe ser un año entero" });
    privateOnly(sourceRow.Publicar, sheet, row, issues);
    return {
      action: action(sourceRow["Acción"], sheet, row, issues), id,
      first_name: required(sourceRow.Nombre, 100, sheet, row, "Nombre", issues),
      last_name: optional(sourceRow.Apellidos, 160, sheet, row, "Apellidos", issues),
      category: optional(sourceRow["Categoría"], 120, sheet, row, "Categoría", issues), birth_year: birthYear,
      version: 0,
    };
  });
}

function parseSeasons(source: SheetRow[], issues: Issue[]) {
  return source.map((sourceRow, index): SeasonRow => {
    const row = index + 2;
    const sheet = "Temporadas";
    const playerId = required(sourceRow["ID jugador"], 7, sheet, row, "ID jugador", issues).toUpperCase();
    if (!/^CTR[0-9]{4}$/.test(playerId)) issues.push({ sheet, row, field: "ID jugador", message: "debe tener el formato CTR0000" });
    const clubId = optional(sourceRow["ID club"], 7, sheet, row, "ID club", issues)?.toUpperCase() ?? null;
    if (clubId && !/^[A-Z]{3}[0-9]{4}$/.test(clubId)) issues.push({ sheet, row, field: "ID club", message: "debe tener el formato AAA0000" });
    const seasonYear = number(sourceRow.Temporada, 2000, 2035, true, sheet, row, "Temporada", issues);
    if (seasonYear != null && !Number.isInteger(seasonYear)) issues.push({ sheet, row, field: "Temporada", message: "debe ser un año entero" });
    const weight = number(sourceRow["Peso kg"], 0, 250, false, sheet, row, "Peso kg", issues);
    const height = number(sourceRow["Altura cm"], 0, 260, false, sheet, row, "Altura cm", issues);
    privateOnly(sourceRow.Publicar, sheet, row, issues);
    return {
      action: action(sourceRow["Acción"], sheet, row, issues), player_id: playerId, season_year: seasonYear ?? 0, club_id: clubId,
      legacy_club_name: optional(sourceRow["Club (referencia)"], 160, sheet, row, "Club (referencia)", issues),
      position_text: optional(sourceRow["Posición"], 100, sheet, row, "Posición", issues), weight_kg: weight, height_cm: height,
    };
  });
}

function duplicates(values: { key: string; row: number }[], sheet: string, field: string, issues: Issue[]) {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value.key)) issues.push({ sheet, row: value.row, field, message: "está duplicado" });
    seen.add(value.key);
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return reply({ error: "Selecciona una hoja .xlsx generada desde la plantilla." }, 400);
    if (file.size === 0 || file.size > 5_000_000) return reply({ error: "El archivo debe ocupar entre 1 byte y 5 MB." }, 413);
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const issues: Issue[] = [];
    const players = parsePlayers(sheetRows(book, "Jugadores", issues), issues);
    const seasons = parseSeasons(sheetRows(book, "Temporadas", issues), issues);
    if (!players.length) issues.push({ sheet: "Jugadores", row: 0, field: "filas", message: "debe contener al menos un jugador" });
    duplicates(players.map((player, index) => ({ key: player.id, row: index + 2 })), "Jugadores", "ID jugador", issues);
    duplicates(seasons.map((season, index) => ({ key: `${season.player_id}|${season.season_year}`, row: index + 2 })), "Temporadas", "Jugador y temporada", issues);
    if (issues.length) return reply({ error: "La hoja tiene datos que deben corregirse.", issues: issues.slice(0, 50) }, 422);

    const current = await db.rpc("admin_player_catalog_with_history");
    if (current.error) return reply({ error: "No se ha podido comprobar el catálogo actual de jugadores." }, 503);
    const existing = new Map((current.data as CatalogPlayer[] ?? []).map((player) => [player.id, player]));
    const conflicts: Issue[] = [];
    players.forEach((player, index) => {
      const stored = existing.get(player.id);
      if (player.action === "actualizar" && !stored) conflicts.push({ sheet: "Jugadores", row: index + 2, field: "ID jugador", message: "no existe para actualizar" });
      if (player.action === "nuevo" && stored) conflicts.push({ sheet: "Jugadores", row: index + 2, field: "ID jugador", message: "ya existe; usa Actualizar" });
      player.version = stored?.version ?? 0;
    });
    const newPlayerIds = new Set(players.filter((player) => player.action === "nuevo").map((player) => player.id));
    seasons.forEach((season, index) => {
      if (!existing.has(season.player_id) && !newPlayerIds.has(season.player_id)) conflicts.push({ sheet: "Temporadas", row: index + 2, field: "ID jugador", message: "no existe en la hoja ni en el catálogo" });
    });
    const clubIds = [...new Set(seasons.flatMap((season) => season.club_id ? [season.club_id] : []))];
    if (clubIds.length) {
      const clubs = await db.from("catalog_clubs").select("id,name").in("id", clubIds);
      if (clubs.error) return reply({ error: "No se han podido comprobar los clubs de la hoja." }, 503);
      const clubNames = new Map((clubs.data ?? []).map((club) => [club.id, club.name]));
      seasons.forEach((season, index) => {
        if (season.club_id && !clubNames.has(season.club_id)) conflicts.push({ sheet: "Temporadas", row: index + 2, field: "ID club", message: "no existe en el catálogo" });
        if (season.club_id) season.legacy_club_name = clubNames.get(season.club_id) ?? season.legacy_club_name;
      });
    }
    if (conflicts.length) return reply({ error: "La hoja no coincide con los datos actuales.", issues: conflicts.slice(0, 50) }, 409);

    const imported = await db.rpc("admin_import_player_sheet", { p_players: players, p_seasons: seasons });
    if (imported.error) return reply({ error: "No se ha podido importar la hoja. Comprueba que se ejecutó la migración 202609250015_player_sheet_import.sql y descarga una hoja nueva antes de reintentar." }, 503);
    return reply({ ok: true, ...(imported.data as Record<string, number>) });
  } catch {
    return reply({ error: "No se ha podido leer el archivo. Conserva las pestañas y encabezados de la plantilla y vuelve a guardarla como .xlsx." }, 400);
  }
}
