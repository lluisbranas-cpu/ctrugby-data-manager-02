import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SheetRow = Record<string, unknown>;
type Issue = { sheet: string; row: number; field: string; message: string };
type Assessment = { id: string; player_id: string; season: string; label: string; evaluated_on: string | null; club: string; position: string; metrics: Record<string, number | null>; notes: string; revision: number };

const metricColumns = [
  ["avanzar_espacio", "Avanzar espacio", 0, 10],
  ["avanzar_contacto", "Avanzar contacto", 0, 10],
  ["placaje", "Placaje", 0, 10],
  ["pase", "Pase y recepcion", 0, 10],
  ["pase_recepcion", "Pase-recepcion", 0, 10],
  ["juego_pie", "Juego al pie", 0, 10],
  ["toma_decisiones", "Toma decisiones", 0, 10],
  ["recuperacion", "Recuperacion", 0, 10],
  ["continuidad", "Continuidad", 0, 10],
  ["potencia", "Potencia", 0, 10],
  ["velocidad", "Velocidad", 0, 10],
  ["agilidad", "Agilidad", 0, 10],
  ["coordinacion", "Coordinacion", 0, 10],
  ["determinacion", "Determinacion", 0, 10],
  ["inteligencia_tactica", "Inteligencia tactica", 0, 10],
  ["compromiso", "Compromiso", 0, 10],
  ["compromiso_colectivo", "Compromiso colectivo", 0, 10],
  ["iniciativa_individual", "Iniciativa individual", 0, 10],
  ["capacidad_aprendizaje", "Capacidad aprendizaje", 0, 10],
  ["posicion_mele", "Posicion mele", 0, 10],
  ["recepcion_balon", "Recepcion balon", 0, 10],
  ["saltador", "Saltador", 0, 10],
  ["levantador", "Levantador", 0, 10],
  ["recepcion_aerea", "Recepcion aerea", 0, 10],
  ["evasion", "Evasion", 0, 10],
  ["peso", "Peso kg", 0, 300],
  ["altura", "Altura cm", 0, 260],
] as const;
const technicalMetricKeys = new Set<string>(metricColumns.map(([key]) => key).filter((key) => key !== "peso" && key !== "altura"));
const nutritionMetricKeys = new Set<string>(["peso", "altura"]);

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
  issues.push({ sheet, row, field: "Publicar", message: "debe ser No; la hoja no publica datos privados" });
};
const number = (value: unknown, minimum: number, maximum: number, sheet: string, row: number, field: string, issues: Issue[]) => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = typeof value === "number" ? value : Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    issues.push({ sheet, row, field, message: `debe estar entre ${minimum} y ${maximum}` });
    return null;
  }
  return parsed;
};
const date = (value: unknown, sheet: string, row: number, issues: Issue[]) => {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  issues.push({ sheet, row, field: "Fecha", message: "debe tener formato fecha" });
  return null;
};
const sheetRows = (book: XLSX.WorkBook, name: string, issues: Issue[]) => {
  const sheet = book.Sheets[name];
  if (!sheet) {
    issues.push({ sheet: name, row: 0, field: "pestaña", message: "no existe" });
    return [] as SheetRow[];
  }
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: false });
};

