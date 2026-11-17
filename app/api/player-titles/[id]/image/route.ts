import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, catalogServiceClient, sameOrigin } from "@/lib/catalog";
import { isLocalRequestOrigin } from "@/lib/request-origin";
import { PlayerTitleNotFoundError, readPlayerTitles, updatePlayerTitleImageMetadata } from "@/lib/player-title-store";
import { operationalMediaBucket } from "@/lib/operational-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
const imagePath = (key: string) => `player-title-images/${key}.webp`;
const validId = (id: string) => /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/.test(id);
async function checkAdmin(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!isLocalRequestOrigin(request)) {
    return reply({ error: "La gestión de imágenes solo está disponible en la administración local." }, 403);
  }
  if (!catalogConfigured()) return reply({ error: "Catálogo no disponible." }, 503);
  let admin: boolean;
  try {
    admin = (await catalogAccess(request)).admin;
  } catch {
    return reply({ error: "No se ha podido comprobar el acceso de administrador." }, 503);
  }
  return admin ? null : reply({ error: "Acceso de administrador requerido." }, 403);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!validId(id)) return new NextResponse(null, { status: 404, headers });
  try {
    const title = (await readPlayerTitles()).find((item) => item.id === id);
    if (!title?.image_key || !title.image_updated_at || !/^[a-f0-9-]{36}$/i.test(title.image_key)) {
      return new NextResponse(null, { status: 404, headers });
    }
    const remote = await catalogServiceClient().storage.from(operationalMediaBucket).download(imagePath(title.image_key));
    if (remote.error || !remote.data) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(Buffer.from(await remote.data.arrayBuffer()), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new NextResponse(null, { status: 404, headers });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(request);
  if (denied) return denied;
  const id = (await context.params).id;
  if (!validId(id)) return reply({ error: "ID-Título no válido." }, 400);

  try {
    const title = (await readPlayerTitles()).find((item) => item.id === id);
    if (!title) return reply({ error: "No se ha encontrado el título." }, 404);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return reply({ error: "Elige una imagen JPG, PNG o WebP de hasta 8 MB." }, 400);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) return reply({ error: "El archivo no contiene una imagen válida." }, 400);
    const image = await sharp(bytes, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1400, height: 1000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
    const key = title.image_key ?? randomUUID();
    const uploaded = await catalogServiceClient().storage.from(operationalMediaBucket).upload(imagePath(key), image, {
      contentType: "image/webp", upsert: true, cacheControl: "31536000",
    });
    if (uploaded.error) throw new Error(uploaded.error.message);
    const saved = await updatePlayerTitleImageMetadata(id, new Date().toISOString(), key);
    return reply({ ok: true, title: saved.title, titles: saved.titles });
  } catch (error) {
    if (error instanceof PlayerTitleNotFoundError) return reply({ error: error.message }, 404);
    return reply({ error: "No se ha podido guardar la imagen. Prueba con otra imagen JPG, PNG o WebP." }, 500);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await checkAdmin(request);
  if (denied) return denied;
  const id = (await context.params).id;
  if (!validId(id)) return reply({ error: "ID-Título no válido." }, 400);

  try {
    const title = (await readPlayerTitles()).find((item) => item.id === id);
    if (!title) return reply({ error: "No se ha encontrado el título." }, 404);
    if (title.image_key) {
      const removed = await catalogServiceClient().storage.from(operationalMediaBucket).remove([imagePath(title.image_key)]);
      if (removed.error) throw new Error(removed.error.message);
    }
    const saved = await updatePlayerTitleImageMetadata(id, null);
    return reply({ ok: true, title: saved.title, titles: saved.titles });
  } catch (error) {
    if (error instanceof PlayerTitleNotFoundError) return reply({ error: error.message }, 404);
    return reply({ error: "No se ha podido eliminar la imagen." }, 500);
  }
}
