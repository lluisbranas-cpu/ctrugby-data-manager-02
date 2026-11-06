"use client";
import Link from "@/app/components/sport-link";
import Image from "next/image";
import { ManagerMenu } from "@/app/components/manager-menu";
import { NewsReaderCard } from "./news-card";
import { useEffect, useState } from "react";
import type { PlayerNews } from "@/lib/player-news";

export function PlayerNewsReader({ playerId }: { playerId: string }) {
  const [news, setNews] = useState<PlayerNews[] | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [back, setBack] = useState("/jugadores/" + encodeURIComponent(playerId));
  const [admin, setAdmin] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("volver");
    if (target) {
      const url = new URL(target, window.location.origin);
      if (url.origin === window.location.origin && (/^\/(destacados|jugadores|seleccionados|hitos)$/.test(url.pathname) || /^\/jugadores\/(?:JUG\d{4}|destacados)$/.test(url.pathname))) setBack(url.pathname + url.search + url.hash);
    }
    const controller = new AbortController();
    setError("");
    void fetch("/api/noticias?player_id=" + encodeURIComponent(playerId), {cache: "no-store", signal: controller.signal})
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se han podido cargar las noticias."); return data; })
      .then((data) => {
        setNews(data.news.filter((item: PlayerNews) => item.published && item.type === "noticia" && item.player_id === playerId));
        setName(data.players?.find((player: {id: string; name: string}) => player.id === playerId)?.name || "");
        setAdmin(data.admin === true);
      }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se han podido cargar las noticias."); });
    return () => controller.abort();
  }, [playerId, attempt]);
  const returnLink = <Link href={back} className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 font-bold text-red-700">← Volver al listado o ficha</Link>;
  return <main className="min-h-screen bg-neutral-50 text-neutral-900">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="news" leadingAction={<Link href={back} className="manager-close-news">Cerrar noticias</Link>} /></header>
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex items-center gap-4">
        <span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-2xl font-black text-neutral-400">
          <span aria-hidden="true">{name ? name.slice(0, 1).toUpperCase() : "J"}</span>
          <img key={playerId} src={"/api/jugadores/foto/" + encodeURIComponent(playerId)} alt={"Foto destacada de " + (name || playerId)} width={80} height={80} className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-black sm:text-3xl">{name || playerId}</h1>
          <p className="mt-2 text-sm text-neutral-600">Noticias publicadas</p>
        </div>
      </div>
      {error ? <div role="alert" className="rounded-xl border bg-white p-5"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-3 font-bold text-red-700">Reintentar</button></div> : news === null ? <p role="status">Cargando noticias…</p> : !news.length ? <p className="rounded-xl border bg-white p-6">Todavía no hay noticias publicadas de este jugador.</p> : <div className="grid gap-6">{news.map((item) => <NewsReaderCard key={item.id} news={item} />)}</div>}
      <footer className="mt-8 flex flex-wrap items-center gap-4">{returnLink}{admin && <Link href={"/noticias?jugador=" + encodeURIComponent(playerId)} className="font-bold text-red-700">Gestionar noticias</Link>}</footer>
    </section>
  </main>;
}
