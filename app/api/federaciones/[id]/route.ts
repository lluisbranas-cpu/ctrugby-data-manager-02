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
    const nextId = typeof body.id === "string" ? body.id.trim().toUpperCase() : "";
    const name = text(body.name, 160);
    const territory = text(body.territory, 120);
    const country = text(body.country, 120);
    const website = body.website === "" || body.website === null ? null : text(body.website, 500);
    const email = body.email === "" || body.email === null || body.email === undefined ? null : text(body.email, 254);
    const country_flag_url = body.country_flag_url === "" || body.country_flag_url === null ? null : text(body.country_flag_url, 500);
    const masculine_nickname = body.masculine_nickname === "" || body.masculine_nickname === null ? null : text(body.masculine_nickname, 120);
    const feminine_nickname = body.feminine_nickname === "" || body.feminine_nickname === null ? null : text(body.feminine_nickname, 120);
    const regional_association_ids = Array.isArray(body.regional_association_ids) && body.regional_association_ids.length <= 1 && body.regional_association_ids.every((value: unknown) => typeof value === "string" && /^(rugby-afrique|asia-rugby|rugby-americas-north|rugby-europe|oceania-rugby|sudamerica-rugby)$/.test(value)) ? body.regional_association_ids : null;
    const regional_membership_status = body.regional_membership_status === "" || body.regional_membership_status === null || body.regional_membership_status === undefined ? null : body.regional_membership_status;
    if (!/^F[A-Z][0-9]{3}$/.test(nextId)) return reply({ error: "El ID debe tener el formato FA001." }, 400);
    if ((body.country_flag_url && (!country_flag_url || !/^https:\/\//i.test(country_flag_url))) || (body.email && (!email || !/^\S+@\S+\.\S+$/.test(email))) || (body.masculine_nickname && !masculine_nickname) || (body.feminine_nickname && !feminine_nickname) || !regional_association_ids || (regional_membership_status !== null && regional_membership_status !== "Pleno derecho" && regional_membership_status !== "Asociado")) return reply({ error: "Revisa los campos adicionales." }, 400);
    if (!name || !territory || !country || (body.scope !== "Nacional" && body.scope !== "Territorial") || typeof body.active !== "boolean" || (body.website && !website)) return reply({ error: "Revisa los datos de la federación." }, 400);
    if (website && !/^https?:\/\//i.test(website)) return reply({ error: "La web debe comenzar por http:// o https://." }, 400);
    const existing = await db.from("catalog_federations").select("id").eq("id", id).maybeSingle();
    if (existing.error) return reply({ error: "No se ha podido comprobar la federación." }, 503);
    const federationValues = { id: nextId, name, scope: body.scope, territory, country, active: body.active, website, country_flag_url, masculine_nickname, feminine_nickname, regional_association_ids, ...(body.regional_membership_status === undefined ? {} : { regional_membership_status }) };
    if (!existing.data) {
      const created = await db.from("catalog_federations").insert({ ...federationValues, published: true }).select("id,name,scope,territory,country,active,website,country_flag_url,masculine_nickname,feminine_nickname,regional_association_ids,regional_membership_status").single();
      if (created.error) return reply({ error: created.error.message || "No se ha podido crear la federación." }, 503);
      if (body.email !== undefined) {
        const savedEmail = await db.schema("app_private").from("federation_notes").upsert({ federation_id: created.data.id, email }, { onConflict: "federation_id" });
        if (savedEmail.error) return reply({ error: "La federación se creó, pero no su correo administrativo." }, 503);
      }
      return reply({ federation: created.data }, 201);
    }
    const idChanged = nextId !== id;
    const dependencies = idChanged ? await Promise.all([db.from("catalog_federation_sports").select("sport_id").eq("federation_id", id)]) : null;
    if (dependencies?.some((result) => result.error)) return reply({ error: "No se han podido preparar las referencias del ID." }, 503);
    if (idChanged) {
      const sportsDelete = await db.from("catalog_federation_sports").delete().eq("federation_id", id);
      if (sportsDelete.error) return reply({ error: "No se ha podido cambiar el ID de la federación." }, 503);
    }
    const update = await db.from("catalog_federations").update(federationValues).eq("id", id).select("id,name,scope,territory,country,active,website,country_flag_url,masculine_nickname,feminine_nickname,regional_association_ids,regional_membership_status").single();
    if (update.error && idChanged && dependencies && dependencies[0].data?.length) await db.from("catalog_federation_sports").insert(dependencies[0].data.map((row) => ({ ...row, federation_id: id })));
    if (!update.error && idChanged && dependencies) {
      const sportsInsert = dependencies[0].data?.length ? await db.from("catalog_federation_sports").insert(dependencies[0].data.map((row) => ({ ...row, federation_id: nextId }))) : { error: null };
      if (sportsInsert.error) return reply({ error: "El ID se ha actualizado, pero no se han podido restaurar todas sus referencias." }, 503);
    }
    if (update.error) return reply({ error: "No se ha podido guardar la federación." }, 503);
    if (body.email !== undefined) {
      const savedEmail = await db.schema("app_private").from("federation_notes").upsert({ federation_id: nextId, email }, { onConflict: "federation_id" });
      if (savedEmail.error) return reply({ error: "La federación se guardó, pero no su correo administrativo." }, 503);
    }
    return reply({ federation: update.data });
  } catch {
    return reply({ error: "No se ha podido procesar la edición." }, 400);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  const { id } = await params;
  if (!/^F[A-Z][0-9]{3}$/.test(id)) return reply({ error: "Identificador de federación no válido." }, 400);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json();
    if (body?.confirmed !== true || body?.confirmation_id !== id) return reply({ error: "Confirma la eliminación escribiendo el ID de la federación." }, 400);
    const result = await db.from("catalog_federations").delete().eq("id", id);
    if (result.error) return reply({ error: "No se ha podido eliminar la federación." }, 503);
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido eliminar la federación." }, 400); }
}
