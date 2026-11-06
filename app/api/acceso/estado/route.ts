import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return NextResponse.json({ configured: false, authenticated: false, admin: false });
  const { authenticated, admin, guest } = await catalogAccess(request);
  return NextResponse.json({ configured: true, authenticated, admin, guest, role: admin ? "administrator" : authenticated ? "private" : guest ? "public" : null }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
