import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CoverSettings = { frame: { x: number; y: number; size: number }; removeBackground: boolean; originalWidth: number; originalHeight: number };

const coverRoot = path.join(process.cwd(), "public", "staff-covers");
const originalsRoot = path.join(process.cwd(), "data", "staging", "staff-covers", "originales");
const settingsRoot = path.join(process.cwd(), "data", "staging", "staff-covers", "settings");
const coverPath = (id: string) => path.join(coverRoot, `${id}.webp`);
const settingsPath = (id: string) => path.join(settingsRoot, `${id}.json`);
const validId = (value: string) => /^STF\d{4}$/.test(value) ? value : null;
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const canWrite = async (request: NextRequest) => await catalogAccess(request).then((access) => access.admin).catch(() => false);
const mimeType = (name: string) => name.toLowerCase().endsWith(".png") ? "image/png" : name.toLowerCase().endsWith(".webp") ? "image/webp" : "image/jpeg";
const findOriginal = async (id: string) => (await readdir(originalsRoot).catch(() => [] as string[])).find((name) => new RegExp(`^${id}\\.(png|jpg|webp)$`, "i").test(name)) ?? null;
const validSettings = (value: unknown): CoverSettings | null => {
  const settings = value as Partial<CoverSettings> | null;
  const frame = settings?.frame; const originalWidth = settings?.originalWidth; const originalHeight = settings?.originalHeight;
  if (!settings || !frame || typeof settings.removeBackground !== "boolean") return null;
  if (![frame.x, frame.y, frame.size, originalWidth, originalHeight].every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  if (frame.size <= 0 || originalWidth! <= 0 || originalHeight! <= 0) return null;
  return { frame: { x: frame.x, y: frame.y, size: frame.size }, removeBackground: settings.removeBackground, originalWidth: originalWidth!, originalHeight: originalHeight! };
};

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const id = validId((await context.params).id.toUpperCase());
  if (!id) return new NextResponse(null, { status: 404 });
  if (request.nextUrl.searchParams.get("settings") === "1" || request.nextUrl.searchParams.get("original") === "1") {
    if (!await canWrite(request)) return reply({ error: "Acceso de administrador requerido." }, 403);
    const fileName = await findOriginal(id);
    if (!fileName) return reply({ exists: false });
    if (request.nextUrl.searchParams.get("original") === "1") return new NextResponse(await readFile(path.join(originalsRoot, fileName)), { headers: { "Content-Type": mimeType(fileName), "Cache-Control": "private, no-store" } });
    const settings = await readFile(settingsPath(id), "utf8").then((text) => validSettings(JSON.parse(text))).catch(() => null);
    return reply({ exists: true, fileName, mimeType: mimeType(fileName), settings });
  }
  if (request.nextUrl.searchParams.get("meta") === "1") { try { await access(coverPath(id)); return reply({ exists: true }); } catch { return reply({ exists: false }); } }
  try {
    return new NextResponse(await readFile(coverPath(id)), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
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
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una foto PNG, JPG o WebP estática." }, 400);
    const settings = validSettings(JSON.parse(String(form.get("settings") ?? "null")));
    const edited = form.get("prepared");
    let prepared: Buffer;
    if (edited instanceof File && edited.size) {
      if (!settings) return reply({ error: "La configuración de la foto preparada no es válida." }, 400);
      const editedBytes = Buffer.from(await edited.arrayBuffer());
      const editedMetadata = await sharp(editedBytes, { limitInputPixels: 1_800_000 }).metadata();
      if (editedMetadata.format !== "png" || editedMetadata.width !== 1200 || editedMetadata.height !== 1500 || (editedMetadata.pages ?? 1) > 1) return reply({ error: "La foto preparada debe ser un PNG de 1200 x 1500." }, 400);
      prepared = await sharp(editedBytes).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
    } else {
      prepared = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(1200, 1500, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
    }
    await Promise.all([mkdir(coverRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true }), mkdir(settingsRoot, { recursive: true })]);
    const previous = (await readdir(originalsRoot).catch(() => [] as string[])).filter((name) => new RegExp(`^${id}\\.(png|jpg|webp)$`, "i").test(name));
    await Promise.all(previous.map((name) => rm(path.join(originalsRoot, name), { force: true })));
    await Promise.all([
      writeFile(coverPath(id), prepared),
      writeFile(path.join(originalsRoot, `${id}.${metadata.format === "jpeg" ? "jpg" : metadata.format}`), bytes),
      settings ? writeFile(settingsPath(id), JSON.stringify(settings)) : rm(settingsPath(id), { force: true }),
    ]);
    return reply({ ok: true, url: `/api/staff/portada/${id}` });
  } catch {
    return reply({ error: "No se ha podido guardar la foto de cabecera." }, 400);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Miembro de staff no válido." }, 404);
  if (!await canWrite(request)) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    await rm(coverPath(id), { force: true });
    await rm(settingsPath(id), { force: true });
    const originals = await readdir(originalsRoot).catch(() => [] as string[]);
    await Promise.all(originals.filter((name) => new RegExp(`^${id}\\.(png|jpg|webp)$`, "i").test(name)).map((name) => rm(path.join(originalsRoot, name), { force: true })));
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido eliminar la foto de cabecera." }, 400);
  }
}
