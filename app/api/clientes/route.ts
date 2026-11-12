import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { validateClientInput } from "@/lib/client-types";
import { likidHubPreviewReadOnly, previewLikidHubClients } from "@/lib/likidhub-preview";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
function databaseError(code: string) {
  if (["42P01", "PGRST205"].includes(code)) return "Falta activar las tablas de clientes en la base de datos (migración 202610240002).";
  if (code === "23505") return "Ya existe un registro con ese nombre.";
  if (code === "23503") return "El tipo está en uso o ya no existe. Revisa los clientes asociados.";
  return "No se ha podido completar la operación. Recarga e inténtalo de nuevo.";
}
export async function GET(request: NextRequest) {
  try {
    if (!catalogConfigured()) return reply({ error: "Base de datos no conectada." }, 503);
    const { db, admin, authenticated } = await catalogAccess(request);
    if (!authenticated) return reply({ error: "Inicia sesión para consultar los clientes." }, 403);
    if (likidHubPreviewReadOnly()) return reply(await previewLikidHubClients());
    const clientColumns = admin
      ? "*"
      : "id,name,type_id,primary_color,secondary_color,accent_color,surname_color,typography,logo";
    const [types, clients] = await Promise.all([
      db.from("catalog_client_types").select(admin ? "*" : "id,name").order("name"),
      db.from("catalog_clients").select(clientColumns).order("name"),
    ]);
    const error = types.error || clients.error;
    if (error) return reply({ error: databaseError(error.code) }, 503);
    return reply({ types: types.data, clients: clients.data });
  } catch { return reply({ error: "No se han podido cargar los clientes." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    if (!catalogConfigured()) return reply({ error: "Base de datos no conectada." }, 503);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const raw = await request.text();
    if (raw.length > 720000) return reply({ error: "El logotipo supera el tamaño permitido." }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); }
    catch { return reply({ error: "Solicitud no válida." }, 400); }
    if (!["type", "client"].includes(String(body.kind)) || !["save", "delete", "save-logo"].includes(String(body.action))) return reply({ error: "Acción no válida." }, 400);
    const table = body.kind === "type" ? "catalog_client_types" : "catalog_clients";
    const id = typeof body.id === "string" ? body.id : "";
    if ((id && !/^[0-9a-f-]{36}$/i.test(id)) || (id && (!Number.isInteger(body.version) || Number(body.version) < 1)) || (body.action === "delete" && !id)) return reply({ error: "Registro no válido." }, 400);
    if (body.action === "save-logo") {
      if (body.kind !== "client" || !id) return reply({ error: "Cliente no válido." }, 400);
      if (typeof body.logo !== "string" || body.logo.length > 700000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(body.logo)) return reply({ error: "El logotipo no tiene un formato válido." }, 400);
      const result = await db.from("catalog_clients").update({ logo: body.logo }).eq("id", id).eq("version", body.version).select("id");
      if (result.error) return reply({ error: databaseError(result.error.code) }, 409);
      if (!result.data?.length) return reply({ error: "El cliente cambió en otra sesión. Recarga antes de subir el logotipo." }, 409);
      return reply({ ok: true });
    }
    let values: Record<string, unknown> = {};
    if (body.action === "save") {
      try { values = validateClientInput(body, body.kind as "type" | "client"); }
      catch (error) { return reply({ error: (error as Error).message }, 400); }
      if (body.kind === "client") {
        const type = await db.from("catalog_client_types").select("track_participations").eq("id", body.type_id).single();
        if (type.error) return reply({ error: "Selecciona un tipo de cliente válido." }, 400);
        if (type.data.track_participations && body.participations === null) return reply({ error: "Indica el número de participaciones para este tipo de cliente." }, 400);
      }
    }
    const result = body.action === "delete"
      ? await db.from(table).delete().eq("id", id).eq("version", body.version).select("id")
      : id ? await db.from(table).update(values).eq("id", id).eq("version", body.version).select("id")
      : await db.from(table).insert(values).select("id");
    if (result.error) return reply({ error: databaseError(result.error.code) }, 409);
    if (!result.data?.length) return reply({ error: "El registro cambió en otra sesión. Recarga antes de guardar." }, 409);
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar el registro." }, 503); }
}
