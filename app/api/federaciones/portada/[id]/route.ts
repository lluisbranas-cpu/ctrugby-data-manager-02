import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (id: string) => id === "directorio" || /^F[A-Z]\d{3}$/.test(id) ? id : null;
const coversRoot = path.join(process.cwd(), "public", "federation-covers");
const originalsRoot = path.join(process.cwd(), "data", "staging", "federation-covers", "originales");
const coverPath = (id: string) => path.join(coversRoot, `${id}.webp`);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("meta") === "1") { try { await access(coverPath(id)); return reply({ exists: true }); } catch { return reply({ exists: false }); } }
  try { return new NextResponse(await readFile(coverPath(id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } }); } catch { return new NextResponse(null, { status: 404 }); }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return reply({ error: "Federación no válida." }, 404);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 8_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!( ["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    const prepared = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize({ width: 1920, height: 1000, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    await Promise.all([mkdir(coversRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true })]);
    await Promise.all([writeFile(coverPath(id), prepared), writeFile(path.join(originalsRoot, `${id}.${extension}`), bytes)]);
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar la imagen de cabecera." }, 400); }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const rawId = (await context.params).id;
  const id = validId(rawId.toLowerCase() === "directorio" ? "directorio" : rawId.toUpperCase());
  if (!id) return reply({ error: "Federación no válida." }, 404);
  try { const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403); await rm(coverPath(id), { force: true }); return reply({ ok: true }); } catch { return reply({ error: "No se ha podido borrar la imagen de cabecera." }, 400); }
}
