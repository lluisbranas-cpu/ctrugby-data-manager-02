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
    const root = path.join(process.cwd(), "data", "staging", "player-clubs");
    const [affiliations, clubParticipations] = await Promise.all(["affiliations.json", "club-participations.json"].map(async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"))));
    if (!Array.isArray(affiliations) || !Array.isArray(clubParticipations)) return reply({ error: "La preparación local no tiene el formato esperado." }, 400);
    const result = await db.rpc("admin_import_player_club_data", { p_affiliations: affiliations, p_club_participations: clubParticipations });
    if (result.error) return reply({ error: result.error.message || "No se han podido importar las relaciones jugador-club." }, 503);
    return reply({ ok: true, ...result.data });
  } catch { return reply({ error: "No se ha podido leer la preparación local de relaciones jugador-club." }, 500); }
}
