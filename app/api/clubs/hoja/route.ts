import { withGroupClubs } from "@/lib/temporary-group-clubs";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Club = {
  id: string;
  name: string;
  active: boolean;
  founded_text: string | null; disappeared_text?: string | null;
  city: string;
  province: string;
  region: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  maps_url: string | null;
  website: string | null;
  instagram: string | null;
};

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const { db } = await catalogAccess(request);
    const { data, error } = await db.from("catalog_clubs")
      .select("id,name,active,founded_text,disappeared_text,city,province,region,country,latitude,longitude,maps_url,website,instagram")
      .order("country")
      .order("region")
      .order("name");
    if (error) return NextResponse.json({ error: "No se ha podido preparar la hoja de clubs." }, { status: 503 });
    const clubs = await withGroupClubs(data as Club[]);
    const rows = [[
      "ID",
      "Club",
      "Activo",
      "Fundación",
      "Año de desaparición",
      "Ciudad",
      "Provincia",
      "Región",
      "País",
      "Latitud",
      "Longitud",
      "Maps",
      "Web",
      "Instagram",
    ], ...clubs.map((club) => [
      club.id,
      club.name,
      club.active ? "Sí" : "No",
      club.founded_text,
      club.disappeared_text ?? "",
      club.city,
      club.province,
      club.region,
      club.country,
      club.latitude,
      club.longitude,
      club.maps_url,
      club.website,
      club.instagram,
    ])];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [12, 42, 10, 16, 22, 24, 24, 28, 22, 12, 12, 44, 44, 28].map((wch) => ({ wch }));
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, "Clubs");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="ctrugby-clubs.xlsx"', "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de clubs." }, { status: 500 });
  }
}
