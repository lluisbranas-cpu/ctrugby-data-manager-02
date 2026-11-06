import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  if (!catalogConfigured()) return NextResponse.json({ error: "Acceso no configurado." }, { status: 503, headers });
  const { db, admin } = await catalogAccess(request);
  if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403, headers });
  const result = await db.rpc("admin_access_accounts");
  if (result.error) return NextResponse.json({ error: "No se ha podido cargar la tabla de usuarios." }, { status: 503, headers });
  return NextResponse.json({ users: (result.data ?? []).filter((row: { access_kind: string }) => row.access_kind !== "administrator") }, { headers });
}
