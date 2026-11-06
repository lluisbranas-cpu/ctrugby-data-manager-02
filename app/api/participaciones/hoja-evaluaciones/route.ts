import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null };
type Assessment = { id: string; player_id: string; season: string; label: string; evaluated_on: string | null; club: string; position: string; metrics: Record<string, number | null>; notes: string; revision: number };

const metricColumns = [
  ["avanzar_espacio", "Avanzar espacio"],
  ["avanzar_contacto", "Avanzar contacto"],
  ["placaje", "Placaje"],
  ["pase", "Pase y recepcion"],
  ["pase_recepcion", "Pase-recepcion"],
  ["juego_pie", "Juego al pie"],
  ["toma_decisiones", "Toma decisiones"],
  ["recuperacion", "Recuperacion"],
  ["continuidad", "Continuidad"],
  ["potencia", "Potencia"],
  ["velocidad", "Velocidad"],
  ["agilidad", "Agilidad"],
  ["coordinacion", "Coordinacion"],
  ["determinacion", "Determinacion"],
  ["inteligencia_tactica", "Inteligencia tactica"],
  ["compromiso", "Compromiso"],
  ["compromiso_colectivo", "Compromiso colectivo"],
  ["iniciativa_individual", "Iniciativa individual"],
  ["capacidad_aprendizaje", "Capacidad aprendizaje"],
  ["posicion_mele", "Posicion mele"],
  ["recepcion_balon", "Recepcion balon"],
  ["saltador", "Saltador"],
  ["levantador", "Levantador"],
  ["recepcion_aerea", "Recepcion aerea"],
  ["evasion", "Evasion"],
  ["peso", "Peso kg"],
  ["altura", "Altura cm"],
] as const;
const technicalMetricKeys = new Set<string>(metricColumns.map(([key]) => key).filter((key) => key !== "peso" && key !== "altura"));
const nutritionMetricKeys = new Set<string>(["peso", "altura"]);
const fullName = (player?: Player) => [player?.first_name, player?.last_name].filter(Boolean).join(" ") || "Jugador";

function sheet(rows: (string | number | null)[][], name: string, widths: number[]) {
  const output = XLSX.utils.aoa_to_sheet(rows);
  output["!cols"] = widths.map((wch) => ({ wch }));
  output["!freeze"] = { xSplit: 0, ySplit: 1 };
  return output;
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    const season = request.nextUrl.searchParams.get("season") ?? "";
    if (!/^\d{4}$/.test(season)) return NextResponse.json({ error: "Selecciona un año para exportar." }, { status: 400 });
    const selectedSeason = season;
    const requestedKind = request.nextUrl.searchParams.get("kind") ?? "technical";
    const exportKind = requestedKind === "nutrition" ? "nutrition" : "technical";
    const activeMetrics = metricColumns.filter(([key]) => exportKind === "nutrition" ? nutritionMetricKeys.has(key) : technicalMetricKeys.has(key));
    const title = exportKind === "nutrition" ? "Nutrición" : "Datos técnicos";
    const slug = exportKind === "nutrition" ? "nutricion" : "tecnico";

    const playersResult = await db.from("catalog_players").select("id,first_name,last_name").order("id");
    if (playersResult.error) return NextResponse.json({ error: "No se han podido cargar los jugadores." }, { status: 503 });
    const players = (playersResult.data ?? []) as Player[];
    const playerNames = new Map(players.map((player) => [player.id, fullName(player)]));
    const records: Assessment[] = [];
    const queue = [...players];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const player = queue.shift()!;
        const result = await db.rpc("app_player_assessments", { p_player_id: player.id });
        if (!result.error) records.push(...((result.data ?? []) as Assessment[]));
      }
    }));

    const header = ["Acción", "ID evaluación", "ID jugador", "Jugador", "Temporada", "Nombre evaluación", "Fecha", "Club", "Posición", ...activeMetrics.map(([, label]) => label), "Observaciones", "Publicar"];
    const visibleRecords = selectedSeason === "all" ? records : records.filter((record) => record.season === selectedSeason);
    const rows = visibleRecords
      .sort((a, b) => a.season.localeCompare(b.season) || a.player_id.localeCompare(b.player_id) || a.label.localeCompare(b.label, "es"))
      .map((record) => [
        "Actualizar",
        record.id,
        record.player_id,
        playerNames.get(record.player_id) ?? "",
        record.season,
        record.label,
        record.evaluated_on,
        record.club,
        record.position,
        ...activeMetrics.map(([key]) => record.metrics?.[key] ?? null),
        record.notes,
        "No",
      ]);
    const guide = [
      [`CTRugby · ${title}`],
      ["Temporada", selectedSeason === "all" ? "Todas" : selectedSeason],
      ["Qué contiene", "Una fila por evaluación de jugador y temporada."],
      ["Tipo de exportación", title],
      ["Privacidad", "Mantén Publicar en No. Esta hoja no publica datos privados."],
      ["Cómo usarla", "Conserva los encabezados y guarda el archivo como .xlsx."],
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet(guide, "Guía", [24, 95]), "Guía");
    XLSX.utils.book_append_sheet(workbook, sheet([header, ...rows], title, header.map((column) => column === "Observaciones" ? 44 : column.length > 18 ? 22 : 14)), title);

    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ctrugby-${slug}-${selectedSeason}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja técnica y de nutrición." }, { status: 500 });
  }
}
