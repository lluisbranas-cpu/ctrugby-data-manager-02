import { NextRequest, NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import path from "node:path";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { isLocalRequestOrigin } from "@/lib/request-origin";
import { localNewsPlayers, localNewsStaff } from "@/lib/news-players";
import { createPlayerTitle, deletePlayerTitle, NewPlayerTitle, PlayerTitleConflictError, PlayerTitleNotFoundError, readPlayerTitles, updatePlayerTitle } from "@/lib/player-title-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status,
  headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});
function validateTitleInput(value: unknown): NewPlayerTitle {
  if (!value || typeof value !== "object") throw new Error("Datos del título no válidos.");
  const data = value as Record<string, unknown>;
  const id = typeof data.id === "string" ? data.id.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const competition = typeof data.competition === "string" ? data.competition.trim() : "";
  const result = typeof data.result === "string" ? data.result.trim() : "";
  const year = typeof data.year === "number" ? data.year : Number(data.year);
  const playerIds = Array.isArray(data.player_ids) ? data.player_ids : [];
  const staffIds = Array.isArray(data.staff_ids) ? data.staff_ids : [];
  const unlinkedParticipants = Array.isArray(data.unlinked_participants) ? data.unlinked_participants : [];
  const date = typeof data.date === "string" ? data.date.trim() : "";
  const sourceName = typeof data.source_name === "string" ? data.source_name.trim() : "";
  const sourceUrl = typeof data.source_url === "string" ? data.source_url.trim() : "";
  const team = typeof data.team === "string" ? data.team.trim() : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/.test(id)) throw new Error("Indica un ID-Título válido.");
  if (!title || title.length > 240) throw new Error("Indica un título de hasta 240 caracteres.");
  if (!Number.isInteger(year) || year < 1800 || year > 2200) throw new Error("Indica un año válido de cuatro cifras.");
  if (!competition || competition.length > 240) throw new Error("Indica una competición de hasta 240 caracteres.");
  if (!result || result.length > 240) throw new Error("Indica un resultado de hasta 240 caracteres.");
  if (playerIds.length > 300 || playerIds.some((playerId) => typeof playerId !== "string" || !/^JUG\d{4}$/.test(playerId))) throw new Error("Selecciona jugadores válidos.");
  if (staffIds.length > 200 || staffIds.some((staffId) => typeof staffId !== "string" || !/^STF\d{4}$/.test(staffId))) throw new Error("Selecciona miembros del staff válidos.");
  if (unlinkedParticipants.length > 300 || unlinkedParticipants.some((name) => typeof name !== "string" || !name.trim() || name.trim().length > 160)) {
    throw new Error("Revisa los nombres de participantes sin ficha.");
  }
  const uniquePlayerIds = [...new Set(playerIds as string[])];
  const uniqueStaffIds = [...new Set(staffIds as string[])];
  const uniqueUnlinkedParticipants = [...new Set((unlinkedParticipants as string[]).map((name) => name.trim()))];
  if (uniquePlayerIds.length !== playerIds.length || uniqueStaffIds.length !== staffIds.length || uniqueUnlinkedParticipants.length !== unlinkedParticipants.length) {
    throw new Error("No repitas participantes en el mismo título.");
  }
  if (!uniquePlayerIds.length && !uniqueStaffIds.length && !uniqueUnlinkedParticipants.length) throw new Error("Selecciona al menos un jugador o miembro del staff.");
  if (date.length > 40 || sourceName.length > 160 || team.length > 240) throw new Error("Revisa la fecha, equipo o nombre de la fuente.");
  if (sourceUrl.length > 2048) throw new Error("La URL de fuente es demasiado larga.");
  if (sourceUrl) {
    try { const url = new URL(sourceUrl); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(); }
    catch { throw new Error("Indica una URL de fuente válida."); }
  }
  return {
    id, title, year, competition, result, date, source_name: sourceName, source_url: sourceUrl, team,
    player_ids: uniquePlayerIds, staff_ids: uniqueStaffIds, unlinked_participants: uniqueUnlinkedParticipants,
  };
}

