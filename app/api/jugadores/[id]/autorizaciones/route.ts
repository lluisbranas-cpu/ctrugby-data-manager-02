import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
async function owner(request: NextRequest, id: string) {
  if (!/^JUG\d{4}$/.test(id) || !catalogConfigured()) return null;
  const access = await catalogAccess(request);
  if (!access.authenticated || access.admin) return null;
  const allowed = await access.db.rpc("app_owns_player", { p_player_id: id });
  return allowed.data === true && !allowed.error ? access.db : null;
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const db = await owner(request, id);
    if (!db) return reply({ can_manage: false }, 403);
    const result = await db.rpc("app_player_club_permissions", { p_player_id: id });
    return result.error ? reply({ error: "No se han podido cargar las autorizaciones." }, 503) : reply({ can_manage: true, ...result.data });
  } catch { return reply({ error: "No se han podido cargar las autorizaciones." }, 503); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const id = (await params).id;
    const db = await owner(request, id);
    if (!db) return reply({ error: "Solo el jugador o su tutor puede cambiar las autorizaciones." }, 403);
    const raw = await request.text();
    if (raw.length > 1000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (typeof body?.club_id !== "string" || body.club_id.length > 30 || typeof body.active !== "boolean") return reply({ error: "Autorización no válida." }, 400);
    const result = await db.rpc("app_set_player_club_permission", { p_player_id: id, p_club_id: body.club_id, p_active: body.active });
    return result.error ? reply({ error: "No se ha podido guardar la autorización." }, 403) : reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar la autorización." }, 400); }
}
