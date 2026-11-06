import { readPlayerNews, savePlayerNews } from "@/lib/player-news";
import { callupLinkKey } from "@/lib/player-callup-links";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { saveCallupLink, validSourceUrl } from "@/lib/player-callup-links";

export const runtime = "nodejs";
export async function POST(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const reply = (data: unknown, status = 200) => NextResponse.json(data, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
  if (!sameOrigin(request)) return reply({error: "Origen no permitido."}, 403);
  const {id} = await params;
  if (!/^JUG\d{4}$/.test(id)) return reply({error: "Jugador no válido."}, 400);
  try {
    const {admin, db} = await catalogAccess(request);
    if (!admin) return reply({error: "Acceso de administrador requerido."}, 403);
    const body = await request.json();
    const url = validSourceUrl(body.url);
    if (typeof body.key !== "string" || !/^[a-f0-9]{64}$/.test(body.key) || !url) return reply({error: "Introduce una URL http o https válida."}, 400);
    const player = await db.from("catalog_players").select("id").eq("id", id).maybeSingle();
    if (player.error) return reply({error: "No se ha podido comprobar el jugador."}, 503);
    if (!player.data) return reply({error: "Jugador no encontrado."}, 404);
    const source = (await readPlayerNews(id)).find(record => record.type === "seleccion" && record.selection && callupLinkKey({id: record.id, federation_id: record.selection.federation_id}) === body.key);
    if (source) await savePlayerNews({...source, url});
    else await saveCallupLink(id, body.key, url);
    return reply({ok: true, url});
  } catch { return reply({error: "No se ha podido guardar el enlace."}, 503); }
}