function parseAssessments(source: SheetRow[], issues: Issue[], sheet: string, activeMetrics: typeof metricColumns[number][]) {
  return source.map((sourceRow, index) => {
    const row = index + 2;
    const itemAction = action(sourceRow["Acción"], sheet, row, issues);
    const id = optional(sourceRow["ID evaluación"], 40, sheet, row, "ID evaluación", issues) ?? randomUUID();
    if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) issues.push({ sheet, row, field: "ID evaluación", message: "debe ser UUID o estar vacío para Nuevo" });
    if (itemAction === "actualizar" && !text(sourceRow["ID evaluación"])) issues.push({ sheet, row, field: "ID evaluación", message: "es obligatorio al actualizar" });
    const playerId = required(sourceRow["ID jugador"], 7, sheet, row, "ID jugador", issues).toUpperCase();
    if (!/^JUG[0-9]{4}$/.test(playerId)) issues.push({ sheet, row, field: "ID jugador", message: "debe tener el formato JUG0000" });
    const metrics: Record<string, number | null> = {};
    for (const [key, label, minimum, maximum] of activeMetrics) metrics[key] = number(sourceRow[label], minimum, maximum, sheet, row, label, issues);
    privateOnly(sourceRow.Publicar, sheet, row, issues);
    return {
      action: itemAction,
      record: {
        id,
        player_id: playerId,
        season: required(sourceRow.Temporada, 40, sheet, row, "Temporada", issues),
        label: required(sourceRow["Nombre evaluación"], 120, sheet, row, "Nombre evaluación", issues),
        evaluated_on: date(sourceRow.Fecha, sheet, row, issues),
        club: optional(sourceRow.Club, 160, sheet, row, "Club", issues) ?? "",
        position: optional(sourceRow["Posición"], 100, sheet, row, "Posición", issues) ?? "",
        metrics,
        notes: optional(sourceRow.Observaciones, 5000, sheet, row, "Observaciones", issues) ?? "",
        revision: 0,
      } satisfies Assessment,
      row,
    };
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
    const requestedKind = text(form.get("kind"));
    const importKind = requestedKind === "nutrition" ? "nutrition" : "technical";
    const sheetName = importKind === "nutrition" ? "Nutrición" : "Datos técnicos";
    const activeMetrics = metricColumns.filter(([key]) => importKind === "nutrition" ? nutritionMetricKeys.has(key) : technicalMetricKeys.has(key));
    const requestedSeason = text(form.get("season"));
    if (!/^\d{4}$/.test(requestedSeason)) return reply({ error: "Selecciona un año para importar." }, 400);
    const selectedSeason = requestedSeason;
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return reply({ error: "Selecciona una hoja .xlsx generada desde la plantilla." }, 400);
    if (file.size === 0 || file.size > 5_000_000) return reply({ error: "El archivo debe ocupar entre 1 byte y 5 MB." }, 413);
    const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const issues: Issue[] = [];
    const rows = parseAssessments(sheetRows(book, sheetName, issues), issues, sheetName, activeMetrics);
    if (!rows.length) issues.push({ sheet: sheetName, row: 0, field: "filas", message: "debe contener al menos una evaluación" });
    for (const row of rows) {
      if (row.record.season !== selectedSeason) issues.push({ sheet: sheetName, row: row.row, field: "Temporada", message: `debe ser ${selectedSeason}` });
    }
    if (issues.length) return reply({ error: "La hoja tiene datos que deben corregirse.", issues: issues.slice(0, 50) }, 422);

    const playerIds = [...new Set(rows.map((row) => row.record.player_id))];
    const players = await db.from("catalog_players").select("id").in("id", playerIds);
    if (players.error) return reply({ error: "No se han podido comprobar los jugadores." }, 503);
    const known = new Set((players.data ?? []).map((player) => player.id));
    const conflicts = rows.filter((row) => !known.has(row.record.player_id)).map((row) => ({ sheet: sheetName, row: row.row, field: "ID jugador", message: "no existe en el catálogo" }));
    if (conflicts.length) return reply({ error: "La hoja no coincide con los jugadores actuales.", issues: conflicts.slice(0, 50) }, 409);

    let imported = 0;
    for (const row of rows) {
      if (row.action === "actualizar") {
        const existing = await db.rpc("app_player_assessments", { p_player_id: row.record.player_id });
        const match = ((existing.data ?? []) as Assessment[]).find((record) => record.id === row.record.id);
        if (match?.metrics) row.record.metrics = { ...match.metrics, ...row.record.metrics };
      }
      const result = await db.rpc("app_save_player_assessment", { p_record: row.record });
      if (result.error) return reply({ error: result.error.message || `No se ha podido guardar la fila ${row.row}.`, imported }, 503);
      imported++;
    }
    return reply({ ok: true, imported });
  } catch {
    return reply({ error: "No se ha podido leer el archivo. Conserva la pestaña y encabezados de la plantilla y vuelve a guardarla como .xlsx." }, 400);
  }
}
