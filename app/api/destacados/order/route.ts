import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { readFeaturedPlayerOrder, writeFeaturedPlayerOrder } from "@/lib/featured-player-order";
import { likidHubPreviewReadOnly, previewLikidHubFeaturedSummaries } from "@/lib/likidhub-preview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function GET(consultationRequest: import("next/server").NextRequest) {
  if (likidHubPreviewReadOnly()) {
    try { return reply({ order: (await previewLikidHubFeaturedSummaries()).map((row) => row.player_id) }); }
    catch { return reply({ order: [] }); }
  }
  const consultationDenied = await requireConsultation(consultationRequest);
  if (consultationDenied) return consultationDenied;

  return reply({ order: await readFeaturedPlayerOrder() });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const { admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  const body = await request.json().catch(() => null) as { order?: unknown } | null;
  if (!Array.isArray(body?.order) || body.order.length > 10000 || body.order.some((id) => typeof id !== "string" || !/^JUG\d{4}$/.test(id)) || new Set(body.order).size !== body.order.length) return reply({ error: "El orden debe contener IDs de jugadores válidos, sin duplicados." }, 400);
  try {
    const order = await writeFeaturedPlayerOrder(body.order as string[]);
    return reply({ ok: true, order });
  } catch { return reply({ error: "No se ha podido guardar el orden. Inténtalo de nuevo." }, 503); }
}
