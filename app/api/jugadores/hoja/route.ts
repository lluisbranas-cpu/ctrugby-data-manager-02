import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; version: number };
type Season = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
type Club = { id: string; name: string; country: string | null };
type SheetData = { players: Player[]; seasons: Season[]; clubs: Club[] };

function sheet(rows: (string | number | null)[][], name: string, widths: number[]) {
  const output = XLSX.utils.aoa_to_sheet(rows);
  output["!cols"] = widths.map((wch) => ({ wch }));
  output["!freeze"] = { xSplit: 0, ySplit: 1 };
  return { name, output };
}

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    const result = await db.rpc("admin_player_sheet_data");
    if (result.error) return NextResponse.json({ error: "No se ha podido preparar la hoja. Comprueba la migración de importación de jugadores." }, { status: 503 });
    const data = result.data as SheetData;
    const guide = [
      ["CTRugby · Hoja de trabajo privada"],
      ["Jugadores y temporadas"],
      [],
      ["Qué puedes editar", "Nombre, apellidos, categoría, año de nacimiento, temporadas, posición, peso, altura y club por ID."],
      ["Acciones", "Actualizar para modificar una fila existente; Nuevo para crear una fila."],
      ["Privacidad", "Mantén Publicar en No. Esta hoja nunca publica fichas."],
      ["IDs", "No cambies el ID de una fila existente. Para un alta usa un ID CTR seguido de cuatro cifras que no exista."],
      ["Temporadas", "Cada fila representa una temporada. Los clubs se indican con su ID oficial de Clubs (referencia)."],
      ["Historial de clubs", "No se edita desde esta hoja; se mantiene en revisión dentro de la aplicación."],
      ["Cómo usarla", "Edita Jugadores y Temporadas, conserva los encabezados y guarda el archivo como .xlsx."],
    ];
    const playerRows = [
      ["Acción", "ID jugador", "Nombre", "Apellidos", "Categoría", "Año nacimiento", "Publicar"],
      ...data.players.map((player) => ["Actualizar", player.id, player.first_name, player.last_name, player.category, player.birth_year, "No"]),
    ];
    const seasonRows = [
      ["Acción", "ID jugador", "Temporada", "ID club", "Club (referencia)", "Posición", "Peso kg", "Altura cm", "Publicar"],
      ...data.seasons.map((season) => ["Actualizar", season.player_id, season.season_year, season.club_id, season.legacy_club_name, season.position_text, season.weight_kg, season.height_cm, "No"]),
    ];
    const clubRows = [
      ["ID club", "Nombre", "País"],
      ...data.clubs.map((club) => [club.id, club.name, club.country]),
    ];
    const workbook = XLSX.utils.book_new();
    for (const { name, output } of [
      sheet(guide, "Guía", [22, 95]),
      sheet(playerRows, "Jugadores", [14, 14, 22, 24, 18, 15, 12]),
      sheet(seasonRows, "Temporadas", [14, 14, 12, 14, 30, 20, 12, 12, 12]),
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