async function checkMutationAccess(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!isLocalRequestOrigin(request)) {
    return reply({ error: "La edición de títulos solo está disponible en la administración local." }, 403);
  }
  if (!catalogConfigured()) return reply({ error: "Catálogo no disponible." }, 503);
  let admin: boolean;
  try {
    admin = (await catalogAccess(request)).admin;
  } catch {
    return reply({ error: "No se ha podido comprobar el acceso de administrador." }, 503);
  }
  return admin ? null : reply({ error: "Acceso de administrador requerido." }, 403);
}

async function validateParticipants(input: NewPlayerTitle) {
  const knownPlayers = new Set((await localNewsPlayers()).map((player) => player.id));
  const knownStaff = new Set((await localNewsStaff()).map((person) => person.id));
  return input.player_ids.every((playerId) => knownPlayers.has(playerId))
    && (input.staff_ids ?? []).every((staffId) => knownStaff.has(staffId));
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("player_id");
  const staffId = request.nextUrl.searchParams.get("staff_id");
  if (playerId && !/^JUG\d{4}$/.test(playerId)) return reply({ error: "Jugador no válido." }, 400);
  if (staffId && !/^STF\d{4}$/.test(staffId)) return reply({ error: "Miembro del staff no válido." }, 400);
  try {
    const titles = await readPlayerTitles();
    const filteredTitles = playerId ? titles.filter((title) => title.player_ids.includes(playerId))
      : staffId ? titles.filter((title) => title.staff_ids?.includes(staffId)) : titles;
    return reply({ titles: filteredTitles });
  } catch {
    return reply({ error: "No se han podido cargar los títulos." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkMutationAccess(request);
  if (denied) return denied;
  let input: NewPlayerTitle;
  try {
    input = validateTitleInput(await request.json());
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "La solicitud no contiene datos válidos." }, 400);
  }

  try {
    if (!await validateParticipants(input)) return reply({ error: "Uno o más participantes ya no están disponibles. Recarga la ficha." }, 404);
    const created = await createPlayerTitle(input);
    return reply({ ok: true, title: created.title, titles: created.titles }, 201);
  } catch (error) {
    if (error instanceof PlayerTitleConflictError) return reply({ error: error.message }, 409);
    return reply({ error: "No se ha podido guardar el título." }, 500);
  }
}

export async function PUT(request: NextRequest) {
  const denied = await checkMutationAccess(request);
  if (denied) return denied;
  let body: unknown;
  let input: NewPlayerTitle;
  try {
    body = await request.json();
    input = validateTitleInput(body);
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "La solicitud no contiene datos válidos." }, 400);
  }
  const originalId = body && typeof body === "object" && "original_id" in body && typeof body.original_id === "string"
    ? body.original_id
    : "";
  if (!originalId || originalId.length > 80) return reply({ error: "No se ha indicado el ID-Título original." }, 400);

  try {
    if (!await validateParticipants(input)) return reply({ error: "Uno o más participantes ya no están disponibles. Recarga la ficha." }, 404);
    const updated = await updatePlayerTitle(originalId, input);
    return reply({ ok: true, title: updated.title, titles: updated.titles });
  } catch (error) {
    if (error instanceof PlayerTitleConflictError) return reply({ error: error.message }, 409);
    if (error instanceof PlayerTitleNotFoundError) return reply({ error: error.message }, 404);
    return reply({ error: "No se ha podido actualizar el título." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await checkMutationAccess(request);
  if (denied) return denied;
  let id = "";
  try {
    const body: unknown = await request.json();
    if (body && typeof body === "object" && "id" in body && typeof body.id === "string") id = body.id.trim();
  } catch {
    return reply({ error: "Indica el ID-Título que quieres eliminar." }, 400);
  }
  if (!id || id.length > 80) return reply({ error: "Indica un ID-Título válido." }, 400);

  try {
    const deleted = await deletePlayerTitle(id);
    if (deleted.title.image_key) {
      try {
        await rm(path.join(process.cwd(), "data", "staging", "player-title-images", `${deleted.title.image_key}.webp`), {force: true});
      } catch {
        return reply({ error: "El título se eliminó, pero no se pudo eliminar su imagen local." }, 500);
      }
    }
    return reply({ ok: true, titles: deleted.titles });
  } catch (error) {
    if (error instanceof PlayerTitleNotFoundError) return reply({ error: error.message }, 404);
    return reply({ error: "No se ha podido eliminar el título." }, 500);
  }
}
