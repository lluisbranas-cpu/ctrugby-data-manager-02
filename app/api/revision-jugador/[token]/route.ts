import { requireConsultation } from "@/lib/consultation-access";
import { POST as createPlayerProfilePdf } from "@/app/api/jugadores/[id]/pdf/route";
import { REVIEW_MEDIA_COOKIE } from "@/lib/player-review-media-access";
import { reviewPublicOrigin } from "@/lib/player-review-links.mjs";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { createPlayerEditToken, getOrCreatePlayerReviewShortLink, isValidPlayerId, loadPlayerReviewData, readLatestPlayerReviewSubmission, readPlayerEditToken, savePlayerReviewSubmission } from "@/lib/player-edit-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow, noarchive" } });

async function handlePOST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (Number(request.headers.get("content-length") || 0) > 4_000_000) return reply({ error: "El envio supera 4 MB. Reduce el tamaño de las fotos." }, 413);
  const token = (await params).token;
  if (token === "crear") {
    if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json().catch(() => null) as { player_id?: unknown } | null;
    const playerId = typeof body?.player_id === "string" ? body.player_id.toUpperCase() : "";
    if (!isValidPlayerId(playerId)) return reply({ error: "Jugador no valido." }, 400);
    const record = await createPlayerEditToken(playerId);
    const short = await getOrCreatePlayerReviewShortLink(playerId, record.token);
    const origin = reviewPublicOrigin(request.nextUrl.origin);
    return reply({
      ok: true,
      token: record.token,
      expires_at: record.expires_at,
      url: `${origin}/revision-jugador/${record.token}`,
      short_url: `${origin}/r/${short.code}`,
    });
  }

  const record = await readPlayerEditToken(token);
  if (!record) return reply({ error: "Enlace no valido o caducado." }, 404);
  const form = await request.formData();
  const dataRaw = form.get("data");
  if (typeof dataRaw !== "string") return reply({ error: "Faltan los datos del formulario." }, 400);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataRaw) as Record<string, unknown>;
  } catch {
    return reply({ error: "Los datos no tienen un formato valido." }, 400);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return reply({ error: "Los datos no tienen un formato valido." }, 400);
  const files: Array<{ field: string; filename: string; bytes: Buffer; type: string }> = [];
  for (const [field, value] of form.entries()) {
    if (!(value instanceof File) || value.size === 0) continue;
    if (!["image/png", "image/jpeg", "image/webp"].includes(value.type) || value.size > 8_000_000) return reply({ error: "Las imagenes deben ser PNG, JPG o WebP de hasta 8 MB." }, 400);
    files.push({ field, filename: value.name, bytes: Buffer.from(await value.arrayBuffer()), type: value.type });
  }
  const pdfRequest = new NextRequest(new URL(`/api/jugadores/${record.player_id}/pdf`, request.url), {
    method: "POST",
    headers: {
      origin: request.nextUrl.origin,
      "x-ctrugby-review-token": token,
      "x-ctrugby-review-preview": Buffer.from(JSON.stringify(payload)).toString("base64url"),
      "x-ctrugby-review-preview-at": new Date().toISOString(),
    },
  });
  const pdfResponse = await createPlayerProfilePdf(pdfRequest, { params: Promise.resolve({ id: record.player_id }) });
  if (!pdfResponse.ok) return reply({ error: "No se ha podido preparar el PDF de la revisión." }, 503);
  const saved = await savePlayerReviewSubmission(record, payload, files, Buffer.from(await pdfResponse.arrayBuffer()));
  return reply({ ok: true, saved });
}

async function handleGET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const record = await readPlayerEditToken(token);
  if (!record) return reply({ error: "Enlace no valido o caducado." }, 404);
  const data = await loadPlayerReviewData(record.player_id);
  if (!data) return reply({ error: "Jugador no encontrado." }, 404);
  if (request.nextUrl.searchParams.get("resumen") === "1") {
    return reply({ ok: true, player_name: [data.player.first_name, data.player.last_name].filter(Boolean).join(" ") });
  }
  const saved_submission = await readLatestPlayerReviewSubmission(record);
  const result = { ok: true, expires_at: record.expires_at, ...data, saved_submission };
  const response = reply(result);
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(REVIEW_MEDIA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/jugadores", maxAge: 3600 });
  return response;
}

// Keep failures JSON-shaped; never expose filesystem paths or credentials.
type RouteContext = { params: Promise<{ token: string }> };
const failure = (error: unknown) => reply({ error: error instanceof Error && /Contacta con CTRugby|almacen privado|no esta configurado/.test(error.message)
  ? error.message : "No se ha podido completar la revision. Contacta con CTRugby." }, 500);
export async function POST(request: NextRequest, context: RouteContext) {
  if ((await context.params).token === "crear") {
    const denied = await requireConsultation(request); if (denied) return denied;
  }
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try { return await handlePOST(request, context); } catch (error) { return failure(error); }
}
export async function GET(request: NextRequest, context: RouteContext) {
  if ((await context.params).token === "crear") {
    const denied = await requireConsultation(request); if (denied) return denied;
  }
  try { return await handleGET(request, context); } catch (error) { return failure(error); }
}
