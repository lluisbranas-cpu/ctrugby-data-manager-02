import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { federationShieldUrls } from "@/app/lib/federation-shields";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { prepareShield } from "@/app/lib/shield-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (id: string) => /^F[A-Z]\d{3}$/.test(id);
const shieldsRoot = path.join(process.cwd(), "public", "federation-shields");
const originalsRoot = path.join(process.cwd(), "data", "staging", "federation-shields", "originales");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(_request);
  if (consultationDenied) return consultationDenied;

  const { id } = await params;
  if (!validId(id)) return new NextResponse(null, { status: 404 });
  try {
    return new NextResponse(await readFile(path.join(shieldsRoot, `${id}.png`)), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch {
    if (federationShieldUrls[id]) return NextResponse.redirect(new URL(federationShieldUrls[id], _request.url));
    const empty = await sharp({ create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    return new NextResponse(empty, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Federacion no valida." }, 404);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const federation = await db.from("catalog_federations").select("id").eq("id", id).maybeSingle();
    if (federation.error) return reply({ error: "No se ha podido comprobar la federacion." }, 503);
    if (!federation.data) return reply({ error: "La federacion no existe." }, 404);
    const form = await request.formData();
    const file = form.get("file");
    const removeBackground = form.get("removeBackground") !== "0";
    if (!(file instanceof File) || !file.size || file.size > 5_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 5 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estatica." }, 400);
    const prepared = await prepareShield(bytes, removeBackground);
    if (prepared.length > 2_000_000) return reply({ error: "La copia preparada supera 2 MB. Reduce el original antes de subirlo." }, 413);
    await Promise.all([mkdir(shieldsRoot, { recursive: true }), mkdir(originalsRoot, { recursive: true })]);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    await writeFile(path.join(originalsRoot, `${id}-${crypto.randomUUID()}.${extension}`), bytes);
    await writeFile(path.join(shieldsRoot, `${id}.png`), prepared);
    return reply({ ok: true, url: `/api/federaciones/escudo/${id}` });
  } catch {
    return reply({ error: "No se ha podido guardar el escudo. Prueba otra imagen." }, 400);
  }
}
