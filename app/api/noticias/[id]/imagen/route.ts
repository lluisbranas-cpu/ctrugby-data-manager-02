import { localNewsPlayers } from "@/lib/news-players";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { requireConsultation } from "@/lib/consultation-access";
import { catalogAccess, catalogConfigured, localAdminAccess, sameOrigin } from "@/lib/catalog";
import { readPlayerNews, savePlayerNews, validNewsId, newsWithImage } from "@/lib/player-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });
const imagePath = (id: string) => path.join(process.cwd(), "data", "staging", "player-news-images", id + ".webp");
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = await requireConsultation(request); if (denied) return denied;
  const id = (await context.params).id;
  if (!validNewsId(id) || !catalogConfigured()) return new NextResponse(null, { status: 404, headers });
  try {
    const { db, admin } = await catalogAccess(request);
    const news = (await readPlayerNews()).find((item) => item.id === id);
    if (!news || (!admin && !news.published)) return new NextResponse(null, { status: 404, headers });
    const player = localAdminAccess(request)
      ? { data: (await localNewsPlayers()).find(player => player.id === news.player_id), error: null }
      : await db.from("catalog_players").select("id").eq("id", news.player_id).maybeSingle();
    if (player.error || !player.data) return new NextResponse(null, { status: 404, headers });
    const display = await newsWithImage(news);
    if (display.image_source === "federation" && display.image_url) return NextResponse.redirect(new URL(display.image_url, request.url));
    if (!display.image_updated_at) return new NextResponse(null, { status: 404, headers });
    return new NextResponse(await readFile(imagePath(id)), { headers: { ...headers, "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 404, headers }); }
}
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "Catálogo no disponible." }, 503);
  const id = (await context.params).id;
  if (!validNewsId(id)) return reply({ error: "Noticia no válida." }, 400);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const news = (await readPlayerNews()).find((item) => item.id === id);
    if (!news) return reply({ error: "Guarda la noticia antes de subir su imagen." }, 404);
    if (news.type === "participacion") return reply({error: "La imagen de la participación se gestiona en la tabla de categorías."},400);
    const file = (await request.formData()).get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return reply({ error: "Elige una imagen JPG, PNG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) return reply({ error: "El archivo debe contener una imagen JPG, PNG o WebP válida." }, 400);
    const image = await sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const target = imagePath(id); const temporary = target + "." + randomUUID() + ".tmp";
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(temporary, image); await rename(temporary, target);
    const saved = await savePlayerNews(news, new Date().toISOString());
    return reply({ ok: true, news: await newsWithImage(saved) });
  } catch { return reply({ error: "No se ha podido guardar la imagen. Prueba con otra imagen JPG, PNG o WebP." }, 400); }
}
