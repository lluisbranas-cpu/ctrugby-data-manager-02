import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const validId = (value: string) => /^(?:[A-Z]{3}\d{4}|F[NT]\d{3})$/.test(value) ? value : null;
const types = new Set(["png", "jpeg", "webp"]);
const publicRoot = path.join(process.cwd(), "public", "jerseys");
const originalsRoot = path.join(process.cwd(), "data", "staging", "jerseys", "originales");
const manifestPath = path.join(process.cwd(), "data", "staging", "jerseys", "manifest.json");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

type Manifest = Record<string, string[]>;
async function readManifest(): Promise<Manifest> { try { return JSON.parse(await readFile(manifestPath, "utf8")) as Manifest; } catch { return {}; } }
async function saveManifest(manifest: Manifest) { await mkdir(path.dirname(manifestPath), { recursive: true }); await writeFile(manifestPath, JSON.stringify(manifest, null, 2)); }
const photos = (id: string, manifest: Manifest) => (manifest[id] ?? []).map((file) => `/jerseys/${id}/${file}`);

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const id = validId(request.nextUrl.searchParams.get("id")?.toUpperCase() ?? "");
  if (!id) return reply({ error: "Entidad no válida." }, 400);
  return reply({ photos: photos(id, await readManifest()) });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData(); const id = validId(String(form.get("id") ?? "").toUpperCase()); const file = form.get("file");
    if (!id || !(file instanceof File) || !file.size || file.size > 8_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer()); const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!types.has(metadata.format ?? "") || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!; const filename = `${crypto.randomUUID()}.${extension}`;
    const [target, originals] = [path.join(publicRoot, id), path.join(originalsRoot, id)]; await Promise.all([mkdir(target, { recursive: true }), mkdir(originals, { recursive: true })]);
    let size = 800, prepared = Buffer.alloc(0);
    while (!prepared.length || prepared.length > 900_000) {
      const image = sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(size, size, { fit: "inside", withoutEnlargement: true });
      prepared = extension === "png" ? await image.png({ compressionLevel: 9 }).toBuffer() : extension === "webp" ? await image.webp({ quality: 82 }).toBuffer() : await image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      size = Math.floor(size * .82); if (size < 100 && prepared.length > 900_000) return reply({ error: "No se ha podido reducir la copia de la camiseta a 900 KB." }, 413);
    }
    await Promise.all([writeFile(path.join(target, filename), prepared), writeFile(path.join(originals, filename), bytes)]);
    const manifest = await readManifest(); manifest[id] = [...(manifest[id] ?? []), filename]; await saveManifest(manifest);
    return reply({ photos: photos(id, manifest) });
  } catch { return reply({ error: "No se ha podido guardar la camiseta." }, 400); }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId(request.nextUrl.searchParams.get("id")?.toUpperCase() ?? ""); const file = request.nextUrl.searchParams.get("file") ?? "";
  if (!id || !/^[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(file)) return reply({ error: "Imagen no válida." }, 400);
  try {
    const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const manifest = await readManifest(); if (!(manifest[id] ?? []).includes(file)) return reply({ error: "La imagen no forma parte de esta galería." }, 404);
    manifest[id] = manifest[id].filter((entry) => entry !== file); if (!manifest[id].length) delete manifest[id]; await saveManifest(manifest);
    await unlink(path.join(publicRoot, id, file)).catch(() => undefined);
    return reply({ photos: photos(id, manifest) });
  } catch { return reply({ error: "No se ha podido eliminar la camiseta." }, 400); }
}