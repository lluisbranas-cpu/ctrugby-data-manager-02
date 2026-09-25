import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { access, configured, PLAYER, sameOrigin } from "@/lib/pilot";
export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store" },
});
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!configured()) return reply({ error: "Almacenamiento pendiente de conexión." }, 503);
  try {
    const { db, admin } = await access(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (Number(request.headers.get("content-length")) > 3_500_000)
      return reply({ error: "Máximo 3 MB." }, 413);
    const form = await request.formData();
    const file = form.get("file");
    const version = Number(form.get("version"));
    if (!(file instanceof File) || file.size > 3_000_000 || !Number.isInteger(version) || version < 1)
      return reply({ error: "Guarda primero la ficha y elige una imagen de hasta 3 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1)
      return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const circle = Buffer.from('<svg width="300" height="300"><circle cx="150" cy="150" r="150" fill="white"/></svg>');
    const photo = await sharp(bytes, { limitInputPixels: 20_000_000 }).rotate()
      .resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha().composite([{ input: circle, blend: "dest-in" }]).png().toBuffer();
    const key = `${PLAYER}/${crypto.randomUUID()}`;
    const original = `${key}.${metadata.format}`;
    const prepared = `${key}.png`;
    const first = await db.storage.from("pilot-media-private").upload(original, bytes, {
      contentType: `image/${metadata.format}`, upsert: false,
    });
    if (first.error) return reply({ error: "No se ha podido guardar el original." }, 503);
    const second = await db.storage.from("pilot-media-public").upload(prepared, photo, {
      contentType: "image/png", upsert: false, cacheControl: "60",
    });
    if (second.error) {
      await db.storage.from("pilot-media-private").remove([original]);
      return reply({ error: "No se ha podido guardar la copia preparada." }, 503);
    }
    const saved = await db.from("pilot_players").update({ photo_key: prepared, version: version + 1 })
      .eq("id", PLAYER).eq("version", version).select("id");
    if (saved.error || saved.data?.length !== 1) {
      await db.storage.from("pilot-media-public").remove([prepared]);
      await db.storage.from("pilot-media-private").remove([original]);
      return reply({ error: "La ficha ha cambiado o no se pudo guardar. Recarga y repite." }, 409);
    }
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido preparar la imagen. Prueba otra foto más pequeña." }, 400); }
}
