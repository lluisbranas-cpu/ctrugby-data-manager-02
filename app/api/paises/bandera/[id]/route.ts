import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { catalogServiceClient } from "@/lib/catalog";
import { operationalMediaBucket } from "@/lib/operational-store";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
const root = path.join(process.cwd(), "public", "country-flags");
const valid = (id: string) => /^[A-Z0-9-]{2,12}$/.test(id);
const builtInFlag = (id: string) => {
  if (id === "ES") return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path fill="#aa151b" d="M0 0h3v2H0z"/><path fill="#f1bf00" d="M0 .5h3v1H0z"/><path fill="#aa151b" d="M0 0h3v.5H0zm0 1.5h3V2H0z"/></svg>';
  if (id === "CCAA-CT") return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path fill="#f6d442" d="M0 0h3v2H0z"/><path fill="#d52b1e" d="M0 0h3v.286H0zm0 .571h3v.286H0zm0 .572h3v.286H0zm0 .571h3V2H0z"/></svg>';
  return null;
};
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id.toUpperCase();
  if (!valid(id)) return new NextResponse(null, { status: 404 });
  try { return new NextResponse(await readFile(path.join(root, `${id}.png`)), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } }); }
  catch {
    const remote = await catalogServiceClient().storage.from(operationalMediaBucket).createSignedUrl(`country-flags/${id}.png`, 60);
    if (remote.data?.signedUrl) return NextResponse.redirect(remote.data.signedUrl);
    const flag = builtInFlag(id);
    return flag ? new NextResponse(flag, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" } }) : new NextResponse(null, { status: 404 });
  }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  const id = (await params).id.toUpperCase();
  if (!valid(id)) return NextResponse.json({ error: "ID no válido." }, { status: 400 });
  const { admin } = await catalogAccess(request);
  if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
  try {
    const image = (await request.formData()).get("file");
    if (!(image instanceof File) || !image.size || image.size > 2_000_000) return NextResponse.json({ error: "Usa una imagen de hasta 2 MB." }, { status: 400 });
    const output = await sharp(Buffer.from(await image.arrayBuffer())).resize({ width: 160, height: 100, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await mkdir(root, { recursive: true }); await writeFile(path.join(root, `${id}.png`), output);
    const db = catalogServiceClient();
    const objectKey = `country-flags/${id}.png`;
    const upload = await db.storage.from(operationalMediaBucket).upload(objectKey, output, { upsert: true, contentType: "image/png" });
    if (upload.error) return NextResponse.json({ error: "No se ha podido guardar la bandera remota." }, { status: 503 });
    const indexed = await db.rpc("likidhub_upsert_operational_media", {
      p_row: {
        entity_type: "country-flag",
        entity_id: id,
        variant: "flag",
        bucket_id: operationalMediaBucket,
        object_key: objectKey,
        content_type: "image/png",
        byte_size: output.length,
        source_sha256: createHash("sha256").update(output).digest("hex"),
      },
    });
    if (indexed.error) return NextResponse.json({ error: "No se ha podido indexar la bandera remota." }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "No se ha podido guardar la bandera." }, { status: 400 }); }
}
