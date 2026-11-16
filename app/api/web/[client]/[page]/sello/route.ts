import { catalogAccess, catalogServiceClient, sameOrigin } from "@/lib/catalog";
import { operationalMediaBucket } from "@/lib/operational-store";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowed = (client: string, page: string) => client.toUpperCase() === "ESP022" && page.toLowerCase() === "home";
const localPath = () => path.join(process.cwd(), "public", "web-media", "ESP022-seal.webp");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: NextRequest, context: RouteContext<"/api/web/[client]/[page]/sello">) {
  const { client, page } = await context.params;
  if (!allowed(client, page)) return new NextResponse(null, { status: 404 });
  try { return new NextResponse(await readFile(localPath()), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" } }); }
  catch {
    const remote = await catalogServiceClient().storage.from(operationalMediaBucket).createSignedUrl("web-media/ESP022-seal.webp", 60);
    return remote.data?.signedUrl ? NextResponse.redirect(remote.data.signedUrl) : new NextResponse(null, { status: 404 });
  }
}

export async function POST(request: NextRequest, context: RouteContext<"/api/web/[client]/[page]/sello">) {
  const { client, page } = await context.params;
  if (!allowed(client, page) || !sameOrigin(request)) return reply({ error: "Solicitud no permitida." }, 403);
  if (!(await catalogAccess(request)).admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || !file.size || file.size > 5_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 5 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!(["png", "jpeg", "webp"].includes(metadata.format ?? "")) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const image = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(900, 900, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    await mkdir(path.dirname(localPath()), { recursive: true });
    await writeFile(localPath(), image);
    const saved = await catalogServiceClient().storage.from(operationalMediaBucket).upload("web-media/ESP022-seal.webp", image, { upsert: true, contentType: "image/webp" });
    if (saved.error) return reply({ error: "No se ha podido guardar el sello remoto." }, 503);
    return reply({ ok: true, url: "/api/web/ESP022/home/sello" });
  } catch { return reply({ error: "No se ha podido subir el sello." }, 400); }
}
