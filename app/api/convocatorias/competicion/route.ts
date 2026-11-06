import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { readGroupClubs } from "@/lib/temporary-group-clubs";
import { requireConsultation } from "@/lib/consultation-access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Row = { id: string; clubId: string; category: string; phases: string[] };
const defaults: Row[] = [
  { id: "cabrera-s14", clubId: "ESP0022", category: "S14", phases: ["Previa X"] },
  { id: "cabrera-s16a", clubId: "ESP0022", category: "S16-A", phases: ["Previa F", "Liga 1º"] },
  { id: "cabrera-s16b", clubId: "ESP0022", category: "S16-B", phases: ["Previa X", "Liga 1º"] },
  { id: "cabrera-s19", clubId: "ESP0022", category: "S19", phases: [] },
];
const location = path.join(process.cwd(), "data", "competition", "2026-27.json");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
async function readRows(): Promise<Row[]> {
  try { return JSON.parse(await readFile(location, "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaults; throw error; }
}
let queue: Promise<unknown> = Promise.resolve();
export async function GET(request: NextRequest) {
  const denied = await requireConsultation(request); if (denied) return denied;
  try { const { admin } = await catalogAccess(request); return reply({ rows: await readRows(), admin }); }
  catch { return reply({ error: "No se ha podido cargar la competición." }, 500); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const { admin, db } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const row = await request.json();
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(row.id) || typeof row.clubId !== "string" || !/^[A-Z]{3}\d{4}$/.test(row.clubId) || typeof row.category !== "string" || !row.category.trim() || row.category.length > 80 || !Array.isArray(row.phases) || row.phases.length > 30 || row.phases.some((phase: unknown) => typeof phase !== "string" || !phase.trim() || phase.length > 160)) return reply({ error: "Indica un club, una categoría y fases válidas (hasta 30)." }, 400);
    const club = await db.from("catalog_clubs").select("id").eq("id", row.clubId).maybeSingle();
    if ((!club.data && !(await readGroupClubs()).some(group => group.id === row.clubId))) return reply({ error: "El club seleccionado no está disponible." }, 400);
    const clean: Row = { id: row.id, clubId: row.clubId, category: row.category.trim(), phases: [...new Set<string>(row.phases.map((phase: string) => phase.trim()))] };
    const task = queue.then(async () => {
      const rows = await readRows();
      if (rows.some(existing => existing.id !== clean.id && existing.clubId === clean.clubId && existing.category.toLocaleLowerCase("es") === clean.category.toLocaleLowerCase("es"))) throw new Error("duplicate");
      const index = rows.findIndex(existing => existing.id === clean.id);
      if (index < 0) rows.push(clean); else rows[index] = clean;
      await mkdir(path.dirname(location), { recursive: true });
      const temporary = location + "." + randomUUID() + ".tmp";
      try { await writeFile(temporary, JSON.stringify(rows, null, 2), "utf8"); await rename(temporary, location); }
      finally { await rm(temporary, { force: true }); }
      return rows;
    });
    queue = task.catch(() => undefined);
    return reply({ rows: await task, ok: true });
  } catch (error) { return reply({ error: error instanceof Error && error.message === "duplicate" ? "Este club ya tiene una fila con esa categoría." : "No se ha podido guardar la fila." }, 400); }
}


export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json();
    if (!body || typeof body.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(body.id)) return reply({ error: "Fila no válida." }, 400);
    const task = queue.then(async () => {
      const rows = (await readRows()).filter(row => row.id !== body.id);
      await mkdir(path.dirname(location), { recursive: true });
      const temporary = location + "." + randomUUID() + ".tmp";
      try { await writeFile(temporary, JSON.stringify(rows, null, 2), "utf8"); await rename(temporary, location); }
      finally { await rm(temporary, { force: true }); }
      return rows;
    });
    queue = task.catch(() => undefined);
    return reply({ rows: await task, ok: true });
  } catch { return reply({ error: "No se ha podido eliminar la fila." }, 400); }
}
