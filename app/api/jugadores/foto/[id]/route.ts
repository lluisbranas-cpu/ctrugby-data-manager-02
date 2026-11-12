import { playerReviewMediaAccess } from "@/lib/player-review-media-access";
import { requireConsultation } from "@/lib/consultation-access";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { catalogClient, catalogServiceClient, catalogAccess, sameOrigin } from "@/lib/catalog";
import { canonicalLikidHubPlayerId } from "@/lib/likidhub-jug-ctr-bridge.generated";
import { likidHubPreviewReadOnly, previewLikidHubLatestSeasonPhotoUrl, previewLikidHubMediaUrl, previewLikidHubSeasonPhotoUrl } from "@/lib/likidhub-preview";

export const runtime = "nodejs";

const validSeason = (value: string | null | undefined) => Boolean(value && /^20\d{2}$/.test(value));
const seasonDirectory = (id: string) => path.join(process.cwd(), "data", "staging", "player-season-photos", id);
const primaryPath = (id: string) => path.join(seasonDirectory(id), "primary.json");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

function removeConnectedBackground(input: Buffer, width: number, height: number, removeGray = false) {
  const output = Buffer.from(input); const pixelCount = width * height; const visited = new Uint8Array(pixelCount); const stack: number[] = [];
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].filter((index) => index >= 0 && index < pixelCount);
  const background = corners.reduce((sum, index) => { const offset = index * 4; return { r: sum.r + input[offset], g: sum.g + input[offset + 1], b: sum.b + input[offset + 2], a: sum.a + input[offset + 3] }; }, { r: 0, g: 0, b: 0, a: 0 });
  const samples = Math.max(1, corners.length); const reference = { r: background.r / samples, g: background.g / samples, b: background.b / samples, a: background.a / samples };
  const isBackground = (index: number) => { const offset = index * 4; const alpha = input[offset + 3]; if (alpha < 12) return true; const r = input[offset], g = input[offset + 1], b = input[offset + 2]; const max = Math.max(r, g, b), min = Math.min(r, g, b); return (removeGray && min > 140 && max - min < 24) || (min > 238 && max - min < 22) || (Math.hypot(r - reference.r, g - reference.g, b - reference.b) < 44 && Math.abs(alpha - reference.a) < 70); };
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

