import { NextRequest, NextResponse } from "next/server";
import { ensureGroupClubs } from "@/lib/temporary-group-clubs";
import { randomUUID } from "node:crypto";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { changeTemporaryClubGroups, readTemporaryClubGroups, validateTemporaryClubGroup } from "@/lib/temporary-club-groups";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function GET(request: NextRequest) {
  try {
    if (!catalogConfigured()) return reply({ error: "El catálogo no está conectado." }, 503);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const [groups, clubs] = await Promise.all([readTemporaryClubGroups(), db.from("catalog_clubs").select("id,name").order("name")]);
    if (clubs.error) return reply({ error: "No se han podido cargar los clubes." }, 503);
    return reply({ groups, clubs: clubs.data });
  } catch { return reply({ error: "No se han podido cargar las agrupaciones." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    if (!catalogConfigured()) return reply({ error: "El catálogo no está conectado." }, 503);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: "Solicitud demasiado grande." }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error(); }
    catch { return reply({ error: "Solicitud no válida." }, 400); }
    if (!["save", "delete"].includes(String(body.action))) return reply({ error: "Acción no válida." }, 400);
    const id = typeof body.id === "string" ? body.id : "";
    if (body.action === "delete" && !id) return reply({ error: "Agrupación no válida." }, 400);
    let values: ReturnType<typeof validateTemporaryClubGroup> | undefined;
    if (body.action === "save") {
      const clubs = await db.from("catalog_clubs").select("id");
      if (clubs.error) return reply({ error: "No se han podido comprobar los clubes." }, 503);
      try { values = validateTemporaryClubGroup(body, new Set((clubs.data ?? []).map(club => club.id))); }
      catch (error) { return reply({ error: (error as Error).message }, 400); }
    }
    try {
      await changeTemporaryClubGroups(async rows => {
        const previous = rows.find(row => row.id === id);
        if (id && (!previous || previous.version !== body.version)) throw new Error("El registro cambió en otra sesión. Recarga antes de continuar.");
        if (body.action === "delete") return rows.filter(row => row.id !== id);
        if (!values) throw new Error("Datos no válidos.");
        const savedValues = values;
        if (rows.some(row => row.id !== id && row.name.toLocaleLowerCase("es") === savedValues.name.toLocaleLowerCase("es") && row.season === savedValues.season && row.category.toLocaleLowerCase("es") === savedValues.category.toLocaleLowerCase("es"))) throw new Error("Ya existe esa agrupación para la temporada y categoría.");
        const next = [{ ...values, id: id || randomUUID(), club_id: previous?.club_id, version: (previous?.version ?? 0) + 1 }, ...rows.filter(row => row.id !== id)];
        await ensureGroupClubs(next);
        return next;
      });
    } catch (error) {
      if (error instanceof Error && !('code' in error)) return reply({ error: error.message }, 409);
      throw error;
    }
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar la agrupación." }, 503); }
}
