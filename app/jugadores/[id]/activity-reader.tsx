"use client";
import Link from "@/app/components/sport-link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { CallupNewsCard } from "./callup-news-card";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";

type Selection = {source_key?: string; source_url?: string | null; federation_website?: string | null; federation_id: string; scope: string; category: string | null; format?: string | null; season_label: string | null; club_text: string | null; position_text: string | null};
type Data = {
  admin: boolean;
  player: {id: string; first_name: string; last_name: string | null};
  participation: {participation_count: number; participation_years: string[]; participation_campus?: Record<string, string>; participation_registration_numbers?: Record<string, string>; participation_pending_year?: boolean};
  campuses?: {id: string; label: string; siglas: string | null}[];
  selections: Selection[];
};

export function PlayerActivityReader({playerId, kind}: {playerId: string; kind: "participaciones" | "convocatorias"}) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [federation, setFederation] = useState("");
  const [back, setBack] = useState("/jugadores/" + encodeURIComponent(playerId));
  const isParticipation = kind === "participaciones";
  const title = isParticipation ? "Participaciones" : "Convocatorias";
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const selected = query.get("federacion") || "";
    setFederation(/^(FN|FT)\d{3}$/.test(selected) ? selected : "");
    try {
      const value = query.get("volver");
      if (value) {
        const url = new URL(value, window.location.origin);
        if (url.origin === window.location.origin && (/^\/(destacados|jugadores|seleccionados|hitos)$/.test(url.pathname) || /^\/jugadores\/(?:JUG\d{4}|destacados)$/.test(url.pathname))) setBack(url.pathname + url.search + url.hash);
      }
    } catch { /* Mantener la ficha como destino de cierre. */ }
    const controller = new AbortController();
    setError("");
    void fetch("/api/jugadores/" + encodeURIComponent(playerId), {cache: "no-store", signal: controller.signal})
      .then(async (response) => {const result = await response.json(); if (!response.ok) throw new Error(result.error || "No se ha podido cargar el jugador."); return result;})
      .then(setData).catch((reason) => {if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se ha podido cargar el jugador.");});
    return () => controller.abort();
  }, [playerId, attempt]);
  const name = data ? [data.player.first_name, data.player.last_name].filter(Boolean).join(" ") : playerId;
  const metric = data?.participation;
  const years = [...(metric?.participation_years || [])].sort((a, b) => Number(b) - Number(a));
  const pending = Math.max(0, (metric?.participation_count || 0) - years.length);
  const federations = [...new Map((data?.selections || []).map((item) => [item.federation_id, item.scope])).entries()];
  const selected = (data?.selections || []).filter((item) => !federation || item.federation_id === federation).slice().sort((a, b) => (b.season_label || "").localeCompare(a.season_label || "", "es", {numeric: true}));
  const close = <Link href={back} className="manager-close-news">Cerrar {kind}</Link>;
  return <main className="min-h-screen bg-neutral-50 text-neutral-900">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>{isParticipation ? "CTRUGBY - HUB" : "RUGBY - HUB"}</strong></span></Link><ManagerMenu current={isParticipation ? "participations" : "selectionCallups"} leadingAction={close} /></header>
    <section className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex items-center gap-4"><span className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100 text-2xl font-black text-neutral-400"><span aria-hidden="true">{name.slice(0, 1)}</span><img key={playerId} src={"/api/jugadores/foto/" + encodeURIComponent(playerId)} alt={"Foto destacada de " + name} width={80} height={80} className="absolute inset-0 h-full w-full object-cover" onError={(event) => {event.currentTarget.style.display = "none";}} /></span><div className="min-w-0"><h1 className="break-words text-2xl font-black sm:text-3xl">{name}</h1><p className="mt-2 text-sm text-neutral-600">{title} registradas</p></div></div>
      {error ? <div role="alert" className="rounded-xl border bg-white p-5"><p>{error}</p><button className="mt-3 font-bold text-red-700" type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></div> : !data ? <p role="status">Cargando {kind}…</p> : isParticipation ? <>
        <p className="mb-4 font-bold">{metric?.participation_count || 0} participaciones registradas</p>
        <div className="grid gap-4 sm:grid-cols-2">{years.map((year) => {
          const campusId = metric?.participation_campus?.[year] || "CAM001";
          const campus = data.campuses?.find((item) => item.id === campusId);
          const registration = metric?.participation_registration_numbers?.[year] || metric?.participation_registration_numbers?.[campusId + ":" + year];
          return <article key={year} className="flex items-start gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"><img src="/ctrugby-player-logo.png" alt="CTRugby" width={64} height={64} className="h-16 w-16 shrink-0 object-contain" /><div><h2 className="text-xl font-black">{year}</h2><p className="mt-1 font-bold">{campus?.label || campusId}</p>{campus?.siglas && <p className="text-sm text-neutral-500">{campus.siglas}</p>}{registration && <p className="mt-2 text-sm text-neutral-600">Registro: {registration}</p>}</div></article>;
        })}</div>
        {(pending > 0 || metric?.participation_pending_year) && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">{pending > 0 ? pending + " participación(es) pendiente(s) de identificar el año." : "Hay una edición pendiente de identificar."}</p>}
        {!years.length && !pending && !metric?.participation_pending_year && <p className="rounded-xl border bg-white p-5">Sin participaciones registradas.</p>}
      </> : <>
        <label className="mb-5 grid max-w-md gap-2 text-sm font-bold">Federación<select className="rounded-lg border border-neutral-300 bg-white p-3 font-normal" value={federation} onChange={(event) => setFederation(event.target.value)}><option value="">Todas las federaciones</option>{federations.map(([id, scope]) => <option key={id} value={id}>{scope} · {id}</option>)}{federation && !federations.some(([id]) => id === federation) && <option value={federation}>{federation}</option>}</select></label>
        <p className="mb-4 font-bold">{selected.length} convocatorias registradas</p>
        <div className="grid gap-4">{selected.map((item, index) => <CallupNewsCard key={item.source_key || [item.federation_id, item.season_label, index].join("-")} item={item} playerId={playerId} admin={data.admin} />)}</div>
        {!selected.length && <p className="rounded-xl border bg-white p-5">No hay convocatorias registradas{federation ? " para esta federación" : ""}.</p>}
      </>}
      <footer className="mt-8"><Link href={back} className="inline-flex min-h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 py-2 font-bold text-red-700">← Cerrar {kind} y volver</Link></footer>
    </section>
  </main>;
}
