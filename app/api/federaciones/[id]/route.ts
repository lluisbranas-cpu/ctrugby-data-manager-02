import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  const { id } = await params;
  if (!/^F[A-Z][0-9]{3}$/.test(id)) return reply({ error: "Identificador de federación no válido." }, 400);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json();
    const text = (value: unknown, maximum: number) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum ? value.trim() : null;
    const name = text(body.name, 160);
    const territory = text(body.territory, 120);
    const country = text(body.country, 120);
    const website = body.website === "" || body.website === null ? null : text(body.website, 500);
    if (!name || !territory || !country || (body.scope !== "Nacional" && body.scope !== "Territorial") || typeof body.active !== "boolean" || (body.website && !website)) return reply({ error: "Revisa los datos de la federación." }, 400);
    if (website && !/^https?:\/\//i.test(website)) return reply({ error: "La web debe comenzar por http:// o https://." }, 400);
    const update = await db.from("catalog_federations").update({ name, scope: body.scope, territory, country, active: body.active, website }).eq("id", id).select("id,name,scope,territory,country,active,website").single();
    if (update.error) return reply({ error: "No se ha podido guardar la federación." }, 503);
    return reply({ federation: update.data });
  } catch {
    return reply({ error: "No se ha podido procesar la edición." }, 400);
  }
}
