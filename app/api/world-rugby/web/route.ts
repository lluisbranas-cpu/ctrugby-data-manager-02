import { requireConsultation } from "@/lib/consultation-access";
import { NextResponse } from "next/server";
import { WORLD_RUGBY_MEMBERSHIP_URL } from "@/app/lib/world-rugby";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function GET(consultationRequest: import("next/server").NextRequest) {
  const consultationDenied = await requireConsultation(consultationRequest);
  if (consultationDenied) return consultationDenied;

  try {
    const response = await fetch(WORLD_RUGBY_MEMBERSHIP_URL, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "CTRugby Data Manager" } });
    if (!response.ok) return new NextResponse("La web de World Rugby no está disponible en este momento.", { status: 502 });
    const finalUrl = response.url;
    let html = await response.text();
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttribute(finalUrl)}">`);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("No se ha podido cargar la web de World Rugby.", { status: 502 });
  }
}
