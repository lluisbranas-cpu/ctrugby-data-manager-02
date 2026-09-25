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
    const { admin } = access;
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const root = path.join(process.cwd(), "data", "staging", "rwc-2025");
    const [participants, milestones, sources, media] = await Promise.all(["participants.json", "milestones.json", "sources.json", "media.json"].map(async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"))));
    if (![participants, milestones, sources, media].every(Array.isArray)) return reply({ error: "La preparación local no tiene el formato esperado." }, 400);
    for (const image of media) {
      const bytes = await readFile(image.source_file);
      const saved = await db.storage.from("catalog-media-private").upload(image.image_key, bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (saved.error) throw new Error(`No se ha podido guardar una fotografía: ${saved.error.message}`);
      uploaded.push(image.image_key);
    }
    const result = await db.rpc("admin_import_rwc_2025", { p_participants: participants, p_milestones: milestones, p_sources: sources });
    if (result.error) {
      await db.storage.from("catalog-media-private").remove(uploaded);
      return reply({ error: result.error.message || "No se ha podido importar la convocatoria." }, 503);
    }
    return reply({ ok: true, uploaded_photos: uploaded.length, ...result.data });
  } catch (error) {
    if (db && uploaded.length) await db.storage.from("catalog-media-private").remove(uploaded);
    return reply({ error: error instanceof Error ? error.message : "No se ha podido leer la preparación local de la convocatoria." }, 500);
  }
}
