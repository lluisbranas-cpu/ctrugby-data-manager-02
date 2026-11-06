import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { prepareShield } from "@/app/lib/shield-processing";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { readProfessionalCategories, validProfessionalCategoryId } from "@/lib/professional-club-milestones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicDirectory = path.join(process.cwd(), "public", "professional-category-shields");
const originalsDirectory = path.join(process.cwd(), "data", "staging", "professional-category-shields", "originales");
const shieldPath = (id: string) => path.join(publicDirectory, `${id}.png`);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

async function canWrite(request: NextRequest) {
  if (!catalogConfigured()) return true;
  const { admin } = await catalogAccess(request);
  return admin;
}

async function categoryExists(id: string) {
  return (await readProfessionalCategories()).some((category) => category.id === id);
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(_request);
  if (consultationDenied) return consultationDenied;

  const id = (await context.params).id.toUpperCase();
  if (!validProfessionalCategoryId(id)) return new NextResponse(null, { status: 404 });
  try {
    return new NextResponse(await readFile(shieldPath(id)), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch {
    const empty = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    return new NextResponse(empty, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = (await context.params).id.toUpperCase();
  if (!validProfessionalCategoryId(id)) return reply({ error: "Categoría no válida." }, 404);
  try {
    if (!(await canWrite(request))) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (!(await categoryExists(id))) return reply({ error: "La categoría profesional no existe." }, 404);
    const form = await request.formData();
    const file = form.get("file");
    const removeBackground = form.get("removeBackground") !== "0";
    if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 5 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const prepared = await prepareShield(bytes, removeBackground);
    if (prepared.length > 2_000_000) return reply({ error: "La copia preparada supera 2 MB. Reduce el original antes de subirlo." }, 413);
    if (form.get("preview") === "1") return new NextResponse(prepared, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
    await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(originalsDirectory, { recursive: true })]);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    await writeFile(path.join(originalsDirectory, `${id}-${crypto.randomUUID()}.${extension}`), bytes);
    await writeFile(shieldPath(id), prepared);
    return reply({ ok: true, url: `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo` });
  } catch {
    return reply({ error: "No se ha podido preparar y guardar el escudo. Prueba otra imagen." }, 400);
  }
}
