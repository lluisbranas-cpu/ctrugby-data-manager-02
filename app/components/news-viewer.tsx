"use client";
import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import { ExternalLink, X } from "lucide-react";
import type { PlayerNews } from "@/lib/player-news";
import styles from "./news-viewer.module.css";

export function NewsViewer({ news, onClose }: { news: PlayerNews; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <div className={styles.layout}>
      <header className={styles.header}>
        {news.image_updated_at && <Image unoptimized src={news.image_url ?? ("/api/noticias/" + news.id + "/imagen?v=" + encodeURIComponent(news.image_updated_at))} alt={"Imagen destacada de " + news.title} width={180} height={100} className={styles.image} />}
        <div className={styles.copy}><small>{news.date_or_season} · {(news.url ? new URL(news.url).hostname : news.participation?.club_name || "Participación")}</small><h2 id={titleId}>{news.title}</h2></div>
        <button type="button" autoFocus onClick={onClose} className={styles.close} aria-label="Cerrar noticia" title="Cerrar noticia"><X size={22} /></button>
      </header>
      {news.url && <iframe className={styles.web} src={news.url} title={"Web de la noticia: " + news.title} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />}
      {news.url && <footer className={styles.footer}><span>Si la fuente bloquea la vista integrada, abre la noticia original.</span><a href={news.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Abrir original</a></footer>}
    </div>
  </dialog>;
}
