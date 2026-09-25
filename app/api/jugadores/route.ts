import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; published: boolean; version: number };
type AdminPlayer = Player & { category: string | null; birth_year: number | null; season_count: number; linked_season_count: number };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return reply({ configured: false, admin: false, players: [] });
  try {
    const { db, admin } = await catalogAccess(request);
    const historyId = request.nextUrl.searchParams.get("history");
    if (historyId) {
      if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
      if (!/^CTR[0-9]{4}$/.test(historyId)) return reply({ error: "Jugador no válido." }, 400);
      const history = await db.rpc("admin_player_club_history", { p_player_id: historyId });
      if (history.error) return reply({ error: "No se ha podido leer el historial privado de clubs." }, 503);
      return reply({ player_id: historyId, clubs: history.data ?? [] });
    }
    if (admin) {
      const summary = await db.rpc("admin_player_catalog");
      if (summary.error) return reply({ error: "No se han podido leer los datos privados de jugadores." }, 503);
      return reply({
        configured: true, admin: true,
        players: (summary.data as AdminPlayer[]).map((player) => ({
          id: player.id, first_name: player.first_name, last_name: player.last_name, published: player.published, version: player.version,
          profile: { category: player.category, birth_year: player.birth_year }, season_count: player.season_count, linked_season_count: player.linked_season_count,
        })),
      });
    }
    const players = await db.from("catalog_players").select("id,first_name,last_name,published,version").order("last_name").order("first_name");
    if (players.error) return reply({ error: "No se han podido leer los jugadores. Comprueba la migración de jugadores." }, 503);
    return reply({ configured: true, admin: false, players: players.data });
  } catch {
    return reply({ error: "No se ha podido conectar con el catálogo de jugadores." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const body = await request.json();
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (body.action !== "set-publication" || typeof body.id !== "string" || !/^CTR[0-9]{4}$/.test(body.id) || typeof body.published !== "boolean" || !Number.isInteger(body.version) || body.version < 1) return reply({ error: "Solicitud de publicación no válida." }, 400);
    const update = await db.from("catalog_players").update({ published: body.published, version: body.version + 1, updated_at: new Date().toISOString() }).eq("id", body.id).eq("version", body.version).select("id");
    if (update.error) return reply({ error: "No se ha podido cambiar la publicación." }, 503);
    if (!update.data?.length) return reply({ error: "La ficha cambió en otra sesión. Recarga antes de continuar." }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido procesar la solicitud." }, 400);
  }
}
