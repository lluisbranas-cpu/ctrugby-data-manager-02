import { POST as createPlayerProfilePdf } from "@/app/api/jugadores/[id]/pdf/route";
import { readPlayerEditToken } from "@/lib/player-edit-review";
import { playerPdfFilename } from "@/lib/player-pdf-filename";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const record = await readPlayerEditToken(token);
  if (!record) return new NextResponse("Enlace no válido o caducado.", { status: 404 });
  const internalRequest = new NextRequest(new URL(`/api/jugadores/${record.player_id}/pdf`, request.url), {
    method: "POST",
    headers: { origin: request.nextUrl.origin, "x-ctrugby-review-token": token },
  });
  const response = await createPlayerProfilePdf(internalRequest, { params: Promise.resolve({ id: record.player_id }) });
  if (!response.ok) return new NextResponse("No se ha podido preparar el PDF.", { status: response.status });
  return new NextResponse(await response.arrayBuffer(), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${playerPdfFilename(record.player_id)}"`, "X-CTRugby-Player-Id": record.player_id,
    "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  const record = await readPlayerEditToken(token);
  if (!record) return new NextResponse("Enlace no válido o caducado.", { status: 404 });
  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return new NextResponse("Los datos de vista previa no son válidos.", { status: 400 });
  const internalRequest = new NextRequest(new URL(`/api/jugadores/${record.player_id}/pdf`, request.url), {
    method: "POST",
    headers: {
      origin: request.nextUrl.origin,
      "x-ctrugby-review-token": token,
      "x-ctrugby-review-preview": Buffer.from(JSON.stringify(payload)).toString("base64url"),
      "x-ctrugby-review-preview-at": new Date().toISOString(),
    },
  });
  const response = await createPlayerProfilePdf(internalRequest, { params: Promise.resolve({ id: record.player_id }) });
  if (!response.ok) return new NextResponse("No se ha podido preparar la vista previa en PDF.", { status: response.status });
  return new NextResponse(await response.arrayBuffer(), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${playerPdfFilename(record.player_id)}"`, "X-CTRugby-Player-Id": record.player_id,
    "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow",
  } });
}
