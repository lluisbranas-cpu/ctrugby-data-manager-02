import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { requireConsultation } from "@/lib/consultation-access";
import { loadPlayerReviewData } from "@/lib/player-edit-review";
import { GET as getNews } from "@/app/api/noticias/route";
import type { PlayerNews } from "@/lib/player-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "private, no-store", Vary: "Cookie"};
const fail = (error: string, status: number) => NextResponse.json({error}, {status, headers});
type Cell = string | number | boolean | null;

// Keep every nested field, including repeated seasons and contacts, in separate columns.
function flatten(value: unknown, prefix = "", result: Record<string, Cell> = {}) {
  if (value === null || value === undefined) {if (prefix) result[prefix] = null;}
  else if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix} ${index + 1}`, result));
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) flatten(item, prefix ? `${prefix} · ${key}` : key, result);
  } else if (prefix) result[prefix] = typeof value === "number" || typeof value === "boolean" ? value : String(value);
  return result;
}
function append(workbook: XLSX.WorkBook, name: string, rows: Record<string, Cell>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  sheet["!cols"] = keys.map(key => ({wch: Math.min(45, Math.max(16, key.length + 2))}));
  if (sheet["!ref"]) sheet["!autofilter"] = {ref: sheet["!ref"]};
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}
export async function POST(request: NextRequest) {
  const denied = await requireConsultation(request); if (denied) return denied;
  if (!sameOrigin(request)) return fail("Origen no permitido.", 403);
  try {
    const {admin} = await catalogAccess(request);
    if (!admin) return fail("Acceso de administrador requerido.", 403);
    const body = await request.json();
    if (!Array.isArray(body.record_ids) || !body.record_ids.length || body.record_ids.length > 10000 || body.record_ids.some((id: unknown) => typeof id !== "string")) return fail("Selecciona registros para exportar.", 400);
    // Resolve IDs through the same access-controlled source used by the screen.
    const response = await getNews(new NextRequest(new URL("/api/noticias", request.url), {headers: request.headers}));
    if (!response.ok) return fail("No se han podido cargar los registros.", 503);
    const source = await response.json() as {news: PlayerNews[]};
    const available = new Map(source.news.map(record => [record.id, record]));
    const records = [...new Set<string>(body.record_ids)].map(id => available.get(id));
    if (records.some(record => !record)) return fail("Algunos registros han cambiado. Recarga la pantalla y vuelve a exportar.", 409);
    const selected = records as PlayerNews[];
    const ids = [...new Set(selected.map(record => record.player_id))];
    const players: Record<string, Cell>[] = [];
    // Bound concurrency so large exports do not flood the data source.
    for (let offset = 0; offset < ids.length; offset += 4) {
      const batch = await Promise.all(ids.slice(offset, offset + 4).map(async id => {
        const data = await loadPlayerReviewData(id);
        if (!data) throw new Error("Missing player");
        const {clubs, staff_options, campus_types, professional_categories, ...profile} = data;
        void clubs; void staff_options; void campus_types; void professional_categories;
        return flatten({"ID jugador": id, ...profile});
      }));
      players.push(...batch);
    }
    const workbook = XLSX.utils.book_new();
    append(workbook, "Jugadores", players);
    append(workbook, "Registros filtrados", selected.map(record => flatten(record)));
    const bytes = XLSX.write(workbook, {type: "buffer", bookType: "xlsx"});
    return new NextResponse(bytes, {headers: {...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="jugadores-filtrados.xlsx"'}});
  } catch {return fail("No se ha podido generar el Excel completo. Vuelve a intentarlo.", 503);}
}
