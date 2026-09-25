import { NextResponse } from "next/server";
import { catalogClient, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!catalogConfigured()) return NextResponse.json({ configured: false, federations: [] }, { status: 503 });
  try {
    const { data, error } = await catalogClient().from("catalog_federations")
      .select("id,name,scope,territory,country,active,website").order("country").order("scope").order("name");
    if (error) return NextResponse.json({ error: "No se han podido cargar las federaciones publicadas." }, { status: 503 });
    return NextResponse.json({ configured: true, federations: data }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido conectar con el catálogo de federaciones." }, { status: 503 });
  }
}
