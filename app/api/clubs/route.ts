import { NextResponse } from "next/server";
import { catalogClient, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!catalogConfigured()) return NextResponse.json({ configured: false, clubs: [] }, { status: 503 });
  try {
    const { data, error } = await catalogClient().from("catalog_clubs")
      .select("id,name,active,founded_text,city,province,region,country,latitude,longitude,maps_url,website,instagram")
      .order("country").order("name");
    if (error) return NextResponse.json({ error: "No se han podido cargar los clubs publicados." }, { status: 503 });
    return NextResponse.json({ configured: true, clubs: data }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido conectar con el catálogo de clubs." }, { status: 503 });
  }
}
