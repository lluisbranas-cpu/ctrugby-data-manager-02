import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") return reply({ error: "La importación local solo está disponible en desarrollo." }, 404);
  if (!sameOrigin(request) || !catalogConfigured()) return reply({ error: "Solicitud no disponible." }, 403);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const root = path.join(process.cwd(), "data", "staging");
    const seasons = JSON.parse(await readFile(path.join(root, "player-seasons.json"), "utf8")) as Array<{ player_id: string; season_year: number; registration_number: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null }>;
    const photos = JSON.parse(await readFile(path.join(root, "player-photos", "manifest.json"), "utf8")) as Array<{ player_id: string; storage_key?: string; prepared_file: string; season_year?: number }>;
    if (!Array.isArray(seasons) || !Array.isArray(photos)) return reply({ error: "La preparación local no tiene un formato válido." }, 400);
    const byPlayer = new Map<string, typeof seasons>();
    for (const season of seasons) byPlayer.set(season.player_id, [...(byPlayer.get(season.player_id) ?? []), season]);
    const latestSeasonByPlayer = new Map([...byPlayer].map(([playerId, rows]) => [playerId, Math.max(...rows.map((row) => row.season_year))]));
    for (const [playerId, rows] of byPlayer) {
      const result = await db.rpc("admin_replace_player_trajectory", { p_player_id: playerId, p_seasons: rows.map(({ season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm }) => ({ season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm })) });
      if (result.error) throw new Error(`${playerId}: ${result.error.message}`);
    }
    const uploaded: string[] = [];
    for (const photo of photos) {
      const seasonYear = Number.isInteger(photo.season_year) ? photo.season_year! : latestSeasonByPlayer.get(photo.player_id);
      if (!seasonYear || seasonYear < 2000 || seasonYear > 2035) throw new Error(`${photo.player_id}: no hay temporada válida para asociar la foto.`);
      const bytes = await readFile(photo.prepared_file);
      const storageKey = `player-season-photos/${photo.player_id}/${seasonYear}.png`;
      const localDirectory = path.join(root, "player-season-photos", photo.player_id);
      await mkdir(localDirectory, { recursive: true });
      await writeFile(path.join(localDirectory, `${seasonYear}.png`), bytes);
      const saved = await db.storage.from("catalog-media-private").upload(storageKey, bytes, { contentType: "image/png", cacheControl: "31536000", upsert: true });
      if (saved.error) throw new Error(`${photo.player_id}: ${saved.error.message}`);
      uploaded.push(storageKey);
      const linked = await db.rpc("admin_set_player_season_photo", { p_player_id: photo.player_id, p_season_year: seasonYear, p_storage_key: storageKey, p_is_primary: false });
      if (linked.error) throw new Error(`${photo.player_id}: ${linked.error.message}`);
    }
    return reply({ ok: true, players: byPlayer.size, seasons: seasons.length, photos: uploaded.length });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "No se ha podido importar la preparación local." }, 500);
  }
}
