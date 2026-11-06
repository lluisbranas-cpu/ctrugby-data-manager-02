import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";
import { readLocalClubs, readProfessionalClubMilestones, shapeProfessionalClubRecord } from "@/lib/professional-club-milestones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    if (catalogConfigured()) {
      const { admin } = await catalogAccess(request);
      if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    }
    const [records, clubs] = await Promise.all([readProfessionalClubMilestones(true), readLocalClubs()]);
    const rows = [[
      "ID",
      "ID jugador",
      "Jugador",
      "Categoría profesional",
      "Club",
      "ID club",
      "Temporada",
      "Notas",
      "Fecha alta",
    ], ...records.map((record) => {
      const shaped = shapeProfessionalClubRecord(record, clubs);
      return [shaped.id, shaped.player_id, shaped.player_name, shaped.category, shaped.club_name, shaped.club_id, shaped.season_label, shaped.notes, shaped.created_at];
    })];
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [24, 14, 34, 24, 34, 14, 16, 44, 24].map((wch) => ({ wch }));
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, "Participaciones");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ctrugby-participaciones.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de clubes profesionales." }, { status: 500 });
  }
}
