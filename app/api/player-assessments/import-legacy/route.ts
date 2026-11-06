import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

type LegacyRecord = { id: string; playerId: string; season: string; date: string | null; label: string; club: string; position: string; values: Record<string, number | null>; notes: { general?: string; nutrition?: string } };
const sourcePath = "C:\\CTRugby_Data_Manager_DEMO\\data\\private\\player-assessments-import.json";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const legacyUuid = (value: string) => { const hash = createHash("sha256").update(value).digest("hex"); return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${(8 + (parseInt(hash[16], 16) % 4)).toString(16)}${hash.slice(17, 20)}-${hash.slice(20, 32)}`; };

export async function POST(request: NextRequest) {
  if (!sameOrigin(request) || process.env.NODE_ENV === "production") return reply({ error: "Importación local no disponible." }, 403);
  const { db, admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const source = JSON.parse(await readFile(sourcePath, "utf8")) as { records?: LegacyRecord[] };
    const records = source.records ?? [];
    const players = await db.from("catalog_players").select("id");
    if (players.error) throw new Error(players.error.message);
    const known = new Set((players.data ?? []).map((player) => player.id));
    const accepted = records.filter((record) => known.has(record.playerId));
    let imported = 0; let failed = 0; let firstFailure = "";
    const queue = [...accepted];
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (queue.length) {
        const record = queue.shift()!;
        const notes = [record.notes.general && `General: ${record.notes.general}`, record.notes.nutrition && `Nutrición: ${record.notes.nutrition}`].filter(Boolean).join("\n\n");
        const saved = await db.rpc("app_save_player_assessment", { p_record: { id: legacyUuid(record.id), player_id: record.playerId, season: record.season, label: record.label, evaluated_on: record.date, club: record.club, position: record.position, metrics: record.values, notes } });
        if (saved.error) { failed++; firstFailure ||= saved.error.message; } else imported++;
      }
    }));
    if (failed) return reply({ error: firstFailure || `Han fallado ${failed} evaluaciones durante la importación.`, imported, skipped: records.length - accepted.length, failed, total: records.length }, 503);
    return reply({ imported, skipped: records.length - accepted.length, failed, total: records.length });
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "No se han podido importar las evaluaciones." }, 500); }
}
