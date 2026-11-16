"use client";

import Link from "next/link";
import { useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type Competition = { id: string; phase: string; competition: string; categories: string; detail: string; originalId?: string };
const storageKey = "fcr-competitions-v1";
const federation = { id: "FCR", name: "Federació Catalana de Rugby" };
const initialRows: Competition[] = [
  { id: "FCR-TRB-CLUBS", phase: "Trobades · clubs", competition: "Trobades de clubs", categories: "S6, S8, S10 y S12", detail: "Trobades organizadas por clubs." },
  { id: "FCR-TRB-CATEGORIA", phase: "Trobades · categoria", competition: "Trobades de categoría", categories: "S6, S8, S10 y S12", detail: "Trobades agrupadas por categoría deportiva." },
  { id: "FCR-TRB-FEMENINA", phase: "Trobades · femenina", competition: "Trobades femeninas", categories: "S6, S8, S10 y S12", detail: "Trobades de juego exclusivamente femenino." },
  { id: "FCR-TRB-XARXA", phase: "Trobades · xarxa", competition: "Trobades de xarxa", categories: "S6, S8, S10 y S12", detail: "Trobades de red entre escuelas y clubs." },
  { id: "FCR-TRB-FINAL-CATALUNYA", phase: "Trobades · final Catalunya", competition: "Trobada d'Escoles de Rugby de Catalunya", categories: "S6, S8, S10 y S12", detail: "Trobada final catalana de escuelas." },
  { id: "FCR-LIG-FORM-PREV", phase: "Liga formativa · previa", competition: "Fase previa", categories: "S14 mixto, S16 y S18", detail: "Fase inicial de las competiciones formativas." },
  { id: "FCR-LIG-FORM-LIGA", phase: "Liga formativa · liga", competition: "Liga regular", categories: "S14 mixto, S16 y S18", detail: "Liga regular de las competiciones formativas." },
  { id: "FCR-LIG-FORM-FINAL", phase: "Liga formativa · finales", competition: "Finales", categories: "S14 mixto, S16 y S18", detail: "Eliminatorias y finales de las competiciones formativas." },
  { id: "FCR-LIG-SEN", phase: "Liga sénior", competition: "Ligas sénior FCR", categories: "Masculina y femenina", detail: "Liga regular con los grupos y calendario de la temporada." },
  { id: "FCR-COPA", phase: "Copa", competition: "Copa Catalana", categories: "Categorías que determine la temporada", detail: "Competición de copa integrada en el calendario FCR." },
];
const empty = (): Competition => ({ id: "", phase: "", competition: "", categories: "", detail: "" });

export default function FcrCompetitionsPage() {
  const [rows, setRows] = useState<Competition[]>(() => {
    if (typeof window === "undefined") return initialRows;
    try { const saved = window.localStorage.getItem(storageKey); return saved ? JSON.parse(saved) as Competition[] : initialRows; }
    catch { return initialRows; }
  });
  const [editing, setEditing] = useState<Competition | null>(null);
  const [notice, setNotice] = useState(`ID Federación: ${federation.id} · ${federation.name}`);

  const persist = (next: Competition[]) => { setRows(next); window.localStorage.setItem(storageKey, JSON.stringify(next)); };
  const save = () => {
    if (!editing || !editing.id.trim() || !editing.phase.trim() || !editing.competition.trim()) { setNotice("Completa ID, fase y competición."); return; }
    const originalId = editing.originalId || editing.id;
    if (rows.some(row => row.id === editing.id && row.id !== originalId)) { setNotice("El ID ya existe."); return; }
    const saved = { ...editing }; delete saved.originalId;
    persist(rows.some(row => row.id === originalId) ? rows.map(row => row.id === originalId ? saved : row) : [...rows, saved]);
    setEditing(null); setNotice("Fila guardada.");
  };
  const remove = (id: string) => { persist(rows.filter(row => row.id !== id)); setNotice("Fila eliminada."); };

  return <main className="catalog-app min-h-screen"><header className="catalog-header"><Link href="/jugadores" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu /></header><section className="mx-auto max-w-7xl px-5 py-10"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Convocatoria partidos</p><div className="mt-2 flex flex-wrap items-center gap-3"><div><h1 className="text-3xl font-black tracking-tight text-slate-900">Fases y competiciones FCR</h1><p className="mt-2 max-w-3xl text-slate-600">Competiciones organizadas por la Federació Catalana de Rugby (FCR).</p></div><button type="button" onClick={() => { setEditing(empty()); setNotice(""); }} className="ml-auto rounded-lg bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800">+ Añadir</button></div>{notice && <p role="status" className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">{notice}</p>}<div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[980px] text-left text-sm"><caption className="sr-only">Fases y competiciones de la FCR</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">ID</th><th className="px-5 py-4">Fase</th><th className="px-5 py-4">Competición</th><th className="px-5 py-4">Categorías</th><th className="px-5 py-4">Descripción</th><th className="px-5 py-4"><span className="sr-only">Acciones</span></th></tr></thead><tbody>{editing && !rows.some(row => row.id === editing.id) && <Editor row={editing} setRow={setEditing} onSave={save} onCancel={() => setEditing(null)} />}{rows.map(row => editing?.id === row.id ? <Editor key={row.id} row={editing} setRow={setEditing} onSave={save} onCancel={() => setEditing(null)} /> : <tr key={row.id} className="border-t border-slate-200 align-top"><td className="px-5 py-4 font-mono text-xs text-slate-600">{row.id}</td><th scope="row" className="px-5 py-4 font-bold text-slate-900">{row.phase}</th><td className="px-5 py-4 font-semibold text-slate-800">{row.competition}</td><td className="px-5 py-4 text-slate-700">{row.categories}</td><td className="px-5 py-4 text-slate-600">{row.detail}</td><td className="px-5 py-4"><div className="flex gap-2"><button type="button" onClick={() => { setEditing(row); setNotice(""); }} className="rounded border px-2 py-1 text-lg leading-none hover:border-sky-700" aria-label={`Editar ${row.competition}`} title="Editar">✎</button><button type="button" onClick={() => remove(row.id)} className="rounded border border-red-200 px-2 py-1 text-lg leading-none text-red-700 hover:bg-red-50" aria-label={`Eliminar ${row.competition}`} title="Eliminar">🗑</button></div></td></tr>)}</tbody></table></div><p className="mt-4 text-xs text-slate-500">Los cambios se guardan en este navegador.</p></section></main>;
}

function Editor({ row, setRow, onSave, onCancel, newRow = true }: { row: Competition; setRow: (row: Competition) => void; onSave: () => void; onCancel: () => void; newRow?: boolean }) {
  const field = (name: keyof Competition, value: string) => setRow({ ...row, [name]: value, ...(name === "id" && row.id !== value && !row.originalId ? { originalId: row.id } : {}) });
  return <tr className="border-t border-sky-200 bg-sky-50 align-top"><td className="p-3"><input aria-label="ID" readOnly={!newRow} className="w-full rounded border p-2 font-mono text-xs read-only:bg-neutral-100" value={row.id} onChange={event => field("id", event.target.value)} placeholder="FCR-…" /></td><td className="p-3"><input aria-label="Fase" className="w-full rounded border p-2" value={row.phase} onChange={event => field("phase", event.target.value)} /></td><td className="p-3"><input aria-label="Competición" className="w-full rounded border p-2" value={row.competition} onChange={event => field("competition", event.target.value)} /></td><td className="p-3"><input aria-label="Categorías" className="w-full rounded border p-2" value={row.categories} onChange={event => field("categories", event.target.value)} /></td><td className="p-3"><textarea aria-label="Descripción" className="w-full rounded border p-2" rows={2} value={row.detail} onChange={event => field("detail", event.target.value)} /></td><td className="p-3"><div className="flex flex-col gap-2"><button type="button" onClick={onSave} className="rounded bg-sky-700 px-3 py-2 text-sm font-bold text-white">Guardar</button><button type="button" onClick={onCancel} className="rounded border px-3 py-2 text-sm font-bold">Cancelar</button></div></td></tr>;
}
