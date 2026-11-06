import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function GET(request: NextRequest) {
  try {
    if (!catalogConfigured()) return reply({ error: "Base de datos no conectada." }, 503);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Inicia sesión como administrador para consultar patrocinadores." }, 403);
    const [sponsors, assignments, clubs] = await Promise.all([
      db.from("catalog_sponsors").select("id,sponsor_code,name,website,logo_url,active").order("sponsor_code").range(0, 9999),
      db.from("club_season_sponsors").select("club_id,season_year,sponsor_id,relationship_type,placement,verification_status,notes,evidence").order("season_year", { ascending: false }).order("club_id").order("sponsor_id").range(0, 9999),
      db.from("catalog_clubs").select("id,name").order("name").range(0, 9999),
    ]);
    if (sponsors.error || assignments.error || clubs.error) return reply({ error: "No se han podido cargar las tablas de patrocinadores. Vuelve a intentarlo." }, 503);
    return reply({ sponsors: sponsors.data, assignments: assignments.data, clubs: clubs.data });
  } catch { return reply({ error: "No se han podido cargar los patrocinadores." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    if (!catalogConfigured()) return reply({ error: "Base de datos no conectada." }, 503);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const raw = await request.text();
    if (raw.length > 720000) return reply({ error: "El logotipo supera el tamaño permitido." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.action !== "save-logo" || typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return reply({ error: "Solicitud no válida." }, 400);
    if (typeof body.logo !== "string" || body.logo.length > 700000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.logo)) return reply({ error: "El logotipo no tiene un formato válido." }, 400);
    const result = await db.from("catalog_sponsors").update({ logo_url: body.logo }).eq("id", body.id).select("id");
    if (result.error || !result.data?.length) return reply({ error: "No se ha podido guardar el logotipo." }, 409);
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar el logotipo." }, 503); }
}
