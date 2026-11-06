import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { requireConsultation } from "@/lib/consultation-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Callup = { id: string; day: string; callTime: string; venue: "local" | "visitante"; home: string; away: string; homeLabel: string; awayLabel: string; field: string; category: string; phase: string };
type StoredCallup = { id: string; day: string; call_time: string; venue: "local" | "visitante"; home: string; away: string; home_label: string; away_label: string; field: string; category: string; phase: string };
const location = path.join(process.cwd(), "data", "competition", "callups-2026-27.json");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const isId = (value: unknown) => typeof value === "string" && /^[A-Z]{3}\d{4}$/.test(value);
const isText = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max;
async function readRows(): Promise<Callup[]> { try { return (JSON.parse(await readFile(location, "utf8")) as Array<Partial<Callup>>).map(row => ({ ...row, venue: row.venue === "visitante" ? "visitante" : "local" } as Callup)); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; } }
async function writeRows(rows: Callup[]) { await mkdir(path.dirname(location), { recursive: true }); const temporary = `${location}.${randomUUID()}.tmp`; try { await writeFile(temporary, JSON.stringify(rows, null, 2), "utf8"); await rename(temporary, location); } finally { await rm(temporary, { force: true }); } }
const fromStored = (row: StoredCallup): Callup => ({ id: row.id, day: row.day, callTime: row.call_time.slice(0, 5), venue: row.venue, home: row.home, away: row.away, homeLabel: row.home_label, awayLabel: row.away_label, field: row.field, category: row.category, phase: row.phase });
const toStored = (row: Callup): StoredCallup => ({ id: row.id, day: row.day, call_time: row.callTime, venue: row.venue, home: row.home, away: row.away, home_label: row.homeLabel, away_label: row.awayLabel, field: row.field, category: row.category, phase: row.phase });
const onlineStorage = () => process.env.NODE_ENV === "production" && catalogConfigured();

export async function GET(request: NextRequest) { const denied = await requireConsultation(request); if (denied) return denied; try { const { db, admin } = await catalogAccess(request); if (onlineStorage()) { const { data, error } = await db.from("catalog_callups").select("id,day,call_time,venue,home,away,home_label,away_label,field,category,phase").order("day").order("call_time"); if (error) throw error; return reply({ rows: (data as StoredCallup[]).map(fromStored), admin }); } return reply({ rows: await readRows(), admin }); } catch { return reply({ error: "No se han podido cargar las convocatorias." }, 500); } }
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const { admin } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const row = await request.json() as Callup;
    if (!row || typeof row.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(row.id) || !/^\d{4}-\d{2}-\d{2}$/.test(row.day) || !/^\d{2}:\d{2}$/.test(row.callTime) || !["local", "visitante"].includes(row.venue) || !isId(row.home) || !isId(row.away) || !isText(row.homeLabel, 80) || !isText(row.awayLabel, 80) || !isText(row.field, 160) || !row.field.trim() || !isText(row.category, 80) || !isText(row.phase, 160)) return reply({ error: "Completa fecha, hora, equipos y campo con datos válidos." }, 400);
    const clean: Callup = { ...row, homeLabel: row.homeLabel.trim(), awayLabel: row.awayLabel.trim(), field: row.field.trim(), category: row.category.trim(), phase: row.phase.trim() };
    if (onlineStorage()) { const { db } = await catalogAccess(request); const { data, error } = await db.from("catalog_callups").upsert(toStored(clean)).select("id,day,call_time,venue,home,away,home_label,away_label,field,category,phase"); if (error) throw error; return reply({ rows: (data as StoredCallup[]).map(fromStored), ok: true }); }
    const rows = await readRows(); const index = rows.findIndex(item => item.id === clean.id); if (index < 0) rows.push(clean); else rows[index] = clean; await writeRows(rows); return reply({ rows, ok: true });
  } catch { return reply({ error: "No se ha podido guardar la convocatoria." }, 400); }
}
export async function DELETE(request: NextRequest) { if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403); try { const { admin, db } = await catalogAccess(request); if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403); const { id } = await request.json(); if (typeof id !== "string") return reply({ error: "Fila no válida." }, 400); if (onlineStorage()) { const { error } = await db.from("catalog_callups").delete().eq("id", id); if (error) throw error; const { data, error: selectError } = await db.from("catalog_callups").select("id,day,call_time,venue,home,away,home_label,away_label,field,category,phase").order("day").order("call_time"); if (selectError) throw selectError; return reply({ rows: (data as StoredCallup[]).map(fromStored), ok: true }); } const rows = (await readRows()).filter(row => row.id !== id); await writeRows(rows); return reply({ rows, ok: true }); } catch { return reply({ error: "No se ha podido eliminar la convocatoria." }, 400); } }
