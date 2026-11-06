import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { clubShieldUrls } from "@/app/lib/club-shields";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { prepareShield } from "@/app/lib/shield-processing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clubId = (id: string) => /^[A-Z]{3}\d{4}$/.test(id) ? id : null;
const publicDirectory = path.join(process.cwd(), "public", "club-shields");
const originalsDirectory = path.join(process.cwd(), "data", "staging", "club-shields", "originales");
const preparedPath = (id: string) => path.join(publicDirectory, `${id}.png`);
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(_request);
  if (consultationDenied) return consultationDenied;

  const id = clubId((await context.params).id);
  if (!id) return new NextResponse(null, { status: 404 });
  try {
    const image = await readFile(preparedPath(id));
    return new NextResponse(image, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  } catch {
    const legacy = clubShieldUrls[id];
    if (legacy) {
      // Serve the historical shield through the app instead of redirecting to
      // its old host. Apart from keeping a stable image URL, this lets the
      // call-up generator draw the shield into an exportable JPG canvas.
      try {
        const response = await fetch(legacy, { redirect: "follow" });
        if (response.ok) {
          const source = Buffer.from(await response.arrayBuffer());
          const image = await sharp(source).png().toBuffer();
          return new NextResponse(image, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
        }
      } catch {
        // The transparent fallback below preserves the stable image response.
      }
    }
    // A valid club without a shield still gets a stable image URL. This keeps
    // newly uploaded shields discoverable after reload without broken-image
    // states for clubs that have not received one yet.
    const empty = await sharp({
      create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    return new NextResponse(empty, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = clubId((await context.params).id);
  if (!id) return reply({ error: "Club no válido." }, 404);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData();
    const file = form.get("file");
    const removeBackground = form.get("removeBackground") !== "0";
    if (!(file instanceof File) || file.size === 0 || file.size > 5_000_000)
      return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 5 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1)
      return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);

    await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(originalsDirectory, { recursive: true })]);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    await writeFile(path.join(originalsDirectory, `${id}.${extension}`), bytes);
    const prepared = await prepareShield(bytes, removeBackground);
    if (prepared.length > 2_000_000)
      return reply({ error: "La copia preparada supera 2 MB. Reduce el original antes de subirlo." }, 413);
    await writeFile(preparedPath(id), prepared);
    return reply({ ok: true, url: `/api/clubs/escudo/${id}` });
  } catch {
    return reply({ error: "No se ha podido preparar y guardar el escudo. Prueba otra imagen." }, 400);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = clubId((await context.params).id);
  if (!id) return reply({ error: "Club no válido." }, 404);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    await mkdir(publicDirectory, { recursive: true });
    const transparent = await sharp({
      create: {
        width: 300,
        height: 300,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(preparedPath(id), transparent);
    return reply({ ok: true });
  } catch {
    return reply({ error: "No se ha podido borrar el escudo." }, 400);
  }
}
