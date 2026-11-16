"use client";

import Link from "next/link";
import { useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

const tables = [
  ["Etapas", "", "stages"],
  ["Categorías", "", "categories"],
  ["Fases", "", "phases"],
  ["Grupos", ""],
  ["Equipos", ""],
  ["Entrenadores y delegados", ""],
  ["Verificar combinaciones", "", "seasons"],
] as const;

const categories = [["CAT-S06", "S6"], ["CAT-S08", "S8"], ["CAT-S10", "S10"], ["CAT-S12", "S12"], ["CAT-S14", "S14"], ["CAT-S16", "S16"], ["CAT-S17", "S17"], ["CAT-S18", "S18"], ["CAT-S20", "S20"], ["CAT-S23", "S23"], ["CAT-SEN", "Sénior"], ["CAT-COMP", "Competiciones"]];

const stages = [
  ["ETP-ESC", "Escuela", "S6, S8, S10 y S12", "Etapa de iniciación y trobades de escuelas."],
  ["ETP-FORM", "Formación", "S14, S16 y S18", "Etapa de desarrollo con fases previa, liga y finales."],
  ["ETP-SEN-M", "Sénior masculino", "Sénior", "Competiciones sénior masculinas de la FCR."],
  ["ETP-SEN-F", "Sénior femenino", "Sénior", "Competiciones sénior femeninas de la FCR."],
];

const seasons = ["26/27", "25/26", "24/25"];
type Combination = [string, string, string] & { id: string; stage: string; category: string; phase: string; competition: string };
const combination = (stage: string, category: string, phase: string, competition: string) => {
  const id = `FCR-${stage}-${category}-${phase}-${competition}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase();
  return Object.assign([stage, category, phase] as [string, string, string], { id, stage, category, phase, competition });
};
const seasonCombinations: Combination[] = [
  ...["S6", "S8", "S10", "S12"].flatMap(category => ["clubs", "categoria", "femenina", "xarxa", "final_catalunya"].map(phase => combination("Escuela", category, phase, "Trobades d'Escoles"))),
  ...["S14", "S16", "S18"].flatMap(category => ["previa", "liga", "finales"].map(phase => combination("Formación", category, phase, "Lliga / Campionat de Catalunya"))),
  ...["S14"].map(category => combination("Formación", category, "copa", "Copa Catalana a 10")),
  ...["S16", "S18"].flatMap(category => ["copa", "ranking"].map(phase => combination("Formación", category, phase, phase === "copa" ? "Copa Catalana de rugby a VII" : "Rànquing"))),
  ...["S16", "S18"].map(category => combination("Formación", category, "campeonato_espana", "CESA · Campeonato de España de Selecciones Autonómicas")),
  combination("Formación", "S17 femenina", "campeonato_espana", "CESA · Campeonato de España de Selecciones Autonómicas"),
  ...["Sénior"].flatMap(category => ["liga", "copa"].map(phase => combination("Sénior masculino", category, phase, phase === "liga" ? "Ligas sénior FCR" : "Copa Catalana"))),
  ...["Sénior"].flatMap(category => ["liga", "copa"].map(phase => combination("Sénior femenino", category, phase, phase === "liga" ? "Ligas sénior FCR" : "Copa Catalana"))),
];

const phases = [
  ["TRB-MANRESA-2627", "Trobades · clubs", "Trobada Manresa 2026/27 · 07/11/2026 · Anfitrión: Manresa RC", "GRP-MANRESA-2627 · Alella, Badalona, L'Hospitalet, Berguedà, Osona y Manresa"],
  ["TRB-CLUBS", "Trobades · clubs", "Trobades de clubs", "S6, S8, S10 y S12"],
  ["TRB-CATEGORIA", "Trobades · categoria", "Trobades de categoría", "S6, S8, S10 y S12"],
  ["TRB-FEMENINA", "Trobades · femenina", "Trobades femeninas", "S6, S8, S10 y S12"],
  ["TRB-XARXA", "Trobades · xarxa", "Trobades de xarxa", "S6, S8, S10 y S12"],
  ["TRB-FINAL-CATALUNYA", "Trobades · final Catalunya", "Trobada d'Escoles de Rugby de Catalunya", "S6, S8, S10 y S12"],
  ["LIG-FORM-PREV", "Liga formativa · previa", "Fase previa", "S14 mixto, S16 y S18"],
  ["LIG-FORM-LIGA", "Liga formativa · liga", "Liga regular", "S14 mixto, S16 y S18"],
  ["LIG-FORM-FINAL", "Liga formativa · finales", "Finales", "S14 mixto, S16 y S18"],
  ["LIG-SEN", "Liga sénior", "Ligas sénior FCR", "Masculina y femenina"],
  ["COPA", "Copa", "Copa Catalana", "Según la temporada"],
];

const meetings2526 = [
  ["FCR-TRB-25-26-CLUB", "Trobades d'escoles por clubs", "Inicio de temporada", "Manresa, Sant Cugat, Castelldefels, Cornellà, Cabrera, Girona y Granollers", "S6, S8, S10 y S12", "Realizada"],
  ["FCR-TRB-25-26-FEM-01", "Trobada d'escoles femenina", "14/02/2026", "La Guinardera · Sant Cugat", "S6 a S12", "Realizada"],
  ["FCR-TRB-25-26-FEM-02", "Trobada d'escoles femenina", "22/03/2026", "Sede no detallada en la publicación consultada", "S6 a S12", "Programada por la FCR"],
  ["FCR-TRB-25-26-CAT", "Trobada d'Escoles de Rugby de Catalunya", "10/05/2026", "Vic · Osona RC", "S6, S8, S10 y S12, con encuentro femenino", "Realizada"],
];

type TableKey = "categories" | "phases" | "meetings" | "stages" | "seasons";

function CardTable({ table, title, children }: { table: TableKey; title: string; children?: React.ReactNode }) {
  return <section id={`${table}-fcr-table`} className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><header className="border-b border-slate-200 bg-slate-50 px-5 py-4"><h2 className="font-black text-slate-900">{title}</h2></header>{table === "seasons" ? <CombinationVerifier /> : table === "stages" ? <StageEditor /> : table === "categories" ? <CategoryEditor /> : table === "phases" ? <PhaseEditor /> : children}</section>;
}

function CombinationVerifier() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setChecked(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <table className="w-full min-w-[900px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Etapa</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Fase</th><th className="px-4 py-3">Verificar</th></tr></thead><tbody>{seasonCombinations.map(row => <tr key={row.id} className="border-t border-slate-200"><td className="px-4 py-3 font-mono text-xs">{row.id}</td><td className="px-4 py-3">{row.stage}</td><td className="px-4 py-3">{row.category}</td><td className="px-4 py-3">{row.phase}</td><td className="px-4 py-3"><button type="button" onClick={() => toggle(row.id)} className={checked.has(row.id) ? "text-xl text-red-700" : "text-xl text-green-700"} aria-label="Cambiar verificación">{checked.has(row.id) ? "✕" : "✓"}</button></td></tr>)}</tbody></table>;
}

function CategoryEditor() {
  const [rows, setRows] = useState(categories);
  const update = (index: number, field: number, value: string) => setRows(rows.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === field ? value : cell) : row));
  return <table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Categoría</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row[0]} className="border-t border-slate-200"><td className="p-2"><input className="w-full rounded border p-2 font-mono text-xs" value={row[0]} onChange={event => update(index, 0, event.target.value)} /></td><td className="p-2"><input className="w-full rounded border p-2" value={row[1]} onChange={event => update(index, 1, event.target.value)} /></td><td className="p-2"><button type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded border border-red-200 px-2 py-1 text-red-700" aria-label={`Eliminar ${row[1]}`}>🗑</button></td></tr>)}</tbody></table>;
}

function PhaseEditor() {
  const [rows, setRows] = useState(phases);
  const update = (index: number, field: number, value: string) => setRows(rows.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === field ? value : cell) : row));
  return <table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Fase</th><th className="px-4 py-3">Competición</th><th className="px-4 py-3">Categorías</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row[0]} className="border-t border-slate-200">{row.map((cell, field) => <td key={field} className="p-2"><input className={`w-full rounded border p-2 ${field === 0 ? "font-mono text-xs" : ""}`} value={cell} onChange={event => update(index, field, event.target.value)} /></td>)}<td className="p-2"><button type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded border border-red-200 px-2 py-1 text-red-700" aria-label={`Eliminar ${row[1]}`}>🗑</button></td></tr>)}</tbody></table>;
}

function StageEditor() {
  const [rows, setRows] = useState(stages);
  const update = (index: number, field: number, value: string) => setRows(rows.map((row, rowIndex) => rowIndex === index ? row.map((cell, cellIndex) => cellIndex === field ? value : cell) : row));
  return <table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">Etapas editables de la FCR</caption><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Etapa</th><th className="px-4 py-3">Categorías</th><th className="px-4 py-3">Descripción</th><th className="px-4 py-3">Acciones</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row[0]} className="border-t border-slate-200"><td className="p-2"><input className="w-full rounded border p-2 font-mono text-xs" value={row[0]} onChange={event => update(index, 0, event.target.value)} /></td><td className="p-2"><input className="w-full rounded border p-2" value={row[1]} onChange={event => update(index, 1, event.target.value)} /></td><td className="p-2"><input className="w-full rounded border p-2" value={row[2]} onChange={event => update(index, 2, event.target.value)} /></td><td className="p-2"><input className="w-full rounded border p-2" value={row[3]} onChange={event => update(index, 3, event.target.value)} /></td><td className="p-2"><button type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} className="rounded border border-red-200 px-2 py-1 text-red-700" aria-label={`Eliminar ${row[1]}`}>🗑</button></td></tr>)}</tbody></table>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SeasonFilters() {
  const [season, setSeason] = useState(seasons[0]);
  const [stage, setStage] = useState("");
  const [category, setCategory] = useState("");
  const [phase, setPhase] = useState("");
  const rows = seasonCombinations.filter(([rowStage, rowCategory, rowPhase]) => (!stage || rowStage === stage) && (!category || rowCategory === category) && (!phase || rowPhase === phase));
  const options = (index: number) => [...new Set(seasonCombinations.map(row => row[index]))];
  const selectClass = "mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal";
  return <table className="w-full min-w-[800px] text-left text-sm"><caption className="sr-only">Combinaciones disponibles por temporada</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Temporada<select aria-label="Filtrar por temporada" className={selectClass} value={season} onChange={event => setSeason(event.target.value)}>{seasons.map(value => <option key={value} value={value}>{value}</option>)}</select></th><th className="px-4 py-3">Etapa<select aria-label="Filtrar por etapa" className={selectClass} value={stage} onChange={event => setStage(event.target.value)}><option value="">Todas</option>{options(0).map(value => <option key={value} value={value}>{value}</option>)}</select></th><th className="px-4 py-3">Categoría<select aria-label="Filtrar por categoría" className={selectClass} value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas</option>{options(1).map(value => <option key={value} value={value}>{value}</option>)}</select></th><th className="px-4 py-3">Fase<select aria-label="Filtrar por fase" className={selectClass} value={phase} onChange={event => setPhase(event.target.value)}><option value="">Todas</option>{options(2).map(value => <option key={value} value={value}>{value}</option>)}</select></th></tr></thead><tbody>{rows.map(([rowStage, rowCategory, rowPhase]) => <tr key={`${season}-${rowStage}-${rowCategory}-${rowPhase}`} className="border-t border-slate-200"><td className="px-4 py-3 font-mono text-slate-600">{season}</td><td className="px-4 py-3 font-bold text-slate-900">{rowStage}</td><td className="px-4 py-3 text-slate-700">{rowCategory}</td><td className="px-4 py-3 text-slate-700">{rowPhase}</td></tr>)}{!rows.length && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No hay combinaciones con esos filtros.</td></tr>}</tbody></table>;
}

// Legacy markup retained while the compact federation selector is introduced below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FederationFinderLegacy() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ id: string; name: string; scope: string; territory: string }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const search = async (value: string) => {
    setQuery(value); setSelected(null);
    if (value.trim().length < 2) { setResults([]); return; }
    try { const response = await fetch("/api/federaciones", { cache: "no-store" }); const data = await response.json(); const needle = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); setResults((data.federations ?? []).filter((item: { id: string; name: string }) => `${item.id} ${item.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle)).slice(0, 8)); } catch { setResults([]); }
  };
  return <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5"><label className="block text-sm font-black text-slate-900">Buscador inteligente de federaciones<input value={query} onChange={event => void search(event.target.value)} placeholder="Busca por ID o nombre: FCR, Catalana…" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>{selected && <p className="mt-3 rounded bg-white px-3 py-2 text-sm font-bold">Seleccionada: {selected.id} · {selected.name}</p>}{!selected && results.length > 0 && <ul className="mt-3 overflow-hidden rounded-lg border bg-white">{results.map(item => <li key={item.id}><button type="button" onClick={() => { setSelected(item); setQuery(`${item.id} · ${item.name}`); setResults([]); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sky-100"><span><b>{item.id}</b> · {item.name}</span><small>{item.scope} · {item.territory}</small></button></li>)}</ul>}</section>;
}

