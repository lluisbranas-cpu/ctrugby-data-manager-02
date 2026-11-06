import { localNewsPlayers } from "@/lib/news-players";
import { readGroupMemberships } from "@/lib/temporary-group-clubs";
import { publicNewsRecord } from "@/lib/public-news-record";
import { campusParticipationTitle } from "@/app/lib/campus-title";
import { participationCategoryImage } from "@/lib/participation-category-image";
import { readLocalClubs, readProfessionalCategories } from "@/lib/professional-club-milestones";
import { newsFederations } from "@/lib/news-selection";
import { NextRequest, NextResponse } from "next/server";
import { requireConsultation } from "@/lib/consultation-access";
import { catalogAccess, catalogConfigured, localAdminAccess, sameOrigin } from "@/lib/catalog";
import { likidHubPreviewReadOnly } from "@/lib/likidhub-preview";
import { deletePlayerNews, newsFromBody, readPlayerNews, savePlayerNews, validNewsId, newsWithImage } from "@/lib/player-news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function GET(request: NextRequest) {
  // The featured public view must never fall back to its legacy local news feed
  // while the isolated LikidHub preview is active.
  if (likidHubPreviewReadOnly()) return reply({ configured: true, admin: false, news: [], players: [] });
  const denied = await requireConsultation(request); if (denied) return denied;
  if (!catalogConfigured()) return reply({ configured: false, admin: false, news: [], players: [] });
  try {
    const { db, admin } = await catalogAccess(request);
    const playerId = request.nextUrl.searchParams.get("player_id");
    if (playerId && !/^JUG\d{4}$/.test(playerId)) return reply({ error: "Jugador no válido." }, 400);
    const playersResult = localAdminAccess(request)
      ? { data: await localNewsPlayers(), error: null }
      : await db.from("catalog_players").select("id,first_name,last_name");
    if (playersResult.error) return reply({ error: "No se han podido cargar los jugadores." }, 503);
    const groupMemberships = await readGroupMemberships();
    const players = (playersResult.data ?? []).map((player) => ({ club_groups: groupMemberships.get(player.id) ?? [], id: player.id, name: [player.first_name, player.last_name].filter(Boolean).join(" ") })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    const ids = new Set(players.map((player) => player.id));
    const news = (await readPlayerNews(playerId ?? undefined)).filter((item) => ids.has(item.player_id) && ((admin && !playerId && request.nextUrl.searchParams.get("view") !== "published") || item.published));
    return reply({ configured: true, admin, news: (await Promise.all(news.map(newsWithImage))).map((record) => admin ? record : publicNewsRecord(record)), players, federations: admin ? await newsFederations(db) : [], clubs: admin ? await readLocalClubs() : [], campuses: admin ? (await readProfessionalCategories()).filter(item => item.type === "CAMP").map(item => ({id: item.id, label: item.label})) : [], categories: admin ? await Promise.all((await readProfessionalCategories()).filter(item => item.type !== "CAMP").map(async item => ({...item,...await participationCategoryImage(item.label)}))) : [] });
  } catch { return reply({ error: "No se han podido cargar las noticias." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "Catálogo no disponible." }, 503);
  try {
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body = await request.json();
    if (body?.action === "delete") {
      if (typeof body.id !== "string" || !validNewsId(body.id)) return reply({error: "Registro no válido."}, 400);
      if (!(await readPlayerNews()).some(record => record.id === body.id)) return reply({error: "El registro ya no existe. Recarga la tabla."}, 404);
      await deletePlayerNews(body.id);
      return reply({ok: true, id: body.id});
    }
    if (body?.action === "set-status") {
      if (typeof body.id !== "string" || !validNewsId(body.id) || typeof body.published !== "boolean") return reply({ error: "Estado no válido." }, 400);
      const existing = (await readPlayerNews()).find((record) => record.id === body.id);
      if (!existing) return reply({ error: "La noticia ya no existe. Recarga la tabla." }, 409);
      return reply({ ok: true, news: await newsWithImage(await savePlayerNews({ ...existing, published: body.published })) });
    }
    const existing = await readPlayerNews();
    const previous = typeof body?.id === "string" ? existing.find(record => record.id === body.id) : undefined;
    const merged = {...previous, ...body};
    if (merged.type === "participacion") {
      const data = {...previous?.participation, ...body.participation};
      const club = data.club_id ? (await readLocalClubs()).find(item => item.id === data.club_id) : null;
      if (data.club_id && !club) return reply({error: "Selecciona un club de la lista."},400);
      if (club) data.club_name = club.name;
      if (!data.club_id) {data.club_id = null; data.club_name = typeof data.club_name === "string" ? data.club_name : "";}
      if (data.kind === "campus") {
        const campus = (await readProfessionalCategories()).find(item => item.type === "CAMP" && item.id === data.campus_id);
        if (!campus) return reply({error: "Selecciona un campus de la lista."}, 400);
        data.year = typeof data.year === "string" ? data.year.trim() || null : null;
        data.pending_year = !data.year;
        data.count = data.year ? 1 : data.count ?? 1;
        merged.title = campusParticipationTitle(campus.label, data.year);
        data.category = typeof data.category === "string" ? data.category : "";
        if (data.year && !/^20\d{2}$/.test(data.year)) return reply({error: "Indica el año de edición con cuatro cifras."},400);
        merged.date_or_season = data.year || "";
        const duplicate = existing.find(item => item.id !== merged.id && item.type === "participacion" && item.player_id === merged.player_id && item.participation?.kind === "campus" && data.year && item.participation.campus_id === data.campus_id && item.participation.year === data.year);
        if (duplicate) return reply({error: "Este jugador ya tiene una participación en ese campus y año."},409);
      }
      const category = (await readProfessionalCategories()).find(item=>item.type!=="CAMP" && item.label===data.category);
      if (data.kind !== "campus" && !category && data.category !== previous?.participation?.category) return reply({error:"Selecciona una categoría deportiva de la lista."},400);
      if (previous?.participation?.migration_sources) data.migration_sources = previous.participation.migration_sources;
      if (!previous || body.date_or_season !== undefined && body.date_or_season !== previous.date_or_season) data.season_label = merged.date_or_season || null;
      merged.participation = data; merged.url = "";
    }
    if (merged.type === "seleccion") {
      merged.selection = {...previous?.selection, ...body.selection, ...(previous?.selection?.migration_sources ? {migration_sources: previous.selection.migration_sources} : {})};
      if (previous && body.date_or_season !== undefined && body.date_or_season !== previous.date_or_season) merged.selection.season_label = body.date_or_season || null;
    }
    const input = newsFromBody(merged);
    if (!input) return reply({ error: "Completa jugador, titular, fecha o temporada y URL. Para Selección, indica federación, categoría, modalidad y género." }, 400);
    const player = localAdminAccess(request)
      ? { data: (await localNewsPlayers()).find(player => player.id === input.player_id), error: null }
      : await db.from("catalog_players").select("id").eq("id", input.player_id).maybeSingle();
    if (player.error) return reply({ error: "No se ha podido comprobar el jugador." }, 503);
    if (!player.data) return reply({ error: "El jugador no existe." }, 404);
    if (input.type === "seleccion" && !((await newsFederations(db)).some(item => item.id === input.selection?.federation_id))) return reply({error: "Selecciona una federación de la lista."}, 400);
    if (input.id && !existing.some((record) => record.id === input.id)) return reply({ error: "La noticia ya no existe. Recarga la tabla." }, 409);
    if (input.type !== "seleccion" && input.url && existing.some((record) => record.id !== input.id && record.player_id === input.player_id && record.url === input.url)) return reply({ error: "Esta noticia ya está registrada para este jugador." }, 409);
    return reply({ ok: true, news: await newsWithImage(await savePlayerNews(input)) });
  } catch { return reply({ error: "No se ha podido guardar la noticia. Inténtalo de nuevo." }, 503); }
}
