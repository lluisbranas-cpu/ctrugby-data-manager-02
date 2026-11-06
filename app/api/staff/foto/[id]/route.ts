import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const photoRoot = path.join(process.cwd(), "public", "staff-photos");
const originalsRoot = path.join(process.cwd(), "data", "staging", "staff-photos", "originales");
const photoPath = (id: string) => path.join(photoRoot, `${id}.webp`);
const validId = (value: string) => /^STF\d{4}$/.test(value) ? value : null;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const canWrite = async (request: NextRequest) => await catalogAccess(request).then((access) => access.admin).catch(() => false);
const gray = { r: 226, g: 231, b: 234, alpha: 1 };

function removeConnectedBackground(input: Buffer, width: number, height: number) {
  const output = Buffer.from(input); const pixelCount = width * height; const visited = new Uint8Array(pixelCount); const stack: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].filter((index) => index >= 0 && index < pixelCount);
  const background = corners.reduce((sum, index) => { const offset = index * 4; return { r: sum.r + input[offset], g: sum.g + input[offset + 1], b: sum.b + input[offset + 2], a: sum.a + input[offset + 3] }; }, { r: 0, g: 0, b: 0, a: 0 });
  const samples = Math.max(1, corners.length); const reference = { r: background.r / samples, g: background.g / samples, b: background.b / samples, a: background.a / samples };
  const isBackground = (index: number) => {
    const offset = index * 4; const alpha = input[offset + 3];
    if (alpha < 12) return true;
    const r = input[offset], g = input[offset + 1], b = input[offset + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return (min > 238 && max - min < 22) || (Math.hypot(r - reference.r, g - reference.g, b - reference.b) < 44 && Math.abs(alpha - reference.a) < 70);
  };
  const push = (index: number) => { if (index < 0 || index >= pixelCount || visited[index] || !isBackground(index)) return; visited[index] = 1; stack.push(index); };
  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { push(y * width); push(y * width + width - 1); }
  while (stack.length) { const index = stack.pop()!; const x = index % width; if (x > 0) push(index - 1); if (x < width - 1) push(index + 1); if (index >= width) push(index - width); if (index < pixelCount - width) push(index + width); }
  for (let index = 0; index < pixelCount; index++) if (visited[index]) { const offset = index * 4; output[offset] = 0; output[offset + 1] = 0; output[offset + 2] = 0; output[offset + 3] = 0; }
  return output;
}

function alphaBoundingBox(input: Buffer, width: number, height: number) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (input[((y * width) + x) * 4 + 3] >= 16) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  return maxX < minX || maxY < minY ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const id = validId((await context.params).id.toUpperCase());
  if (!id) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("meta") === "1") {
    try { await access(photoPath(id)); return reply({ exists: true }); } catch { return reply({ exists: false }); }
  }
  try {
    return new NextResponse(await readFile(photoPath(id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
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
      if (editedMetadata.format !== "png" || editedMetadata.width !== 600 || editedMetadata.height !== 600 || (editedMetadata.pages ?? 1) > 1) return reply({ error: "La foto preparada debe ser un PNG de 600 x 600." }, 400);
      prepared = await sharp(editedBytes).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    } else {
      const normalized = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const cutout = removeConnectedBackground(normalized.data, normalized.info.width, normalized.info.height);
      const box = alphaBoundingBox(cutout, normalized.info.width, normalized.info.height);
      const subject = box
        ? sharp(cutout, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } }).extract(box)
        : sharp(cutout, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } });
      prepared = await sharp({ create: { width: 600, height: 600, channels: 4, background: gray } })
        .composite([{ input: await subject.resize(540, 540, { fit: "contain", withoutEnlargement: true }).png().toBuffer(), gravity: "center" }])
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();
    }
    await Promise.all([mkdir(photoRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true })]);
    await Promise.all([
      writeFile(photoPath(id), prepared),
      writeFile(path.join(originalsRoot, `${id}.${metadata.format === "jpeg" ? "jpg" : metadata.format}`), bytes),
    ]);
    return reply({ ok: true, url: `/api/staff/foto/${id}` });
  } catch {
    return reply({ error: "No se ha podido guardar la foto." }, 400);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Miembro de staff no válido." }, 404);
  if (!await canWrite(request)) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    await rm(photoPath(id), { force: true });
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido eliminar la foto." }, 400);
  }
}
