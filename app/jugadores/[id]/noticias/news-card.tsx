"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { PlayerNews } from "@/lib/player-news";
import styles from "./reader.module.css";

export function NewsReaderCard({news}: {news: PlayerNews}) {
  const [summary, setSummary] = useState<string | null>(null);
  useEffect(() => {
    if (!news.url) {setSummary(news.selection?.notes || news.participation?.notes || ""); return;}
    const controller = new AbortController();
    void fetch("/api/noticias/" + encodeURIComponent(news.id) + "/vista-previa", {signal: controller.signal})
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => setSummary(data.summary || news.selection?.notes || news.participation?.notes || "")).catch(() => { if (!controller.signal.aborted) setSummary(""); });
    return () => controller.abort();
  }, [news.id, news.url, news.updated_at]);
  return <article className={styles.card}>
    <div className={styles.image}>{news.image_updated_at ? <Image unoptimized src={news.image_url ?? ("/api/noticias/" + news.id + "/imagen?v=" + encodeURIComponent(news.image_updated_at))} alt={news.title} width={420} height={320} /> : <span>Sin imagen</span>}</div>
    <div className={styles.content}>
      <p className={styles.meta}>{news.date_or_season} · {(news.url ? new URL(news.url).hostname : news.participation?.club_name || "Participación")}</p>
      <h2>{news.title}</h2>
      {news.type === "seleccion" && news.selection && <p className={styles.meta}>{["Convocatoria", news.selection.category, news.selection.format, news.selection.gender, news.selection.event].filter(Boolean).join(" · ")}</p>}
      {summary === null ? <p role="status" className={styles.meta}>Cargando resumen…</p> : <p className={styles.summary}>{summary || (news.type === "participacion" ? [news.participation?.category, news.participation?.club_name || "Club pendiente de indicar", news.participation?.club_category].filter(Boolean).join(" · ") : "La fuente no ofrece un resumen disponible. Puedes leer la noticia completa en su web.")}</p>}
      {news.url && <div className={styles.actions}>
        <a href={news.url} target="_blank" rel="noopener noreferrer" className={styles.primary}>Acceder a la web ↗</a>
      </div>}
      {news.url && <p className={styles.hint}>El enlace abre otra pestaña y conserva esta página.</p>}
    </div>
  </article>;
}
