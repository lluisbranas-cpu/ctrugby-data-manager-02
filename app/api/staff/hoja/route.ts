import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StaffRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  milestone_count: number;
  latest_year: number;
  seasons: number[];
  scopes: { scope: string; count: number }[];
  latest_milestone: {
    id: string;
    scope: string | null;
    category: string | null;
    season_label: string | null;
    club_text: string | null;
    position_text: string | null;
  } | null;
};
type StaffState = { staff: StaffRow[]; years: { year: number; staff: number; milestones: number }[]; scopes: { scope: string; count: number }[] };

function sheet(rows: (string | number | null)[][], name: string, widths: number[]) {
  const output = XLSX.utils.aoa_to_sheet(rows);
  output["!cols"] = widths.map((wch) => ({ wch }));
  output["!freeze"] = { xSplit: 0, ySplit: 1 };
  return { name, output };
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const response = await fetch(new URL("/api/staff", request.url), {
      cache: "no-store",
      headers: { cookie: request.headers.get("cookie") ?? "" },
    });
    if (!response.ok) return NextResponse.json({ error: "No se han podido cargar los datos de staff." }, { status: 503 });

    const data = await response.json() as StaffState;
    const staffRows = [
      [
        "ID staff",
        "Nombre",
        "Apellidos",
        "Nombre completo",
        "Hitos",
        "Años",
        "Ámbitos",
        "Último año",
        "Último hito",
        "Último ámbito",
        "Última categoría",
        "Último rol/posición",
        "Último club/contexto",
      ],
      ...data.staff.map((person) => [
        person.id,
        person.first_name,
        person.last_name,
        person.display_name,
        person.milestone_count,
        person.seasons.join(", "),
        person.scopes.map((item) => `${item.scope}: ${item.count}`).join(" | "),
        person.latest_year || null,
        person.latest_milestone?.id ?? null,
        person.latest_milestone?.scope ?? null,
        person.latest_milestone?.category ?? null,
        person.latest_milestone?.position_text ?? null,
        person.latest_milestone?.club_text ?? null,
      ]),
    ];
    const profileStructureRows = [
      ["Campo ficha", "Tipo sugerido", "Origen inicial", "Notas"],
      ["ID staff", "Texto corto", "Staff", "Clave estable para enlazar hitos, fuentes y futuras fichas."],
      ["Nombre visible", "Texto", "Staff", "Nombre público de la persona."],
      ["Rol principal", "Texto corto", "Último hito / edición manual", "Ej. Seleccionador, entrenador, director deportivo, staff técnico."],
      ["Ámbitos", "Lista", "Hitos", "Federaciones, clubs o contextos asociados."],
      ["Temporadas", "Lista de años", "Hitos", "Años con actividad registrada."],
      ["Resumen profesional", "Texto largo", "Edición manual", "Bio breve para la cabecera de la ficha."],
      ["Trayectoria Rugby", "Texto largo", "Hitos + edición manual", "Síntesis de participación y responsabilidades."],
      ["Hitos destacados", "Relación", "Hitos", "Seleccionar cuáles aparecen en ficha."],
      ["Foto", "Archivo/URL", "Pendiente", "Definir si se sube archivo local o URL externa."],
      ["Email", "Texto privado", "Edición manual", "Mantener privado salvo decisión expresa."],
      ["Teléfono", "Texto privado", "Edición manual", "Mantener privado salvo decisión expresa."],
      ["LinkedIn/Web", "URL", "Edición manual", "Campo público opcional."],
      ["Estado publicación", "Opción", "Edición manual", "Borrador, revisión, publicado."],
      ["Notas internas", "Texto largo privado", "Edición manual", "No mostrar en ficha pública."],
    ];
    const yearRows = [
      ["Año", "Staff", "Hitos"],
      ...data.years.map((item) => [item.year, item.staff, item.milestones]),
    ];
    const scopeRows = [
      ["Ámbito", "Hitos"],
      ...data.scopes.map((item) => [item.scope, item.count]),
    ];

    const workbook = XLSX.utils.book_new();
    for (const { name, output } of [
      sheet(staffRows, "Staff", [14, 20, 24, 34, 10, 20, 42, 12, 14, 18, 42, 26, 32]),
      sheet(profileStructureRows, "Estructura ficha", [24, 18, 24, 70]),
      sheet(yearRows, "Temporadas", [12, 12, 12]),
      sheet(scopeRows, "Ámbitos", [18, 12]),
    ]) XLSX.utils.book_append_sheet(workbook, output, name);

    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ctrugby-staff-estructura-fichas.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de staff." }, { status: 500 });
  }
}
