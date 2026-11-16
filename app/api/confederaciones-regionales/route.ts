import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "node:fs/promises";
import { catalogAccess, localAdminAccess, sameOrigin } from "@/lib/catalog";
import { readRegionalRugbyAssociations, regionalAssociationsDataPath } from "@/lib/regional-rugby-association-data";
import { upsertOperationalDocument } from "@/lib/operational-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

async function isAdmin(request: NextRequest) { return localAdminAccess(request) || (await catalogAccess(request)).admin; }
export async function GET(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido.", admin: false }, 403);
  return reply({ associations: await readRegionalRugbyAssociations(), admin: true });
}
export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!(await isAdmin(request))) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const associations = await request.json();
    if (!Array.isArray(associations) || associations.length !== 6 || new Set(associations.map((item) => item.code)).size !== 6 || associations.some((item) => !/^CR-\d{3}$/.test(item?.code ?? "") || ![item.id, item.name, item.acronym, item.territory, item.summary].every((value) => typeof value === "string" && value.trim()) || !Array.isArray(item.members) || item.members.some((member: unknown) => typeof member !== "string" || !member.trim()))) return reply({ error: "Revisa los datos de las confederaciones." }, 400);
    await upsertOperationalDocument("confederation", "regional-associations", associations);
    await writeFile(regionalAssociationsDataPath, `${JSON.stringify(associations, null, 2)}\n`, "utf8");
    return reply({ associations });
  } catch { return reply({ error: "No se han podido guardar las confederaciones." }, 400); }
}
