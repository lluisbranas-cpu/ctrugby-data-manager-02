import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SheetRow = Record<string, unknown>;
type Issue = { sheet: string; row: number; field: string; message: string };
type Club = { id: string; action: "actualizar" | "nuevo"; name: string; active: boolean; founded_text: string | null; disappeared_text: string | null; city: string; province: string; region: string; country: string; latitude: number; longitude: number; maps_url: string; website: string | null; instagram: string | null; published: boolean };
type Federation = { id: string; action: "actualizar" | "nuevo"; name: string; scope: string; territory: string; country: string; active: boolean; website: string | null; published: boolean };
type PrivateData = { kind: "club" | "federation"; id: string; note?: string; email?: string | null; legacyClubCount?: number | null };

const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const text = (value: unknown) => typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
const optional = (value: unknown) => text(value) || null;
const validText = (value: unknown, field: string, sheet: string, row: number, issues: Issue[], maximum = 160) => {
  const result = text(value);
  if (!result) issues.push({ sheet, row, field, message: "es obligatorio" });
  else if (result.length > maximum) issues.push({ sheet, row, field, message: `supera ${maximum} caracteres` });
  return result;
};
const boolean = (value: unknown, field: string, sheet: string, row: number, issues: Issue[]) => {
  const normalized = text(value).toLocaleLowerCase("es-ES");
  if (["sí", "si", "true", "1"].includes(normalized)) return true;
  if (["no", "false", "0"].includes(normalized)) return false;
  issues.push({ sheet, row, field, message: "debe ser Sí o No" });
  return false;
};
const number = (value: unknown, field: string, sheet: string, row: number, issues: Issue[], minimum: number, maximum: number) => {
  const result = typeof value === "number" ? value : Number(text(value).replace(",", "."));
  if (!Number.isFinite(result) || result < minimum || result > maximum) {
    issues.push({ sheet, row, field, message: `debe estar entre ${minimum} y ${maximum}` });
    return 0;
  }
  return result;
};
const https = (value: unknown, field: string, sheet: string, row: number, issues: Issue[], required = false) => {
  const result = optional(value);
  if (!result && required) issues.push({ sheet, row, field, message: "es obligatorio" });
  if (!result) return null;
  try {
    if (new URL(result).protocol !== "https:") throw new Error("protocol");
    return result;
  } catch {
    issues.push({ sheet, row, field, message: "debe ser una URL https:// válida" });
    return null;
  }
};
const rows = (book: XLSX.WorkBook, name: string, issues: Issue[]) => {
  const sheet = book.Sheets[name];
  if (!sheet) {
    issues.push({ sheet: name, row: 0, field: "pestaña", message: "no existe" });
    return [] as SheetRow[];
  }
  return XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: null, raw: false });
};
const action = (value: unknown, sheet: string, row: number, issues: Issue[]) => {
  const result = text(value).toLocaleLowerCase("es-ES");
  if (result === "actualizar" || result === "nuevo") return result;
  issues.push({ sheet, row, field: "Acción", message: "debe ser actualizar o nuevo" });
  return "actualizar" as const;
};

function parseClubs(source: SheetRow[], issues: Issue[]) {
  return source.map((sourceRow, index): Club => {
    const row = index + 2;
    const sheet = "Clubs";
    const id = validText(sourceRow.ID, "ID", sheet, row, issues, 7).toUpperCase();
    if (!/^[A-Z]{3}[0-9]{4}$/.test(id)) issues.push({ sheet, row, field: "ID", message: "debe tener el formato AAA0000" });
    const instagram = optional(sourceRow.Instagram);
    if (instagram && !/^@\S+$/.test(instagram)) issues.push({ sheet, row, field: "Instagram", message: "debe comenzar con @ y no contener espacios" });
    return {
      id, action: action(sourceRow["Acción"], sheet, row, issues), name: validText(sourceRow.Nombre, "Nombre", sheet, row, issues),
      active: boolean(sourceRow.Activo, "Activo", sheet, row, issues), founded_text: optional(sourceRow["Fundación"]), disappeared_text: optional(sourceRow["Desaparición"]),
      city: validText(sourceRow.Ciudad, "Ciudad", sheet, row, issues, 120), province: validText(sourceRow.Provincia, "Provincia", sheet, row, issues, 120),
      region: validText(sourceRow["Región"], "Región", sheet, row, issues, 120), country: validText(sourceRow["País"], "País", sheet, row, issues, 120),
      latitude: number(sourceRow.Latitud, "Latitud", sheet, row, issues, -90, 90), longitude: number(sourceRow.Longitud, "Longitud", sheet, row, issues, -180, 180),
      maps_url: https(sourceRow["URL de mapa"], "URL de mapa", sheet, row, issues, true) ?? "", website: https(sourceRow.Web, "Web", sheet, row, issues),
      instagram, published: boolean(sourceRow.Publicar, "Publicar", sheet, row, issues),
    };
  });
}

