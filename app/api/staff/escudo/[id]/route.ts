import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const shieldRoot = path.join(process.cwd(), "public", "staff-shields");
const originalsRoot = path.join(process.cwd(), "data", "staging", "staff-shields", "originales");
const shieldPath = (id: string) => path.join(shieldRoot, `${id}.webp`);
const validId = (value: string) => /^STF\d{4}$/.test(value) ? value : null;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const canWrite = async (request: NextRequest) => await catalogAccess(request).then((access) => access.admin).catch(() => false);

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const id = validId((await context.params).id.toUpperCase());
  if (!id) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("meta") === "1") {
    try { await access(shieldPath(id)); return reply({ exists: true }); } catch { return reply({ exists: false }); }
  }
  try {
    return new NextResponse(await readFile(shieldPath(id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Miembro de staff no válido." }, 404);
  if (!await canWrite(request)) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 8_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const edited = form.get("prepared");
    let prepared: Buffer;
    if (edited instanceof File && edited.size) {
      const editedBytes = Buffer.from(await edited.arrayBuffer());
      const editedMetadata = await sharp(editedBytes, { limitInputPixels: 1_500_000 }).metadata();
      if (editedMetadata.format !== "png" || editedMetadata.width !== 600 || editedMetadata.height !== 600 || (editedMetadata.pages ?? 1) > 1) return reply({ error: "El escudo preparado debe ser un PNG de 600 x 600." }, 400);
      prepared = await sharp(editedBytes).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    } else {
      prepared = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(600, 600, { fit: "contain", withoutEnlargement: true, background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
    }
    await Promise.all([mkdir(shieldRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true })]);
    await Promise.all([
      writeFile(shieldPath(id), prepared),
      writeFile(path.join(originalsRoot, `${id}.${metadata.format === "jpeg" ? "jpg" : metadata.format}`), bytes),
    ]);
    return reply({ ok: true, url: `/api/staff/escudo/${id}` });
  } catch {
    return reply({ error: "No se ha podido guardar el escudo asociado." }, 400);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Miembro de staff no válido." }, 404);
  if (!await canWrite(request)) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    await rm(shieldPath(id), { force: true });
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido eliminar el escudo asociado." }, 400);
  }
}
