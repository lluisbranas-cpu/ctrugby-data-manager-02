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
    const raw = await readFile(path.join(process.cwd(), "data", "staging", "milestone-sources.json"), "utf8");
    const sources = JSON.parse(raw);
    if (!Array.isArray(sources)) return reply({ error: "La preparación local de fuentes no tiene el formato esperado." }, 400);
    const result = await db.rpc("admin_upsert_milestone_sources", { p_sources: sources });
    if (result.error) return reply({ error: result.error.message || "No se han podido actualizar las fuentes." }, 503);
    return reply({ ok: true, ...result.data });
  } catch {
    return reply({ error: "No se ha podido leer la preparación local de fuentes." }, 500);
  }
}