function parseFederations(source: SheetRow[], issues: Issue[]) {
  return source.map((sourceRow, index): Federation => {
    const row = index + 2;
    const sheet = "Federaciones";
    const id = validText(sourceRow.ID, "ID", sheet, row, issues, 5).toUpperCase();
    if (!/^F[A-Z][0-9]{3}$/.test(id)) issues.push({ sheet, row, field: "ID", message: "debe tener el formato FA000" });
    return {
      id, action: action(sourceRow["Acción"], sheet, row, issues), name: validText(sourceRow.Nombre, "Nombre", sheet, row, issues),
      scope: validText(sourceRow["Ámbito"], "Ámbito", sheet, row, issues, 80), territory: validText(sourceRow.Territorio, "Territorio", sheet, row, issues, 120),
      country: validText(sourceRow["País"], "País", sheet, row, issues, 120), active: boolean(sourceRow.Activo, "Activo", sheet, row, issues),
      website: https(sourceRow.Web, "Web", sheet, row, issues), published: boolean(sourceRow.Publicar, "Publicar", sheet, row, issues),
    };
  });
}

function parsePrivate(source: SheetRow[], issues: Issue[]) {
  return source.flatMap((sourceRow, index): PrivateData[] => {
    const row = index + 2;
    const rawKind = text(sourceRow.Tipo).toLocaleLowerCase("es-ES");
    const kind = rawKind === "club" ? "club" : rawKind === "federación" || rawKind === "federacion" ? "federation" : null;
    const id = text(sourceRow.ID).toUpperCase();
    if (!kind) { issues.push({ sheet: "Datos privados", row, field: "Tipo", message: "debe ser club o federación" }); return []; }
    if (!id) { issues.push({ sheet: "Datos privados", row, field: "ID", message: "es obligatorio" }); return []; }
    const note = optional(sourceRow["Nota interna"]);
    const email = optional(sourceRow.Correo);
    const countText = text(sourceRow["Clubs heredados"]);
    const legacyClubCount = countText ? Number(countText) : null;
    if (note && note.length > 5000) issues.push({ sheet: "Datos privados", row, field: "Nota interna", message: "supera 5000 caracteres" });
    if (email && email.length > 320) issues.push({ sheet: "Datos privados", row, field: "Correo", message: "supera 320 caracteres" });
    if (legacyClubCount != null && (!Number.isInteger(legacyClubCount) || legacyClubCount < 0)) issues.push({ sheet: "Datos privados", row, field: "Clubs heredados", message: "debe ser un entero igual o mayor que cero" });
    return [{ kind, id, note: note ?? undefined, email, legacyClubCount }];
  });
}

