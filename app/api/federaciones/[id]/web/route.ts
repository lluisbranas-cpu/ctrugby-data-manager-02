import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return new NextResponse("El catálogo no está configurado.", { status: 503 });
  try {
    const { id } = await context.params;
    const { db } = await catalogAccess(request);
    const result = await db.from("catalog_federations").select("website").eq("id", id).maybeSingle();
    const website = result.data?.website;
    if (result.error || !website) return new NextResponse("Esta federación no tiene una web registrada.", { status: 404 });
    const response = await fetch(website, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "CTRugby Data Manager" } });
    if (!response.ok) return new NextResponse("La web oficial no está disponible en este momento.", { status: 502 });
    const finalUrl = response.url;
    let html = await response.text();
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${escapeAttribute(finalUrl)}">`);
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("No se ha podido cargar la web oficial.", { status: 502 });
  }
}