import { withGroupClubs } from "@/lib/temporary-group-clubs";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { inferClubLocation } from "@/lib/club-location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});
const clubColumns = "id,name,active,founded_text,disappeared_text,city,province,region,country,latitude,longitude,maps_url,website,instagram,published,version";
const federationColumns = "id,name,scope,territory,country,active,website,published,version";
const text = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : null;
const httpsUrl = (value: string | null, required = false) => {
  if (!value) return required ? null : "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
};
const optionalCoordinate = (value: unknown, minimum: number, maximum: number) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : undefined;
};

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

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
    return reply({ configured: true, admin, clubs: await withGroupClubs(clubs.data ?? []), federations: federations.data });
  } catch {
    return reply({ error: "No se ha podido conectar con el catálogo." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 8000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "logout") {
      const response = reply({ ok: true });
      response.cookies.set(CATALOG_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    if (body.action === "login") return reply({ error: "Entra desde Acceso privado y confirma tu app autenticadora." }, 403);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (body.action === "create-club") {
      const id = text(body.id, 7)?.toUpperCase();
      const name = text(body.name, 160); const city = text(body.city, 120); const province = text(body.province, 120); const region = text(body.region, 120); const country = text(body.country, 120);
      const founded = text(body.founded_text, 160); const disappeared = text(body.disappeared_text, 160); const website = text(body.website, 500); const instagram = text(body.instagram, 160);
      if (disappeared && (!/^\d{4}$/.test(disappeared) || Number(disappeared) < 1800 || Number(disappeared) > new Date().getFullYear())) return reply({ error: "El año de desaparición debe ser un año válido." }, 400);
      if (disappeared && body.active === true) return reply({ error: "Un club desaparecido debe estar marcado como inactivo." }, 400);
      const submittedMapsUrl = httpsUrl(text(body.maps_url, 1000)); const webUrl = httpsUrl(website);
      const latitude = optionalCoordinate(body.latitude, -90, 90); const longitude = optionalCoordinate(body.longitude, -180, 180);
      if (!id || !/^[A-Z]{3}[0-9]{4}$/.test(id)) return reply({ error: "El ID del club debe tener el formato AAA0000." }, 400);
      if (!name || !city || !province || !region || !country) return reply({ error: "Completa nombre, ciudad, provincia, región y país." }, 400);
      if (latitude === undefined || longitude === undefined) return reply({ error: "Las coordenadas deben estar dentro de rango." }, 400);
      if (submittedMapsUrl === null) return reply({ error: "La URL de mapa debe ser una dirección https:// válida." }, 400);
      if (website && !webUrl) return reply({ error: "La web debe ser una dirección https:// válida." }, 400);
      if (instagram && !/^@\S+$/.test(instagram)) return reply({ error: "Instagram debe empezar con @ y no contener espacios." }, 400);
      if (typeof body.active !== "boolean" || typeof body.published !== "boolean") return reply({ error: "Estado y publicación deben estar indicados." }, 400);
      const inferredLocation = latitude === null || longitude === null || !submittedMapsUrl ? inferClubLocation({ name, city, province, region, country }) : null;
      const resolvedLatitude = latitude ?? inferredLocation?.latitude ?? 0;
      const resolvedLongitude = longitude ?? inferredLocation?.longitude ?? 0;
      const resolvedMapsUrl = submittedMapsUrl || inferredLocation?.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([name, city, province, country].filter(Boolean).join(", "))}`;
      const exists = await db.from("catalog_clubs").select("id").eq("id", id).maybeSingle();
      if (exists.error) return reply({ error: "No se ha podido comprobar el ID del club." }, 503);
      if (exists.data) return reply({ error: "Ya existe un club con ese ID." }, 409);
      const insert = await db.from("catalog_clubs").insert({
        id, name, active: body.active, founded_text: founded || null, disappeared_text: disappeared || null,
        city, province, region, country, latitude: resolvedLatitude, longitude: resolvedLongitude, maps_url: resolvedMapsUrl, website: webUrl || null,
        instagram: instagram || null, published: body.published, version: 1,
      }).select("id").maybeSingle();
      if (insert.error || !insert.data) return reply({ error: "No se ha podido crear el club." }, 503);
      return reply({ ok: true, id });
    }
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
