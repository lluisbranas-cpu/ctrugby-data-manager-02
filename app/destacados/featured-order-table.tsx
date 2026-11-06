"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { useMemo, useState } from "react";
import { compareFeaturedPlayers, moveFeaturedPlayer, featuredMetrics, compareFeaturedPriority, type FeaturedMetricsPlayer } from "./featured-order";

type Player = FeaturedMetricsPlayer;
export function FeaturedOrderTable({ players, order, onSaved, defaultOpen = false }: { players: Player[]; order: string[]; onSaved: (ids: string[]) => void; defaultOpen?: boolean }) {
  const orderedIds = useMemo(() => {
    const positions = new Map(order.map((id, index) => [id, index]));
    return [...players].sort((a, b) => compareFeaturedPlayers(a, b, positions)).map((player) => player.id);
  }, [players, order]);
  const [pendingOrder, setDraft] = useState<string[] | null>(null);
  const draft = pendingOrder ?? orderedIds;
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const byId = new Map(players.map((player) => [player.id, player]));
  const dirty = draft.some((id, index) => id !== orderedIds[index]);
  async function save() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/destacados/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido guardar el orden.");
      setDraft(null); onSaved(data.order); setNotice("Orden guardado. Destacados ya se muestra en este orden.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar el orden."); }
    finally { setSaving(false); }
  }
  return <details open={defaultOpen} className="rounded-lg border border-neutral-200 bg-white p-4">
    <summary className="cursor-pointer text-sm font-black">Ordenar destacados ({players.length})</summary>
    <p className="my-3 text-sm text-neutral-600">Cambia el número para mover un jugador a esa posición. Los demás se reajustan automáticamente. La tabla incluye todos los destacados, aunque haya filtros activos.</p>
    <button type="button" disabled={saving} className="mb-3 rounded border border-neutral-300 px-3 py-2 text-sm font-bold disabled:opacity-50" onClick={() => { setDraft([...players].sort(compareFeaturedPriority).map((player) => player.id)); setNotice("Ordenado por nacionales, regionales, clubs, campus y noticias. Guarda para aplicarlo."); }}>Ordenar de mayor a menor por prioridad</button><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Orden de todos los jugadores destacados</caption><thead><tr className="border-b bg-neutral-50"><th scope="col" className="p-2">Orden</th><th scope="col" className="p-2">ID</th><th scope="col" className="p-2">Jugador</th>{["Nacionales", "Regionales", "Clubs", "Campus", "Noticias"].map((label) => <th key={label} scope="col" className="p-2 text-center">{label}</th>)}</tr></thead><tbody>{draft.map((id, index) => {
      const player = byId.get(id); if (!player) return null;
      const name = [player.first_name, player.last_name].filter(Boolean).join(" ");
      const metrics = featuredMetrics(player);
      return <tr key={id} className="border-b border-neutral-100"><td className="p-2"><input key={id + ":" + index} type="number" min={1} max={draft.length} step={1} defaultValue={index + 1} disabled={saving} aria-label={"Orden de " + name} className="w-20 rounded border border-neutral-300 p-2" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} onBlur={(event) => {
        const position = Number(event.currentTarget.value);
        if (!Number.isInteger(position) || position < 1 || position > draft.length) { event.currentTarget.value = String(index + 1); setNotice("Indica una posición entre 1 y " + draft.length + "."); return; }
        setDraft((current) => moveFeaturedPlayer(current ?? orderedIds, id, position)); setNotice("");
      }} /></td><td className="p-2 text-neutral-500">{id}</td><td className="p-2 font-bold"><Link href={"/jugadores/" + id} className="inline-flex items-center gap-3"><span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-500"><span aria-hidden="true">{player.first_name.slice(0, 1)}</span><img src={`/api/jugadores/foto/${id}`} alt={`Foto de ${name}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span><span>{name}</span></Link></td>{[metrics.national, metrics.regional, metrics.clubs, metrics.campus, metrics.news].map((value, index) => <td key={index} className="p-2 text-center tabular-nums">{value}</td>)}</tr>;
    })}</tbody></table></div>
    {!draft.length && <p className="my-3 text-sm">No hay jugadores destacados.</p>}
    <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={saving || !draft.length} onClick={() => void save()} className="rounded border border-red-700 bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar orden"}</button><button type="button" disabled={saving || !dirty} onClick={() => { setDraft(null); setNotice(""); }} className="rounded border border-neutral-300 px-4 py-2 text-sm disabled:opacity-50">Cancelar cambios</button>{dirty && <span className="text-xs text-neutral-500">Cambios pendientes de guardar</span>}</div>
    {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
  </details>;
}