async function displayPortrait(file: Buffer, request: NextRequest) {
  if (request.nextUrl.searchParams.get("background") !== "transparent") return new Uint8Array(file);
  const decoded = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cutout = removeConnectedBackground(decoded.data, decoded.info.width, decoded.info.height, true);
  return new Uint8Array(await sharp(cutout, { raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 } }).png().toBuffer());
}
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (likidHubPreviewReadOnly()) {
    const season = request.nextUrl.searchParams.get("season");
    const playerId = canonicalLikidHubPlayerId(id);
    if (!playerId || (season !== null && !validSeason(season))) return new NextResponse(null, { status: 404 });
    try {
      const signedUrl = season
        ? await previewLikidHubSeasonPhotoUrl(playerId, Number(season))
        : await previewLikidHubMediaUrl("portrait", playerId, "portrait") ?? await previewLikidHubLatestSeasonPhotoUrl(playerId);
      return signedUrl ? NextResponse.redirect(signedUrl, { status: 307, headers: { "Cache-Control": "private, no-store" } }) : new NextResponse(null, { status: 404 });
    } catch { return new NextResponse(null, { status: 503 }); }
  }
  const team = new URL(request.url).searchParams.get("team");
  const publicTeamPhoto = team !== null && ["ESP0022", "ESP0023", "ESP0010"].includes(team);
  if (publicTeamPhoto) {
    try {
      const seasons = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "player-seasons.json"), "utf8")) as { player_id: string; club_id: string | null }[];
      if (!seasons.some((season) => season.player_id === id && season.club_id === team)) return new NextResponse(null, { status: 404 });
    } catch { return new NextResponse(null, { status: 404 }); }
  }
  const reviewAccess = publicTeamPhoto ? false : await playerReviewMediaAccess(request, id);
  if (!reviewAccess && !publicTeamPhoto) {
    const denied = await requireConsultation(request); if (denied) return denied;
  }
  if (!/^JUG\d{4}$/.test(id)) return new NextResponse(null, { status: 404 });
  try {
    const { db, admin } = reviewAccess ? { db: catalogServiceClient(), admin: false } : await catalogAccess(request);
    if (publicTeamPhoto || (!admin && !reviewAccess)) {
      const publicationDb = publicTeamPhoto ? catalogClient() : db;
      const player = await publicationDb.from("catalog_players").select("id").eq("id", id).eq("published", true).maybeSingle();
      if (player.error || !player.data?.id) return new NextResponse(null, { status: 403 });
    }
    const mediaDb = publicTeamPhoto ? catalogServiceClient() : db;
    const season = new URL(request.url).searchParams.get("season");
    if (process.env.NODE_ENV === "production") {
      const photo = validSeason(season)
        ? await mediaDb.schema("app_private").from("player_season_photos").select("storage_key").eq("player_id", id).eq("season_year", Number(season)).maybeSingle()
        : await mediaDb.schema("app_private").from("player_season_photos").select("storage_key").eq("player_id", id).eq("is_primary", true).maybeSingle();
      const fallback = photo.data?.storage_key ? null : await mediaDb.schema("app_private").from("player_profile_photos").select("storage_key").eq("player_id", id).maybeSingle();
      const storageKey = photo.data?.storage_key ?? fallback?.data?.storage_key;
      if (storageKey) {
        const stored = await mediaDb.storage.from("catalog-media-private").download(storageKey);
        if (!stored.error && stored.data) {
          return new NextResponse(await displayPortrait(Buffer.from(await stored.data.arrayBuffer()), request), { headers: { "Content-Type": stored.data.type || "image/png", "Cache-Control": publicTeamPhoto ? "public, max-age=300" : "private, no-store" } });
        }
      }
    }

    let filename = path.join(process.cwd(), "data", "staging", "player-photos", "prepared", `${id}.png`);
    if (season && /^20\d{2}$/.test(season)) {
      filename = path.join(seasonDirectory(id), `${season}.png`);
    } else {
      // La estrella de trayectoria decide la foto de ficha. Si aún no se ha
      // marcado ninguna, conservamos la foto base preparada como respaldo.
      try {
        const { season: primarySeason } = JSON.parse(await readFile(primaryPath(id), "utf8")) as { season?: string };
        if (typeof primarySeason === "string" && validSeason(primarySeason)) filename = path.join(seasonDirectory(id), `${primarySeason}.png`);
      } catch {
        // Antes de que alguien elija una estrella, la trayectoria ya mostraba
        // como destacada la temporada más reciente. Esa misma foto debe verse
        // también en el directorio y en la ficha.
        try {
          const latest = (await readdir(seasonDirectory(id)))
            .map((name) => name.match(/^(20\d{2})\.png$/)?.[1])
            .filter((year): year is string => Boolean(year))
            .sort((left, right) => Number(right) - Number(left))[0];
          if (latest) filename = path.join(seasonDirectory(id), `${latest}.png`);
        } catch { /* No hay foto de temporada: se usa la foto base. */ }
      }
    }
    try {
      await access(filename);
    } catch {
      // Algunas fotos locales se conservan como cubiertas, con el mismo ID
      // JUG, mientras se preparan como retratos cuadrados.
      const cover = path.join(process.cwd(), "public", "player-covers", `${id}.webp`);
      await access(cover);
      filename = cover;
    }
    const file = await readFile(filename);
    return new NextResponse(await displayPortrait(file, request), { headers: { "Content-Type": filename.endsWith(".webp") ? "image/webp" : "image/png", "Cache-Control": publicTeamPhoto ? "public, max-age=300" : "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = new URL(request.url).searchParams.get("season");
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!/^JUG\d{4}$/.test(id) || !validSeason(season)) return reply({ error: "Jugador o temporada no válidos." }, 400);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 8_000_000) return reply({ error: "Elige una imagen PNG, JPG o WebP de hasta 8 MB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 30_000_000 }).metadata();
    if (!( ["png", "jpeg", "webp"].includes(metadata.format ?? "") ) || (metadata.pages ?? 1) > 1) return reply({ error: "Usa una imagen PNG, JPG o WebP estática." }, 400);
    const edited = form.get("prepared");
    let editedPortrait: Buffer | null = null;
    if (edited !== null) {
      if (!(edited instanceof File) || !edited.size || edited.size > 8_000_000) return reply({ error: "La foto preparada no es valida." }, 400);
      const editedBytes = Buffer.from(await edited.arrayBuffer());
      const editedMetadata = await sharp(editedBytes, { limitInputPixels: 1_440_000 }).metadata();
      if (editedMetadata.format !== "png" || ![300, 1200].includes(editedMetadata.width ?? 0) || editedMetadata.width !== editedMetadata.height || (editedMetadata.pages ?? 1) > 1) return reply({ error: "La foto preparada debe ser un PNG de 1200 x 1200." }, 400);
      editedPortrait = await sharp(editedBytes).png({ compressionLevel: 9 }).toBuffer();
    }
    const directory = seasonDirectory(id); const originals = path.join(directory, "originales");
    await Promise.all([mkdir(directory, { recursive: true }), mkdir(originals, { recursive: true })]);
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format!;
    await writeFile(path.join(originals, `${season}-${Date.now()}.${extension}`), bytes);
    if (editedPortrait) {
      await writeFile(path.join(directory, `${season}.png`), editedPortrait);
      return reply({ ok: true, url: `/api/jugadores/foto/${id}?season=${season}&v=${Date.now()}` });
    }
    const normalized = await sharp(bytes, { limitInputPixels: 30_000_000 }).rotate().resize(1200, 1200, { fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cutout = removeConnectedBackground(normalized.data, normalized.info.width, normalized.info.height);
    const box = alphaBoundingBox(cutout, normalized.info.width, normalized.info.height);
    const portrait = await (box ? sharp(cutout, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } }).extract(box) : sharp(cutout, { raw: { width: normalized.info.width, height: normalized.info.height, channels: 4 } })).resize(300, 300, { fit: "contain", background: { r: 226, g: 231, b: 234, alpha: 1 }, withoutEnlargement: true }).png().toBuffer();
    const prepared = await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 226, g: 231, b: 234, alpha: 1 } } }).composite([{ input: portrait }]).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(directory, `${season}.png`), prepared);
    return reply({ ok: true, url: `/api/jugadores/foto/${id}?season=${season}&v=${Date.now()}` });
  } catch { return reply({ error: "No se ha podido preparar y guardar la foto de la temporada." }, 400); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!sameOrigin(request) || !/^JUG\d{4}$/.test(id)) return reply({ error: "Solicitud no válida." }, 400);
  try {
    const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const { season } = await request.json() as { season?: string };
    if (!validSeason(season)) return reply({ error: "Temporada no válida." }, 400);
    await access(path.join(seasonDirectory(id), `${season}.png`));
    await writeFile(primaryPath(id), JSON.stringify({ season }));
    return reply({ ok: true, season });
  } catch { return reply({ error: "Primero sube una foto para esa temporada." }, 400); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = new URL(request.url).searchParams.get("season");
  if (!sameOrigin(request) || !/^JUG\d{4}$/.test(id) || !validSeason(season)) return reply({ error: "Jugador o temporada no válidos." }, 400);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const directory = seasonDirectory(id);
    await rm(path.join(directory, `${season}.png`), { force: true });
    const originals = path.join(directory, "originales");
    const originalFiles = await readdir(originals).catch(() => [] as string[]);
    await Promise.all(originalFiles.filter((name) => name.startsWith(`${season}-`)).map((name) => rm(path.join(originals, name), { force: true })));
    try {
      const primary = JSON.parse(await readFile(primaryPath(id), "utf8")) as { season?: string };
      if (primary.season === season) await rm(primaryPath(id), { force: true });
    } catch { /* No había una foto principal seleccionada. */ }
    return reply({ ok: true, season });
  } catch { return reply({ error: "No se ha podido eliminar la foto de la temporada." }, 400); }
}
