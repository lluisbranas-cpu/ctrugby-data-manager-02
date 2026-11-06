"use client";
import { useEffect, useState } from "react";
import type { PlayerNews } from "@/lib/player-news";
import { NewsReaderCard } from "./noticias/news-card";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import styles from "./noticias/reader.module.css";

type Selection = {source_key?: string; source_url?: string | null; federation_id: string; scope: string; category: string | null; format?: string | null; season_label: string | null; club_text: string | null; position_text: string | null; notes?: string | null};
type Article = {title: string; summary: string; image: string | null};

export function CallupNewsCard({item, playerId}: {item: Selection; playerId: string; admin: boolean}) {
  const url = item.source_url || "";
  const [news, setNews] = useState<PlayerNews | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [failedImage, setFailedImage] = useState("");
  useEffect(() => {
    setArticle(null); setNews(null);
    if (!item.source_key) {setArticle({title: "", summary: "", image: null}); return;}
    const controller = new AbortController();
    void fetch("/api/jugadores/" + encodeURIComponent(playerId) + "/convocatorias/resumen?key=" + encodeURIComponent(item.source_key), {signal: controller.signal, cache: "no-store"})
      .then(async response => {if (!response.ok) throw new Error(); return response.json();})
      .then(data => {setArticle(data); setNews(data.news || null);}).catch(() => {if (!controller.signal.aborted) setArticle({title: "", summary: "", image: null});});
    return () => controller.abort();
  }, [playerId, item.source_key, url]);
  const title = article?.title || item.notes || [item.scope, item.category, item.format].filter(Boolean).join(" · ");
  const image = article?.image && article.image !== failedImage ? article.image : null;
  const shield = federationShieldUrl(item.federation_id);
  if (news) return <NewsReaderCard news={news} />;
  return <article className={styles.card}>
    <div className={styles.image}>
      {image ? <img src={image} alt={title} width={420} height={320} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedImage(image)} /> : <div className="grid min-h-44 place-items-center gap-3 p-5 text-center">{shield && <img src={shield} alt={"Escudo de " + item.scope} width={96} height={96} className="max-h-24 !w-24 object-contain" />}<span className="text-sm">{article === null ? "Cargando imagen…" : "Sin imagen destacada"}</span></div>}
    </div>
    <div className={styles.content}>
      <p className={styles.meta}>{item.season_label || "Temporada sin indicar"} · {item.scope}</p>
      <h2>{title}</h2>
      <p className={styles.meta}>{[item.category, item.format, item.club_text, item.position_text && rugbyPositionLabel(item.position_text)].filter(Boolean).join(" · ")}</p>
      {article === null ? <p role="status" className={styles.meta}>Cargando resumen…</p> : <p className={styles.summary}>{article.summary || (url ? "La fuente no ofrece un resumen disponible. Puedes leer la noticia completa en su web." : "Añade el enlace original de la convocatoria para consultar su resumen.")}</p>}
      {url && <div className={styles.actions}><a href={url} target="_blank" rel="noopener noreferrer" className={styles.primary}>Acceder a la web ↗</a></div>}
      {url && <p className={styles.hint}>El enlace abre otra pestaña y conserva esta página.</p>}
    </div>
  </article>;
}
