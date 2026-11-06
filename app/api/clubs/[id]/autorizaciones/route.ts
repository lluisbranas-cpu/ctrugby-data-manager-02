import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(id) || !catalogConfigured()) return reply({ error: "Club no válido." }, 400);
    const { db, authenticated } = await catalogAccess(request);
    if (!authenticated) return reply({ error: "Acceso privado de club requerido." }, 403);
    const result = await db.rpc("app_club_authorized_players", { p_club_id: id });
    if (result.error) return reply({ error: "No tienes acceso privado a este club." }, 403);
    return reply({ players: result.data ?? [] });
  } catch { return reply({ error: "No se han podido cargar las autorizaciones." }, 503); }
}
