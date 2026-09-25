import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return reply({ error: "La importación local solo está disponible en desarrollo." }, 404);
  if (!sameOrigin(request) || !catalogConfigured()) return reply({ error: "Solicitud no disponible." }, 403);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const root = path.join(process.cwd(), "data", "staging");
    const names = ["staff.json", "milestone-participants.json", "milestones.json", "milestone-sources.json", "player-participation-metrics.json"];
    const values = await Promise.all(names.map(async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"))));
    if (!values.every(Array.isArray)) return reply({ error: "La preparación local no tiene el formato esperado." }, 400);
    const result = await db.rpc("admin_import_milestones", { p_staff: values[0], p_participants: values[1], p_milestones: values[2], p_sources: values[3], p_metrics: values[4] });
    if (result.error) return reply({ error: result.error.message || "No se han podido importar los hitos." }, 503);
    return reply({ ok: true, ...result.data });
  } catch { return reply({ error: "No se ha podido leer la preparación local de hitos." }, 500); }
}
