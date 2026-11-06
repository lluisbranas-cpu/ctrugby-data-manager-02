"use client";
import Link from "@/app/components/sport-link";
import { usePathname } from "@/lib/sport-navigation";
import { Newspaper } from "lucide-react";
import { useEffect, useState } from "react";
import type { PlayerNews } from "@/lib/player-news";

export function PlayerNewsPanel({ playerId, initialNews, subjectLabel = "Noticias del jugador" }: { playerId: string; admin: boolean; initialNews?: PlayerNews[]; subjectLabel?: string }) {
  const pathname = usePathname();
  const [news, setNews] = useState<PlayerNews[] | null>(initialNews ?? null);
  useEffect(() => {
    if (!playerId || initialNews !== undefined) return;
    const controller = new AbortController();
    void fetch("/api/noticias?player_id=" + encodeURIComponent(playerId), { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => setNews(data.news)).catch(() => {});
    return () => controller.abort();
  }, [initialNews, playerId]);
  const published = !playerId ? [] : (initialNews ?? news)?.filter((item) => item.published && item.type === "noticia" && item.player_id === playerId);
  return <section id={"player-news-" + playerId} className="mt-4 w-full min-w-0 border-t border-neutral-200 pt-3" aria-label={subjectLabel}>
    <h3 className="mb-2 text-center text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">NOTICIAS</h3>
    {playerId ? <Link href={"/jugadores/" + encodeURIComponent(playerId) + "/noticias?volver=" + encodeURIComponent(pathname + "#player-news-" + playerId)} className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold shadow-sm" aria-label="Ver noticias publicadas">
      <Newspaper size={18} aria-hidden="true" className="shrink-0 text-red-600" /><b className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-white">{published ? published.length : "…"}</b><span>Ver</span>
    </Link> : <button type="button" disabled title="Sin ficha de jugador vinculada" className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-xs font-bold text-neutral-400"><Newspaper size={18} aria-hidden="true" /><b className="flex h-6 min-w-6 items-center justify-center rounded-full bg-neutral-300 px-1 text-white">0</b><span>Ver</span></button>}
  </section>;
}