function FederationFinder() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Array<{ id: string; name: string; scope: string; territory: string }>>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const search = async (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) { setItems([]); return; }
    try { const response = await fetch("/api/federaciones", { cache: "no-store" }); const data = await response.json(); const term = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); setItems((data.federations ?? []).filter((item: { id: string; name: string }) => `${item.id} ${item.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(term)).slice(0, 8)); } catch { setItems([]); }
  };
  if (selected) return <section className="mb-6 flex items-center rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3"><b>{selected.id} · {selected.name}</b><button type="button" onClick={() => { setSelected(null); setQuery(""); }} className="ml-auto text-lg text-sky-800" aria-label="Volver a desplegar el buscador" title="Cambiar federación">▶</button></section>;
  return <section className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-5"><label className="block text-sm font-black text-slate-900">Buscador inteligente de federaciones nacionales y regionales<input autoFocus value={query} onChange={event => void search(event.target.value)} placeholder="Busca por ID o nombre: FCR, Catalana…" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal" /></label>{items.length > 0 && <ul className="mt-3 overflow-hidden rounded-lg border bg-white">{items.map(item => <li key={item.id}><button type="button" onClick={() => { setSelected(item); setItems([]); }} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sky-100"><span><b>{item.id}</b> · {item.name}</span><small>{item.scope} · {item.territory}</small></button></li>)}</ul>}</section>;
}

export default function FederationCompetitionStructurePage() {
  const [openTable, setOpenTable] = useState<TableKey | null>("stages");
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]);
  const toggle = (table: TableKey) => setOpenTable(current => current === table ? null : table);

  return (
    <main className="catalog-app min-h-screen">
      <header className="catalog-header"><Link href="/jugadores" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu /></header>
      <section className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Convocatoria partidos</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Competición</h1>
        <p className="mt-3 max-w-2xl text-slate-600">Estructura de la Federació Catalana de Rugby para generar convocatorias por equipo.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map(([title, description, table]) => table ? <button key={title} type="button" onClick={() => toggle(table)} aria-expanded={openTable === table} aria-controls={`${table}-fcr-table`} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600"><h2 className="font-bold text-slate-900">{title}<span className="ml-2 text-sky-700" aria-hidden="true">{openTable === table ? "−" : "+"}</span></h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></button> : <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}
        </div>
        <FederationFinder />
        {openTable === "stages" && <CardTable table="stages" title="Etapas FCR" />}
        {openTable === "categories" && <CardTable table="categories" title="Categorías deportivas FCR"><table className="w-full text-left"><caption className="sr-only">Categorías deportivas FCR</caption><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">ID</th><th scope="col" className="px-5 py-3">Categoría</th></tr></thead><tbody>{categories.map(([id, category]) => <tr key={id} className="border-t border-slate-200"><td className="px-5 py-3 font-mono text-sm text-slate-600">{id}</td><td className="px-5 py-3 font-bold text-slate-900">{category}</td></tr>)}</tbody></table></CardTable>}
        {openTable === "phases" && <CardTable table="phases" title="Fases y competiciones FCR"><table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Fases y competiciones FCR</caption><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">ID</th><th scope="col" className="px-5 py-3">Fase</th><th scope="col" className="px-5 py-3">Competición</th><th scope="col" className="px-5 py-3">Categorías</th></tr></thead><tbody>{phases.map(([id, phase, competition, category]) => <tr key={id} className="border-t border-slate-200"><td className="px-5 py-3 font-mono text-xs text-slate-600">{id}</td><th scope="row" className="px-5 py-3 font-bold text-slate-900">{phase}</th><td className="px-5 py-3 font-semibold text-slate-800">{competition}</td><td className="px-5 py-3 text-slate-700">{category}</td></tr>)}</tbody></table></CardTable>}
        {openTable === "meetings" && <CardTable table="meetings" title="Trobades de escuelas FCR · temporada 2025/26"><table className="w-full min-w-[980px] text-left text-sm"><caption className="sr-only">Trobades de escuelas FCR de 2025/26</caption><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">ID</th><th scope="col" className="px-5 py-3">Tipo</th><th scope="col" className="px-5 py-3">Fecha</th><th scope="col" className="px-5 py-3">Sede</th><th scope="col" className="px-5 py-3">Categorías</th><th scope="col" className="px-5 py-3">Estado</th></tr></thead><tbody>{meetings2526.map(([id, type, date, venue, category, status]) => <tr key={id} className="border-t border-slate-200 align-top"><td className="px-5 py-3 font-mono text-xs text-slate-600">{id}</td><th scope="row" className="px-5 py-3 font-bold text-slate-900">{type}</th><td className="px-5 py-3 text-slate-700">{date}</td><td className="px-5 py-3 text-slate-700">{venue}</td><td className="px-5 py-3 text-slate-700">{category}</td><td className="px-5 py-3 font-semibold text-sky-800">{status}</td></tr>)}</tbody></table><p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">Listado basado en publicaciones de la FCR; no se ha localizado un calendario detallado de trobades para 2026/27.</p></CardTable>}
        {openTable === "seasons" && <CardTable table="seasons" title="Combinaciones por temporada FCR">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4"><label className="grid max-w-xs gap-1 text-sm font-bold text-slate-800">Temporada<select value={selectedSeason} onChange={event => setSelectedSeason(event.target.value)} className="rounded border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">Selecciona una temporada</option>{seasons.map(season => <option key={season} value={season}>{season}</option>)}</select></label></div>
          {selectedSeason && <table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">Combinaciones disponibles para {selectedSeason}</caption><thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th scope="col" className="px-5 py-3">Temporada</th><th scope="col" className="px-5 py-3">Etapa</th><th scope="col" className="px-5 py-3">Categoría</th><th scope="col" className="px-5 py-3">Fase</th></tr></thead><tbody>{seasonCombinations.map(([stage, category, phase]) => <tr key={`${selectedSeason}-${stage}-${category}-${phase}`} className="border-t border-slate-200"><td className="px-5 py-3 font-mono text-slate-600">{selectedSeason}</td><td className="px-5 py-3 font-bold text-slate-900">{stage}</td><td className="px-5 py-3 text-slate-700">{category}</td><td className="px-5 py-3 text-slate-700">{phase}</td></tr>)}</tbody></table>}
        </CardTable>}
      </section>
    </main>
  );
}
