"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";
import { SearchablePicker } from "@/app/components/club-picker";

type Row = { id: string; clubId: string; category: string; phases: string[] };
type Club = { id: string; name: string; city?: string };
type SortKey = "club" | "category" | "phase";
export default function CompetitionPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [phaseText, setPhaseText] = useState("");
  const [deleted, setDeleted] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; direction: number }>({ key: "category", direction: 1 });
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetch("/api/convocatorias/competicion", { cache: "no-store", signal: controller.signal }), fetch("/api/clubs", { cache: "no-store", signal: controller.signal })])
      .then(async ([competition, catalog]) => { if (!competition.ok || !catalog.ok) throw new Error("No se ha podido cargar la competición."); return [await competition.json(), await catalog.json()]; })
      .then(([competition, catalog]) => { setRows(competition.rows); setAdmin(competition.admin); setClubs(catalog.clubs); setLoading(false); })
      .catch(error => { if (!controller.signal.aborted) { setNotice(error.message); setLoading(false); } });
    return () => controller.abort();
  }, []);
  const clubById = useMemo(() => new Map(clubs.map(club => [club.id, club])), [clubs]);
  const clubName = (clubId: string) => clubById.get(clubId)?.name === "CORNEBUC" ? "Cornebuc" : clubById.get(clubId)?.name ?? clubId;
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const value = (row: Row) => sort.key === "club" ? clubById.get(row.clubId)?.name ?? row.clubId : sort.key === "category" ? row.category : row.phases.join(" · ");
    return sort.direction * value(a).localeCompare(value(b), "es", { numeric: true, sensitivity: "base" });
  }), [rows, sort, clubById]);
  function start(row: Row) { setEditing({ ...row }); setPhaseText(row.phases.join("\n")); setNotice(""); }
  async function save() {
    if (!editing) return;
    if (!editing.clubId || !editing.category.trim()) { setNotice("Selecciona un club e indica su categoría."); return; }
    setSaving(true); setNotice("");
    try {
      const row = { ...editing, category: editing.category.trim(), phases: [...new Set(phaseText.split("\n").map(value => value.trim()).filter(Boolean))] };
      const response = await fetch("/api/convocatorias/competicion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se ha podido guardar.");
      setRows(data.rows); setEditing(null); setNotice("Fila guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar."); } finally { setSaving(false); }
  }
  async function removeRow(row: Row) {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/convocatorias/competicion", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se ha podido eliminar la fila.");
      setRows(data.rows); setDeleted(row); setNotice("Fila eliminada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la fila."); } finally { setSaving(false); }
  }
  async function undoDelete() {
    if (!deleted) return;
    setSaving(true);
    try {
      const response = await fetch("/api/convocatorias/competicion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deleted) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se ha podido recuperar la fila.");
      setRows(data.rows); setDeleted(null); setNotice("Fila recuperada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido recuperar la fila."); } finally { setSaving(false); }
  }
  function sortColumn(key: SortKey) { setSort(old => ({ key, direction: old.key === key ? -old.direction : 1 })); }
  const headers: [SortKey, string][] = [["club", "Club"], ["category", "Categoría"], ["phase", "Fase"]];
  function editor() {
    if (!editing) return null;
    return <tr className="border-t bg-red-50/40"><td className="p-4 align-top"><SearchablePicker options={clubs.map(club => ({ id: club.id, name: club.name + (club.city ? ` · ${club.city}` : "") }))} value={editing.clubId} onChange={clubId => setEditing({ ...editing, clubId })} label="Club" placeholder="Buscar club…" emptyLabel="Selecciona un club" inputClass="w-full min-w-44 rounded-lg border bg-white p-2 text-sm" /></td><td className="p-4 align-top"><label className="grid gap-1 text-xs font-bold">Categoría<input autoFocus disabled={saving} className="w-full min-w-24 rounded-lg border bg-white p-2 text-sm" value={editing.category} maxLength={80} onChange={event => setEditing({ ...editing, category: event.target.value })} placeholder="S16-B" /></label></td><td className="p-4 align-top"><label className="grid gap-1 text-xs font-bold">Fase · una por línea<textarea disabled={saving} className="w-full min-w-44 rounded-lg border bg-white p-2 text-sm" rows={3} value={phaseText} onChange={event => setPhaseText(event.target.value)} placeholder="Fase previa F" /></label></td><td className="p-4 align-top"><div className="grid gap-2"><button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-red-700 px-3 py-2 font-bold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button><button type="button" disabled={saving} onClick={() => { setEditing(null); setNotice(""); }} className="rounded-lg border bg-white px-3 py-2 font-bold">Cancelar</button></div></td></tr>;
  }
  return <main className="min-h-screen bg-neutral-100 text-neutral-900" style={{ paddingTop: 72 }}>
    <header className="catalog-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 80 }}><Link href="/" className="catalog-brand" aria-label="LIKID Sport Hub, inicio"><span>LIKID</span></Link><div className="ml-auto"><ManagerMenu current="callupsApp" /></div></header>
    <div className="mx-auto max-w-5xl p-5 sm:p-8"><header className="mb-6"><p className="text-xs font-black tracking-widest text-red-700">APP CONVOCATORIAS</p><h1 className="text-2xl font-black">Tabla competición</h1><p className="mt-1 text-sm text-neutral-600">Clubs, categorías y fases de la temporada 2026/27.</p></header>
    <nav className="mb-5 flex flex-wrap gap-2"><Link className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white" href="/convocatorias">Competición</Link><Link className="rounded-lg border bg-white px-4 py-2 text-sm font-bold" href="/convocatorias/lista">Convocatorias</Link></nav>
    {notice && <p role="status" className="mb-4 rounded-lg border bg-white p-3 text-sm">{notice}{deleted && <button type="button" disabled={saving} onClick={() => void undoDelete()} className="ml-3 font-bold text-red-700 underline disabled:opacity-50">Deshacer eliminación</button>}</p>}
    <section className="rounded-2xl border bg-white shadow-sm"><header className="flex flex-wrap items-center gap-3 border-b px-5 py-4"><b>TABLA COMPETICIÓN</b><small className="text-neutral-500">{rows.length} equipos</small>{admin && <button type="button" disabled={!!editing || loading || saving} onClick={() => start({ id: crypto.randomUUID(), clubId: "", category: "", phases: [] })} className="ml-auto rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">+ Añadir club</button>}</header>
    <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500"><tr>{headers.map(([key, label]) => <th key={key} className="p-4" scope="col" aria-sort={sort.key === key ? sort.direction === 1 ? "ascending" : "descending" : "none"}><button type="button" className="font-bold" onClick={() => sortColumn(key)}>{label} {sort.key === key ? sort.direction === 1 ? "↑" : "↓" : "↕"}</button></th>)}{admin && <th scope="col" className="p-4">Acciones</th>}</tr></thead>
    <tbody>{loading ? <tr><td colSpan={admin ? 4 : 3} className="p-6">Cargando competición…</td></tr> : sorted.map(row => editing?.id === row.id ? <EditingRow key={row.id}>{editor()}</EditingRow> : <tr className="border-t" key={row.id}><td className="p-4"><Link href={`/clubs/${row.clubId}`} aria-label={`Ver ${clubName(row.clubId)}`} className="flex items-center gap-3 font-bold hover:text-red-700"><img src={`/api/clubs/escudo/${encodeURIComponent(row.clubId)}`} alt={clubName(row.clubId)} title={clubName(row.clubId)} className="h-12 w-12 object-contain" /><span>{clubName(row.clubId)}</span></Link></td><td className="p-4"><span className="rounded-full bg-red-50 px-3 py-1 font-black text-red-700">{row.category}</span></td><td className="p-4">{row.phases.length ? <ul className="grid gap-1">{row.phases.map(phase => <li key={phase}>{phase}</li>)}</ul> : "Pendiente de definir"}</td>{admin && <td className="p-4"><button type="button" disabled={!!editing || saving} onClick={() => start(row)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50" aria-label={`Editar ${clubName(row.clubId)} ${row.category}`}>Editar</button><button type="button" disabled={!!editing || saving} onClick={() => void removeRow(row)} aria-label={`Eliminar ${clubName(row.clubId)} ${row.category}`} title="Eliminar fila" className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-xl font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">×</button></td>}</tr>)}{editing && !rows.some(row => row.id === editing.id) && editor()}</tbody></table></div></section></div>
  </main>;
}
function EditingRow({ children }: { children: React.ReactNode }) { return children; }
