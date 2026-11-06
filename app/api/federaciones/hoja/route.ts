import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Federation = { id: string; name: string; scope: string; territory: string; country: string; active: boolean; website: string | null };

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  try {
    const { db, admin } = await catalogAccess(request);
    const [federationResult, clubResult] = await Promise.all([
      db.from("catalog_federations").select("id,name,scope,territory,country,active,website").order("country").order("scope").order("name"),
      db.from("catalog_clubs").select("id,name,country,region,active").order("name"),
    ]);
    if (federationResult.error || clubResult.error) return NextResponse.json({ error: "No se ha podido preparar la hoja de federaciones." }, { status: 503 });
    const notesResult = admin ? await db.schema("app_private").from("federation_notes").select("federation_id,email") : { data: [] as { federation_id: string; email: string | null }[] };
    if ("error" in notesResult && notesResult.error) return NextResponse.json({ error: "No se ha podido preparar la hoja de federaciones." }, { status: 503 });
    const emails = new Map((notesResult.data ?? []).map((note) => [note.federation_id, note.email]));
    const federations = federationResult.data as Federation[];
    const federationRows = [["ID", "Federación", "Ámbito", "Territorio", "País", "Activa", "Web", ...(admin ? ["Email privado"] : [])], ...federations.map((federation) => [federation.id, federation.name, federation.scope, federation.territory, federation.country, federation.active ? "Sí" : "No", federation.website, ...(admin ? [emails.get(federation.id) ?? null] : [])])];
    const clubRows = [["ID", "Club", "País", "Región", "Activo"], ...(clubResult.data ?? []).map((club) => [club.id, club.name, club.country, club.region, club.active ? "Sí" : "No"])];
    const workbook = XLSX.utils.book_new();
    const federationSheet = XLSX.utils.aoa_to_sheet(federationRows);
    federationSheet["!cols"] = [12, 42, 16, 28, 24, 10, 44, 36].map((wch) => ({ wch }));
    federationSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    const clubSheet = XLSX.utils.aoa_to_sheet(clubRows);
    clubSheet["!cols"] = [12, 42, 24, 28, 10].map((wch) => ({ wch }));
    clubSheet["!freeze"] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(workbook, federationSheet, "Federaciones");
    XLSX.utils.book_append_sheet(workbook, clubSheet, "Clubs");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="ctrugby-federaciones.xlsx"', "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de federaciones." }, { status: 500 });
  }
}
