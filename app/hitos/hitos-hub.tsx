"use client";
import Link from "@/app/components/sport-link";
import { newsDateSortKey } from "@/app/lib/news-date";
import { useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type StaffHito = {id: string; participant_name: string; participant_kind: string; staff_id: string | null; season_label: string | null; scope: string | null; category: string | null; club_text: string | null; position_text: string | null; source_url: string | null};
type Data = {admin: boolean; milestones: StaffHito[]};
type Column = "participant_name" | "season_label" | "scope" | "category" | "club_text" | "position_text";
const columns: {key: Column; label: string}[] = [{key: "participant_name", label: "Staff"}, {key: "season_label", label: "Temporada"}, {key: "scope", label: "Ámbito"}, {key: "category", label: "Categoría / hito"}, {key: "club_text", label: "Club / entidad"}, {key: "position_text", label: "Cargo / posición"}];

export default function StaffHitosPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [staff, setStaff] = useState("");
  const [sort, setSort] = useState<{key: Column; direction: 1 | -1}>({key: "participant_name", direction: 1});
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hitos", {cache: "no-store", signal: controller.signal}).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se han podido cargar los hitos de staff.");
      return result as Data;
    }).then(setData).catch(reason => {if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se han podido cargar los hitos de staff.");});
    return () => controller.abort();
  }, []);
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const rows = useMemo(() => (data?.milestones ?? []).filter(row => row.participant_kind === "staff" && (!staff || (row.staff_id || row.participant_name) === staff) && (!query || normalize(columns.map(column => row[column.key] || "").join(" ")).includes(normalize(query)))).sort((a,b) => {
    const left = sort.key === "season_label" ? newsDateSortKey(a.season_label || "") : a[sort.key] || "";
    const right = sort.key === "season_label" ? newsDateSortKey(b.season_label || "") : b[sort.key] || "";
    if (sort.key === "season_label" && (!left || !right)) return left ? -1 : right ? 1 : a.id.localeCompare(b.id);
    return left.localeCompare(right, "es", {numeric: true, sensitivity: "base"}) * sort.direction || a.id.localeCompare(b.id);
  }), [data, staff, query, sort]);
  const people = [...new Map((data?.milestones ?? []).map(row => [row.staff_id || row.participant_name, row.participant_name])).entries()].sort((a,b) => a[1].localeCompare(b[1],"es"));
  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu current="milestones" /></header>
    <div className="catalog-shell"><section className="catalog-workspace"><div className="catalog-content">
      <h1 className="text-2xl font-black">Hitos staff</h1>
      <p className="mt-2 text-sm text-neutral-600">Hitos deportivos de los miembros del staff.</p>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {!data && !error && <p role="status" className="mt-4">Cargando hitos staff…</p>}
      {data?.admin && <>
        <div className="my-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-bold">Staff<select className="max-w-xs rounded border bg-white p-2 text-sm font-normal" value={staff} onChange={event => setStaff(event.target.value)}><option value="">Todo el staff</option>{people.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="grid gap-1 text-xs font-bold">Buscar<input className="rounded border p-2 text-sm font-normal" placeholder="Nombre, club, categoría…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <a href="/api/hitos/hoja" className="rounded border bg-white px-3 py-2 text-sm font-bold text-red-700">Descargar tabla</a>
        </div>
        <p className="mb-2 text-xs text-neutral-500">{rows.length} hitos de staff</p>
        <div className="overflow-x-auto rounded border border-neutral-200 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><caption className="sr-only">Hitos deportivos de staff</caption><thead className="bg-neutral-50 text-xs"><tr>{columns.map(column => <th key={column.key} scope="col" aria-sort={sort.key === column.key ? sort.direction === 1 ? "ascending" : "descending" : "none"} className="p-3"><button type="button" className="font-bold" onClick={() => setSort(current => ({key: column.key, direction: current.key === column.key && current.direction === 1 ? -1 : 1}))}>{column.label} <span aria-hidden="true">{sort.key === column.key ? sort.direction === 1 ? "↑" : "↓" : "↕"}</span></button></th>)}<th scope="col" className="p-3">Fuente</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-neutral-100">{columns.map(column => <td key={column.key} className="p-3 align-top">{row[column.key] || "—"}</td>)}<td className="p-3 align-top">{row.source_url && /^https?:\/\//i.test(row.source_url) ? <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="font-bold text-red-700">Ver fuente ↗</a> : "—"}</td></tr>)}</tbody></table></div>
        {!rows.length && <p className="mt-4 text-sm">No hay hitos de staff que coincidan con los filtros.</p>}
      </>}
    </div></section></div>
  </main>;
}