function duplicates(records: { id: string }[], sheet: string, issues: Issue[]) {
  const seen = new Set<string>();
  records.forEach((record, index) => {
    if (seen.has(record.id)) issues.push({ sheet, row: index + 2, field: "ID", message: "está duplicado" });
    seen.add(record.id);
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return response({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return response({ error: "El catálogo todavía no está conectado." }, 503);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return response({ error: "Acceso de administrador requerido." }, 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return response({ error: "Selecciona un archivo .xlsx generado desde la plantilla." }, 400);
    if (file.size === 0 || file.size > 5_000_000) return response({ error: "El archivo debe ocupar entre 1 byte y 5 MB." }, 413);
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const issues: Issue[] = [];
    const clubs = parseClubs(rows(workbook, "Clubs", issues), issues);
    const federations = parseFederations(rows(workbook, "Federaciones", issues), issues);
    const privateData = parsePrivate(rows(workbook, "Datos privados", issues), issues);
    if (!clubs.length) issues.push({ sheet: "Clubs", row: 0, field: "filas", message: "debe contener al menos un club" });
    if (!federations.length) issues.push({ sheet: "Federaciones", row: 0, field: "filas", message: "debe contener al menos una federación" });
    duplicates(clubs, "Clubs", issues); duplicates(federations, "Federaciones", issues);
    if (issues.length) return response({ error: "La hoja tiene datos que deben corregirse.", issues: issues.slice(0, 50) }, 422);

    const [currentClubs, currentFederations] = await Promise.all([
      db.from("catalog_clubs").select("id,version").in("id", clubs.map((club) => club.id)),
      db.from("catalog_federations").select("id,version").in("id", federations.map((federation) => federation.id)),
    ]);
    if (currentClubs.error || currentFederations.error) return response({ error: "No se ha podido comprobar el catálogo actual." }, 503);
    const clubVersions = new Map((currentClubs.data ?? []).map((item) => [item.id, item.version]));
    const federationVersions = new Map((currentFederations.data ?? []).map((item) => [item.id, item.version]));
    const conflicts: Issue[] = [];
    for (const [index, club] of clubs.entries()) {
      if (club.action === "actualizar" && !clubVersions.has(club.id)) conflicts.push({ sheet: "Clubs", row: index + 2, field: "ID", message: "no existe para actualizar" });
      if (club.action === "nuevo" && clubVersions.has(club.id)) conflicts.push({ sheet: "Clubs", row: index + 2, field: "ID", message: "ya existe; usa actualizar" });
    }
    for (const [index, federation] of federations.entries()) {
      if (federation.action === "actualizar" && !federationVersions.has(federation.id)) conflicts.push({ sheet: "Federaciones", row: index + 2, field: "ID", message: "no existe para actualizar" });
      if (federation.action === "nuevo" && federationVersions.has(federation.id)) conflicts.push({ sheet: "Federaciones", row: index + 2, field: "ID", message: "ya existe; usa actualizar" });
    }
    if (conflicts.length) return response({ error: "La hoja no coincide con el catálogo actual.", issues: conflicts.slice(0, 50) }, 409);

    const imported = await db.rpc("admin_import_catalog_sheet", {
      p_clubs: clubs.map((club) => ({
        id: club.id, name: club.name, active: club.active, founded_text: club.founded_text, disappeared_text: club.disappeared_text,
        city: club.city, province: club.province, region: club.region, country: club.country, latitude: club.latitude,
        longitude: club.longitude, maps_url: club.maps_url, website: club.website, instagram: club.instagram,
        published: club.published, version: (clubVersions.get(club.id) ?? 0) + 1,
      })),
      p_federations: federations.map((federation) => ({
        id: federation.id, name: federation.name, scope: federation.scope, territory: federation.territory,
        country: federation.country, active: federation.active, website: federation.website,
        published: federation.published, version: (federationVersions.get(federation.id) ?? 0) + 1,
      })),
      p_private: privateData.map((entry) => ({ kind: entry.kind, id: entry.id, note: entry.note ?? null, email: entry.email ?? null, legacy_club_count: entry.legacyClubCount ?? null })),
    });
    if (imported.error) return response({ error: "No se ha podido importar la hoja. Comprueba que se ejecutó la migración 202609250004_catalog_sheet_import.sql y recarga antes de reintentar." }, 503);
    return response({ ok: true, clubs: clubs.length, federations: federations.length, privateRows: privateData.length });
  } catch {
    return response({ error: "No se ha podido leer el archivo. Exporta de nuevo la hoja como .xlsx y vuelve a intentarlo." }, 400);
  }
}
