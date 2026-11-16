import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { isLocalRequestOrigin } from "@/lib/request-origin";
import { PlayerTitleNotFoundError, readPlayerTitles, updatePlayerTitleImageMetadata } from "@/lib/player-title-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
const imageDirectory = () => path.join(process.cwd(), "data", "staging", "player-title-images");
const imagePath = (key: string) => path.join(imageDirectory(), `${key}.webp`);
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
    return new NextResponse(await readFile(imagePath(title.image_key)), {
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
    await mkdir(imageDirectory(), { recursive: true });
    const target = imagePath(key);
    const temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, image);
    await rename(temporary, target);
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
    const saved = await updatePlayerTitleImageMetadata(id, null);
    if (title.image_key) await rm(imagePath(title.image_key), { force: true });
    return reply({ ok: true, title: saved.title, titles: saved.titles });
  } catch (error) {
    if (error instanceof PlayerTitleNotFoundError) return reply({ error: error.message }, 404);
    return reply({ error: "No se ha podido eliminar la imagen." }, 500);
  }
}
