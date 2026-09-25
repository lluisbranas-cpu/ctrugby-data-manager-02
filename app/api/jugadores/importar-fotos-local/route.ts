import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return reply({ error: "La importación local solo está disponible en desarrollo." }, 404);
  if (!sameOrigin(request) || !catalogConfigured()) return reply({ error: "Solicitud no disponible." }, 403);
  const uploaded: string[] = [];
  let db: Awaited<ReturnType<typeof catalogAccess>>["db"] | null = null;
  try {
    const access = await catalogAccess(request);
    db = access.db;
    if (!access.admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const root = path.join(process.cwd(), "data", "staging", "player-photos");
    const photos = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
    if (!Array.isArray(photos)) return reply({ error: "La preparación local no tiene el formato esperado." }, 400);
    for (const photo of photos) {
      const bytes = await readFile(photo.prepared_file);
      const saved = await db.storage.from("catalog-media-private").upload(photo.storage_key, bytes, { contentType: "image/png", cacheControl: "31536000", upsert: false });
      if (saved.error) throw new Error(`No se ha podido guardar una fotografía: ${saved.error.message}`);
      uploaded.push(photo.storage_key);
    }
    const result = await db.rpc("admin_import_player_profile_photos", { p_photos: photos.map(({ player_id, storage_key }) => ({ player_id, storage_key })) });
    if (result.error) {
      await db.storage.from("catalog-media-private").remove(uploaded);
      return reply({ error: result.error.message || "No se han podido asociar las fotografías." }, 503);
    }
    return reply({ ok: true, uploaded_photos: uploaded.length, ...result.data });
  } catch (error) {
    if (db && uploaded.length) await db.storage.from("catalog-media-private").remove(uploaded);
    return reply({ error: error instanceof Error ? error.message : "No se ha podido leer la preparación local de fotografías." }, 500);
  }
}
