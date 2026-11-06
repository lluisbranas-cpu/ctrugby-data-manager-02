import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (id: string) => id === "directorio" || /^[A-Z]{3}\d{4}$/.test(id) ? id : null;
const coversRoot = path.join(process.cwd(), "public", "club-covers");
const originalsRoot = path.join(process.cwd(), "data", "staging", "club-covers", "originales");
const fallbackPath = path.join(process.cwd(), "public", "club-backgrounds", "campo-rugby-generico.png");
const coverPath = (id: string) => path.join(coversRoot, `${id}.webp`);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("meta") === "1") { try { await access(coverPath(id)); return reply({ exists: true }); } catch { return reply({ exists: false }); } }
  try { return new NextResponse(await readFile(coverPath(id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } }); }
  catch { try { return new NextResponse(await readFile(fallbackPath), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } }); } catch { return new NextResponse(null, { status: 404 }); } }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return reply({ error: "Club no válido." }, 404);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    let prepared: Buffer;
    const rawFrame = form.get("frame");
    if (rawFrame !== null) {
      if (typeof rawFrame !== "string") return reply({ error: "Encuadre no válido." }, 400);
      let frame: { zoom: number; x: number; y: number; aspect: number };
      try { frame = JSON.parse(rawFrame); } catch { return reply({ error: "Encuadre no válido." }, 400); }
      if (!frame || ![frame.zoom, frame.x, frame.y, frame.aspect].every(Number.isFinite) || frame.zoom < 1 || frame.zoom > 4 || frame.x < 0 || frame.x > 1 || frame.y < 0 || frame.y > 1 || frame.aspect < 1 || frame.aspect > 6) return reply({ error: "Encuadre no válido." }, 400);
      const oriented = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().toBuffer({ resolveWithObject: true });
      const sourceWidth = oriented.info.width, sourceHeight = oriented.info.height;
      const width = Math.max(1, Math.min(sourceWidth, Math.round(Math.min(sourceWidth, sourceHeight * frame.aspect) / frame.zoom)));
      const height = Math.max(1, Math.min(sourceHeight, Math.round(width / frame.aspect)));
      const left = Math.round((sourceWidth - width) * frame.x), top = Math.round((sourceHeight - height) * frame.y);
      prepared = await sharp(oriented.data).extract({ left, top, width, height }).resize(1920, Math.round(1920 / frame.aspect)).webp({ quality: 88 }).toBuffer();
    } else {
      prepared = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize({ width: 1920, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    }
    await Promise.all([mkdir(coversRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true })]);
    await Promise.all([writeFile(coverPath(id), prepared), writeFile(path.join(originalsRoot, `${id}.${extension}`), bytes)]);
    return reply({ ok: true, url: `/api/clubs/portada/${id}` });
  } catch { return reply({ error: "No se ha podido guardar la portada." }, 400); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return reply({ error: "Club no válido." }, 404);
  try { const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403); await rm(coverPath(id), { force: true }); return reply({ ok: true }); } catch { return reply({ error: "No se ha podido borrar la imagen de cabecera." }, 400); }
}
