import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MilestoneExport = {
  id: string;
  participant_id?: string | null;
  participant_name: string;
  participant_kind: string;
  player_id: string | null;
  staff_id: string | null;
  scope: string | null;
  scope_kind: string;
  category: string | null;
  season_label: string | null;
  club_text: string | null;
  club_id?: string | null;
  club_country?: string | null;
  international?: boolean;
  position_text: string | null;
  latest_year: number;
  image_key?: string | null;
  source_name: string | null;
  source_type?: string | null;
  source_ctr_id?: string | null;
  source_url?: string | null;
  source_photo_url?: string | null;
  source_captured_at?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
  milestone_url: string;
};

type MilestoneState = { configured: boolean; milestones: MilestoneExport[] };

const shortSeason = (label: string | null | undefined) => {
  const years = String(label ?? "").match(/20\d{2}/g) ?? [];
  const [start, end] = years;
  if (start && end) return `${start.slice(-2)}/${end.slice(-2)}`;
  if (start) return start.slice(-2);
  return label ?? null;
};

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const response = await fetch(new URL("/api/hitos", request.url), {
      cache: "no-store",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!response.ok) return NextResponse.json({ error: "No se han podido cargar los hitos." }, { status: 503 });

    const data = await response.json() as MilestoneState;
    if (catalogConfigured() && data.configured) {
      const { admin } = await catalogAccess(request);
      if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });
    }
    const rows = [[
      "ID hito",
      "Enlace hito",
      "ID participante",
      "Participante",
      "Tipo participante",
      "ID jugador",
      "ID staff",
      "Temporada",
      "Temporada original",
      "Año",
      "Ámbito",
      "Tipo ámbito",
      "Categoría",
      "Club",
      "ID club",
      "País club",
      "Internacional",
      "Posición",
      "Imagen",
      "Origen nombre",
      "Origen tipo",
      "Origen ID JUG",
      "Fuente URL",
      "Foto URL fuente",
      "Fecha captura fuente",
      "Hoja fuente",
      "Fila fuente",
    ], ...data.milestones.map((milestone) => [
      milestone.id,
      milestone.milestone_url,
      milestone.participant_id ?? null,
      milestone.participant_name,
      milestone.participant_kind,
      milestone.player_id,
      milestone.staff_id,
      shortSeason(milestone.season_label),
      milestone.season_label,
      milestone.latest_year || null,
      milestone.scope,
      milestone.scope_kind,
      milestone.category,
      milestone.club_text,
      milestone.club_id ?? null,
      milestone.club_country ?? null,
      milestone.international ? "Sí" : "No",
      milestone.position_text,
      milestone.image_key ?? null,
      milestone.source_name,
      milestone.source_type ?? null,
      milestone.source_ctr_id ?? null,
      milestone.source_url ?? null,
      milestone.source_photo_url ?? null,
      milestone.source_captured_at ?? null,
      milestone.source_sheet ?? null,
      milestone.source_row ?? null,
    ])];

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [14, 48, 22, 32, 16, 14, 14, 14, 18, 10, 14, 14, 34, 30, 14, 18, 14, 22, 28, 32, 14, 14, 64, 64, 18, 16, 12].map((wch) => ({ wch }));
    sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, sheet, "Hitos staff");

    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ctrugby-hitos-staff.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de hitos." }, { status: 500 });
  }
}
