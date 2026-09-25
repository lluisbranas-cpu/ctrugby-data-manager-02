import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null };
type Season = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return reply({ error: "La importación local solo está disponible en desarrollo." }, 404);
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const staging = path.join(process.cwd(), "data", "staging");
    const [playersRaw, seasonsRaw] = await Promise.all([
      readFile(path.join(staging, "players.json"), "utf8"),
      readFile(path.join(staging, "player-seasons.json"), "utf8"),
    ]);
    const players = JSON.parse(playersRaw) as Player[];
    const seasons = JSON.parse(seasonsRaw) as Season[];
    if (!Array.isArray(players) || !Array.isArray(seasons)) return reply({ error: "La preparación local no tiene el formato esperado." }, 400);
    const imported = await db.rpc("admin_import_players", {
      p_players: players.map(({ id, first_name, last_name }) => ({ id, first_name, last_name })),
      p_profiles: players.map(({ id, category, birth_year }) => ({ player_id: id, category, birth_year })),
      p_seasons: seasons,
    });
    if (imported.error) return reply({ error: imported.error.message || "No se han podido importar los jugadores." }, 503);
    return reply({ ok: true, ...imported.data });
  } catch {
    return reply({ error: "No se ha podido leer la preparación local de jugadores." }, 500);
  }
}
