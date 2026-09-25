import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogAccess, catalogClient, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});
const clubColumns = "id,name,active,city,province,region,country,website,instagram,published,version";
const federationColumns = "id,name,scope,territory,country,active,website,published,version";

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return reply({ configured: false, admin: false, clubs: [], federations: [] });
  try {
    const { db, admin } = await catalogAccess(request);
    const [clubs, federations] = await Promise.all([
      db.from("catalog_clubs").select(clubColumns).order("country").order("name"),
      db.from("catalog_federations").select(federationColumns).order("country").order("name"),
    ]);
    if (clubs.error || federations.error) return reply({ error: "No se ha podido leer el catálogo. Comprueba la conexión y las migraciones." }, 503);
    // Las notas y correos internos no se transportan mediante la API de catálogo.
    // Se añadirán a una pantalla privada dedicada cuando se necesite editarlos.
    return reply({ configured: true, admin, clubs: clubs.data, federations: federations.data });
  } catch {
    return reply({ error: "No se ha podido conectar con el catálogo." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 4000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "logout") {
      const response = reply({ ok: true });
      response.cookies.set(CATALOG_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    if (body.action === "login") {
      if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 254 || body.password.length > 1024) return reply({ error: "Credenciales inválidas." }, 400);
      const anonymous = catalogClient();
      const login = await anonymous.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
      if (login.error || !login.data.session) {
        if (login.error?.code === "invalid_credentials") return reply({ error: "Correo o contraseña incorrectos." }, 401);
        return reply({ error: "No se ha podido iniciar sesión. Vuelve a intentarlo." }, 503);
      }
      const token = login.data.session.access_token;
      const role = await catalogClient(token).rpc("app_is_admin");
      if (role.error || role.data !== true) {
        await anonymous.auth.signOut();
        return reply({ error: "Esta cuenta no tiene permiso para gestionar el catálogo." }, 403);
      }
      const response = reply({ ok: true });
      response.cookies.set(CATALOG_COOKIE, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: Math.min(login.data.session.expires_in, 3600) });
      return response;
    }
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (body.action !== "set-publication" || (body.kind !== "club" && body.kind !== "federation") || typeof body.id !== "string" || !/^(?:[A-Z]{3}[0-9]{4}|F[A-Z][0-9]{3})$/.test(body.id) || typeof body.published !== "boolean" || !Number.isInteger(body.version) || body.version < 1) return reply({ error: "Solicitud de publicación no válida." }, 400);
    const table = body.kind === "club" ? "catalog_clubs" : "catalog_federations";
    const update = await db.from(table).update({ published: body.published, version: body.version + 1 }).eq("id", body.id).eq("version", body.version).select("id");
    if (update.error) return reply({ error: "No se ha podido cambiar la publicación." }, 503);
    if (!update.data?.length) return reply({ error: "El registro cambió en otra sesión. Recarga antes de continuar." }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido procesar la solicitud." }, 400);
  }
}
