import { readPlayerNews, newsWithImage } from "@/lib/player-news";
import { callupLinkKey } from "@/lib/player-callup-links";
import { NextRequest, NextResponse } from "next/server";
import { requireConsultation } from "@/lib/consultation-access";
import { publishedCallupSources } from "@/lib/player-callup-sources";
import { articleMetadata } from "@/lib/article-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, {params}: {params: Promise<{id: string}>}) {
  const denied = await requireConsultation(request); if (denied) return denied;
  const {id} = await params;
  const key = request.nextUrl.searchParams.get("key") || "";
  const reply = (data: unknown, status = 200) => NextResponse.json(data, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
  if (!/^JUG\d{4}$/.test(id) || !/^[a-f0-9]{64}$/.test(key)) return reply({error: "Convocatoria no válida."}, 400);
  try {
    const source = (await readPlayerNews(id)).find(record => record.type === "seleccion" && record.published && record.selection && callupLinkKey({id: record.id, federation_id: record.selection.federation_id}) === key);
    const url = source?.url || (await publishedCallupSources(id)).get(key);
    if (!url && !source) return reply({summary: ""}, 404);
    const metadata = url ? await articleMetadata(url) : {title: "", summary: "", image: null};
    if (!source) return reply(metadata);
    const news = await newsWithImage(source);
    return reply({...metadata, title: source.title, summary: metadata.summary || source.selection?.notes || "", image: news.image_url || null, news});
  } catch {return reply({summary: ""});}
}
