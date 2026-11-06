"use client";
/* eslint-disable @next/next/no-img-element */

import { HitoPublicationButton } from "@/app/components/hito-publication-button";
import { CallupSourceLink } from "@/app/jugadores/[id]/callup-source-link";
import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { ChevronDown, Pencil, Save, X } from "lucide-react";
import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";

type ManualAction = "include" | "exclude";
type PlayerOption = { id: string; name: string };
type FederationOption = { id: string; name: string; scope: string | null; country: string | null; territory: string | null };
type ProfessionalCategoryOption = { id: string; label: string; type: string; country: string | null };
type ManualRecord = { published?: boolean; source_key?: string; source_url?: string | null; id: string; action: ManualAction; player_id: string; player_name: string; federation_id: string; scope: string | null; category: string | null; format?: string | null; season_label: string | null; club_text: string | null; notes: string | null; created_at: string };
type SelectionRecord = { published?: boolean; source_key?: string; source_url?: string | null; id: string; player_id: string; player_name: string | null; federation_id: string; scope: string | null; category: string | null; format?: string | null; season_label: string | null; club_text: string | null; source: "milestone" | "manual"; notes?: string | null; excluded?: boolean };
type State = { configured: boolean; admin: boolean; canWrite: boolean; players: PlayerOption[]; federations: FederationOption[]; categories?: ProfessionalCategoryOption[]; manual: ManualRecord[]; records: SelectionRecord[]; effective_records: SelectionRecord[] };
type Draft = { player: string; action: ManualAction; federation: string; scope: string; category: string; format: string; season_label: string; club_text: string; notes: string };
type CallupSortKey = "status" | "player" | "federation" | "season" | "format" | "detail";
type SortState<T extends string> = { key: T; direction: 1 | -1 } | null;
type FederationFilter = string;
type FederationFilterOption = { key: FederationFilter; label: string; detail: string; count: number; lines: number; shield: string | null };
type CategoryOption = { label: string; count: number };
type CallupRow = {
  published?: boolean; source_key?: string;
  source_url?: string | null;
  key: string;
  kind: "detected" | "manual";
  status: string;
  player_id: string;
  player_name: string;
  federation_id: string;
  scope: string | null;
  category: string | null;
  format?: string | null;
  season_label: string | null;
  club_text: string | null;
  notes?: string | null;
  excluded?: boolean;
  detected?: SelectionRecord;
  manual?: ManualRecord;
};

const inputClass = "min-w-0 w-full rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500";
const emptyDraft: Draft = { player: "", action: "include", federation: "", scope: "", category: "", format: "XV", season_label: "", club_text: "", notes: "" };
const baseSelectionCategories = ["S6", "S8", "S10", "S12", "S14", "S16", "S18", "S20", "S23", "Senior", "Sénior", "Absoluta", "Promesas", "Emerging", "Seven", "7s"];
const playerValue = (player: PlayerOption) => `${player.id} - ${player.name}`;
const idFromValue = (value: string, pattern: RegExp) => value.match(pattern)?.[0].toUpperCase() ?? value.trim().split(/\s+/)[0]?.toUpperCase() ?? "";
const playerIdFromValue = (value: string) => idFromValue(value, /JUG[0-9]{4}/i);
const federationAliasMap: Record<string, string[]> = {
  FN003: ["FER"],
  FN004: ["FFR"],
  FT003: ["FRPA"],
  FT009: ["FCR"],
  FT010: ["FVR", "FRCV"],
  FT015: ["FMR", "FRM"],
};
const selectionCode = (idOrScope: string | null | undefined) => {
  if (!idOrScope) return "";
  const normalized = idOrScope.replace(/^SELECCIÓN\s+/i, "").trim();
  return federationAliasMap[normalized]?.[0] ?? normalized;
};
const federationAliases = (federation: FederationOption) => [...new Set([...(federationAliasMap[federation.id] ?? []), federation.scope && !["Nacional", "Territorial", federation.id].includes(federation.scope) ? federation.scope : null].filter(Boolean) as string[])];
const federationValue = (federation: FederationOption) => `${federation.name} · ${federationAliases(federation).join(" / ") || federation.id} · ${federation.id}`;
const federationIdFromValue = (value: string, federations: FederationOption[]) => {
  const id = value.match(/F[NT][0-9]{3}/i)?.[0].toUpperCase() ?? "";
  if (id) return id;
  const normalized = value.trim().toLocaleLowerCase("es-ES");
  return federations.find((federation) => {
    const aliases = federationAliases(federation).map((alias) => alias.toLocaleLowerCase("es-ES"));
    return federation.name.toLocaleLowerCase("es-ES") === normalized || aliases.includes(normalized) || federationValue(federation).toLocaleLowerCase("es-ES") === normalized;
  })?.id ?? "";
};
const actionLabel = (action: ManualAction) => action === "include" ? "Manual" : "Excluir";
const federationName = (federationById: Map<string, FederationOption>, id: string) => (federationById.get(id)?.name ?? selectionCode(id)) || id;
const uniquePlayerCount = (records: Pick<CallupRow, "player_id">[]) => new Set(records.map((record) => record.player_id)).size;
const matchesFederationGroup = (filter: FederationFilter, record: Pick<CallupRow, "federation_id" | "format" | "category" | "club_text">) => {
  const format = formatLabel(record.format);
  return filter === "all"
    || (filter === "ferxv" ? record.federation_id === "FN003" && format !== "7s"
      : filter === "fer7s" ? record.federation_id === "FN003" && format === "7s"
        : filter.startsWith("federation:") ? record.federation_id === filter.replace("federation:", "")
          : true);
};
const normalizeSeasonLabel = (value: string) => {
  const long = value.match(/\b(20\d{2})\D+(20\d{2})\b/);
  if (long) return `${long[1].slice(-2)}-${long[2].slice(-2)}`;
  const short = value.match(/\b(\d{2})\D+(\d{2})\b/);
  return short ? `${short[1]}-${short[2]}` : value.trim();
};
const seasonLabel = (value: string | null | undefined) => value ? normalizeSeasonLabel(value) : "—";
const leonesSevensPrefix = /^\s*Leones\s+7s\s*[-–—]\s*/i;
const cleanLeonesSevensDetail = (value: string | null | undefined) => value?.replace(leonesSevensPrefix, "").trim() || null;
const normalizeSearch = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
const categoryMatchScore = (option: CategoryOption, query: string) => {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return option.count;
  const label = normalizeSearch(option.label);
  if (label === normalizedQuery) return 1000 + option.count;
  if (label.startsWith(normalizedQuery)) return 800 + option.count;
  const terms = normalizedQuery.split(" ").filter(Boolean);
  if (terms.every((term) => label.includes(term))) return 500 + option.count + terms.filter((term) => label.startsWith(term)).length * 30;
  return 0;
};
const formatLabel = (format: string | null | undefined) => {
  if (format) return format;
  return "XV";
};
const detailTitle = (record: CallupRow) => {
  const cleanCategory = cleanLeonesSevensDetail(record.category);
  const selectionLabel = selectionCode(record.federation_id) || selectionCode(record.scope) || record.scope;
  return record.kind === "manual" ? cleanCategory || selectionLabel || "Convocatoria" : selectionLabel || "Selección";
};
const detailSubtitle = (record: CallupRow) => {
  const cleanCategory = cleanLeonesSevensDetail(record.category);
  const cleanClub = cleanLeonesSevensDetail(record.club_text);
  return record.kind === "manual" ? record.notes ?? cleanClub ?? "Sin notas" : [cleanCategory, cleanClub].filter(Boolean).join(" · ") || "Sin detalle";
};

function FederationShield({ id, name }: { id: string; name: string }) {
  const shield = federationShieldUrl(id);
  const code = selectionCode(id);
  return <span className="selection-callups-shield-cell" title={`${name} · ${code}`} aria-label={`${name} · ${code}`}>
    {shield ? <img src={shield} alt={name} /> : <b>{code}</b>}
  </span>;
}

export default function CallupsContent({embedded = false}: {embedded?: boolean}) {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ManualRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const formRef = useRef<HTMLFormElement>(null);
  const [formHeight, setFormHeight] = useState(0);
  const [callupSort, setCallupSort] = useState<SortState<CallupSortKey>>(null);
  const [federationFilter, setFederationFilter] = useState<FederationFilter>("all");
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [categorySearchOpen, setCategorySearchOpen] = useState(false);

  const loadData = (clearNotice = true) => {
    if (clearNotice) setNotice("");
    return fetch("/api/hitos/convocatorias", { cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then(setState)
      .catch((error) => setNotice(error instanceof Error ? error.message : "No se han podido cargar las convocatorias."));
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hitos/convocatorias", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then((data) => { if (!controller.signal.aborted) setState(data); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se han podido cargar las convocatorias."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = formRef.current;
    if (!element) { setFormHeight(0); return; }
    const updateHeight = () => setFormHeight(element.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);
    window.addEventListener("resize", updateHeight);
    return () => { observer.disconnect(); window.removeEventListener("resize", updateHeight); };
  }, [state?.canWrite]);

  const federationById = useMemo(() => new Map((state?.federations ?? []).map((federation) => [federation.id, federation])), [state?.federations]);
  const federationOptions = useMemo(() => state?.federations ?? [], [state?.federations]);
  const regularized = useMemo(() => state?.manual ?? [], [state?.manual]);
  const allCallups = useMemo(() => {
    const detectedRows: CallupRow[] = (state?.records ?? []).map((record) => ({
      key: `detected-${record.id}`,
      kind: "detected",
      status: record.excluded ? "Excluida" : "Detectada",
      player_id: record.player_id,
      player_name: record.player_name ?? record.player_id,
      federation_id: record.federation_id,
      scope: record.scope,
      category: record.category,
      format: record.format,
      season_label: record.season_label,
      club_text: record.club_text,
      notes: record.notes,
      excluded: record.excluded,
      published: record.published,
      source_key: record.source_key,
      source_url: record.source_url,
      detected: record,
    }));
    const manualRows: CallupRow[] = regularized.map((record) => ({
      key: `manual-${record.id}`,
      kind: "manual",
      status: actionLabel(record.action),
      player_id: record.player_id,
      player_name: record.player_name,
      federation_id: record.federation_id,
      scope: record.scope,
      category: record.category,
      format: record.format,
      season_label: record.season_label,
      club_text: record.club_text,
      notes: record.notes,
      excluded: record.action === "exclude",
      published: record.published,
      source_key: record.source_key,
      source_url: record.source_url,
      manual: record,
    }));
    return [...detectedRows, ...manualRows];
  }, [regularized, state?.records]);
  const federationFilters = useMemo<FederationFilterOption[]>(() => {
    const all: FederationFilterOption = { key: "all", label: "TODAS", detail: "Todas las selecciones", count: uniquePlayerCount(allCallups), lines: allCallups.length, shield: null };
    const ferXvRows = allCallups.filter((record) => matchesFederationGroup("ferxv", record));
    const fer7sRows = allCallups.filter((record) => matchesFederationGroup("fer7s", record));
    const special: FederationFilterOption[] = [
      { key: "ferxv", label: "FER XV", detail: "España · XV", count: uniquePlayerCount(ferXvRows), lines: ferXvRows.length, shield: "FN003" },
      { key: "fer7s", label: "FER 7s", detail: "España · Rugby 7", count: uniquePlayerCount(fer7sRows), lines: fer7sRows.length, shield: "FN003" },
    ].filter((item) => item.lines > 0);
    const federationIds = [...new Set(allCallups.map((record) => record.federation_id))].filter((id) => id !== "FN003");
    const federations = federationIds.map((id) => {
      const rows = allCallups.filter((record) => record.federation_id === id);
      const federation = federationById.get(id);
      return { key: `federation:${id}`, label: selectionCode(id) || id, detail: federation?.name ?? federationName(federationById, id), count: uniquePlayerCount(rows), lines: rows.length, shield: id } satisfies FederationFilterOption;
    });
    return [all, ...[...special, ...federations].sort((a, b) => b.count - a.count || b.lines - a.lines || a.label.localeCompare(b.label, "es"))];
  }, [allCallups, federationById]);
  const selectedFederationFilter = federationFilters.find((item) => item.key === federationFilter) ?? federationFilters[0];
  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const counts = new Map<string, number>();
    const register = (value: string | null | undefined, weight = 1) => {
      const label = cleanLeonesSevensDetail(value);
      if (!label) return;
      const key = normalizeSearch(label);
      if (!key) return;
      const previous = [...counts.keys()].find((item) => normalizeSearch(item) === key) ?? label;
      counts.set(previous, (counts.get(previous) ?? 0) + weight);
    };
    baseSelectionCategories.forEach((category) => register(category, 1));
    (state?.categories ?? []).forEach((category) => register(category.label, 12));
    allCallups.forEach((record) => register(record.category, 4));
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es", { sensitivity: "base", numeric: true }));
  }, [allCallups, state?.categories]);
  const categoryMatches = useMemo(() => categoryOptions
    .map((option) => ({ option, score: categoryMatchScore(option, draft.category) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score || b.option.count - a.option.count || a.option.label.localeCompare(b.option.label, "es", { sensitivity: "base", numeric: true }))
    .slice(0, 8)
    .map((match) => match.option), [categoryOptions, draft.category]);
  const callups = useMemo(() => {
    const text = query.trim().toLocaleLowerCase("es-ES");
    const rows = allCallups.filter((record) => matchesFederationGroup(federationFilter, record) && (!text || [record.status, record.player_id, record.player_name, record.federation_id, selectionCode(record.federation_id), selectionCode(record.scope), record.scope ?? "", record.category ?? "", record.format ?? "", record.season_label ?? "", record.club_text ?? "", record.notes ?? ""].join(" ").toLocaleLowerCase("es-ES").includes(text)));
    if (!callupSort) return rows;
    const value = (record: CallupRow) => callupSort.key === "status"
      ? record.status
      : callupSort.key === "player"
        ? `${record.player_name} ${record.player_id}`
        : callupSort.key === "federation"
          ? `${federationById.get(record.federation_id)?.name ?? ""} ${record.federation_id}`
          : callupSort.key === "season"
            ? record.season_label ?? ""
            : callupSort.key === "format"
              ? formatLabel(record.format)
              : `${selectionCode(record.federation_id) || selectionCode(record.scope) || (record.scope ?? "")} ${cleanLeonesSevensDetail(record.category) ?? ""} ${record.format ?? ""} ${record.notes ?? ""} ${cleanLeonesSevensDetail(record.club_text) ?? ""}`;
    return [...rows].sort((a, b) => value(a).localeCompare(value(b), "es", { numeric: true }) * callupSort.direction);
  }, [allCallups, callupSort, federationById, federationFilter, query]);
  const sortMark = <T extends string>(state: SortState<T>, key: T) => state?.key !== key ? "↕" : state.direction === 1 ? "↑" : "↓";
  const nextSort = <T extends string>(key: T, setter: (value: SortState<T> | ((current: SortState<T>) => SortState<T>)) => void) => setter((current) => current?.key === key && current.direction === 1 ? { key, direction: -1 } : { key, direction: 1 });

  const update = (field: keyof Draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const selectCategory = (category: string) => {
    update("category", category);
    setCategorySearchOpen(false);
  };
  const cancelEdit = () => { setEditing(null); setDraft(emptyDraft); };
  const startEdit = (record: ManualRecord) => {
    const federation = federationById.get(record.federation_id);
    setEditing(record);
    setDraft({ player: `${record.player_id} - ${record.player_name}`, action: record.action, federation: federation ? federationValue(federation) : record.federation_id, scope: record.scope ?? "", category: record.category ?? "", format: record.format || "XV", season_label: record.season_label ?? "", club_text: record.club_text ?? "", notes: record.notes ?? "" });
    requestAnimationFrame(() => document.getElementById("selection-callup-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const startExclusion = (record: SelectionRecord) => {
    const federation = federationById.get(record.federation_id);
    setEditing(null);
    setDraft({ player: `${record.player_id} - ${record.player_name ?? record.player_id}`, action: "exclude", federation: federation ? federationValue(federation) : record.federation_id, scope: record.scope ?? "", category: record.category ?? "", format: record.format || "XV", season_label: record.season_label ?? "", club_text: record.club_text ?? "", notes: "Regularización manual desde hitos" });
    requestAnimationFrame(() => document.getElementById("selection-callup-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const startDetectedEdit = (record: SelectionRecord) => {
    const federation = federationById.get(record.federation_id);
    setEditing(null);
    setDraft({ player: `${record.player_id} - ${record.player_name ?? record.player_id}`, action: "include", federation: federation ? federationValue(federation) : record.federation_id, scope: record.scope ?? "", category: record.category ?? "", format: record.format || "XV", season_label: record.season_label ?? "", club_text: record.club_text ?? "", notes: record.notes ?? "" });
    requestAnimationFrame(() => document.getElementById("selection-callup-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const playerId = playerIdFromValue(draft.player);
      const federationId = federationIdFromValue(draft.federation, federationOptions);
      if (!federationId) throw new Error("Selecciona una selección del desplegable.");
      const playerName = state?.players.find((player) => player.id === playerId)?.name ?? draft.player.replace(playerId, "").replace(/^[-\s]+/, "");
      const federation = state?.federations.find((item) => item.id === federationId);
      const response = await fetch("/api/hitos/convocatorias", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing?.id, action: draft.action, player_id: playerId, player_name: playerName, federation_id: federationId, scope: draft.scope || federation?.scope || null, category: draft.category, format: draft.format, season_label: draft.season_label, club_text: draft.club_text, notes: draft.notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice(editing ? "Regularización actualizada." : "Regularización añadida.");
      cancelEdit();
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la regularización.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteManual(id: string) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/hitos/convocatorias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-record", id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (editing?.id === id) cancelEdit();
      setNotice("Regularización eliminada.");
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la regularización.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="directory-app selection-callups-page" style={{ "--selection-form-height": `${formHeight}px` } as CSSProperties}>
    {!embedded && <>
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority /><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="selectionCallups" /></header>
    <section className="directory-cover participations-cover">
      <span className="directory-cover-world-rugby" aria-hidden="true"><svg className="h-full w-full text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></svg></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker" />GESTIÓN DE HITOS</p><h1>HITOS DEPORTIVOS</h1><span>Regulariza selecciones detectadas por hitos y altas adicionales</span></div>
      <div className="directory-cover-actions"><Link href="/hitos">Volver a hitos</Link></div>
    </section>
    </>}
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-2 sm:px-8">
      {notice && !state && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando convocatorias...</p>}
      {state && <>
        <section className="selection-callups-filter-dropdown mt-3 rounded-2xl bg-white shadow-sm">
          <div className="selection-callups-filter-summary">
            <button type="button" className="selection-callups-filter-toggle" onClick={() => setFilterMenuOpen((current) => !current)} aria-expanded={filterMenuOpen} aria-controls="selection-callups-filter-options" aria-label={filterMenuOpen ? "Ocultar tabla de federaciones" : "Seleccionar federación"} title={filterMenuOpen ? "Ocultar tabla" : "Seleccionar federación"}><span className="selection-callups-filter-code">{selectedFederationFilter?.shield && <img src={federationShieldUrl(selectedFederationFilter.shield) ?? ""} alt="" />}{selectedFederationFilter?.label ?? "TODAS"}</span><span className="min-w-0"><b>{selectedFederationFilter?.detail ?? "Todas las selecciones"}</b><small>{filterMenuOpen ? "Ocultar tabla" : "Seleccionar federación"}</small></span><ChevronDown size={16} aria-hidden="true" className={filterMenuOpen ? "rotate-180" : ""} /></button>
            <button type="button" className="selection-callups-filter-metric" aria-label={`${selectedFederationFilter?.count ?? 0} jugadores únicos`}><span>JUGADORES</span><b>{selectedFederationFilter?.count ?? 0}</b></button>
            <button type="button" className="selection-callups-filter-metric" aria-label={`${selectedFederationFilter?.lines ?? 0} participaciones`}><span>PARTICIP.</span><b>{selectedFederationFilter?.lines ?? 0}</b></button>
          </div>
          {filterMenuOpen && <div id="selection-callups-filter-options" className="selection-callups-filter-panel overflow-x-auto">
            <div className="grid min-w-[680px] grid-cols-[82px_minmax(220px,1fr)_88px_88px] border-y border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><span>COD.</span><span>SELECCIÓN</span><span>JUG.</span><span>LÍNEAS</span></div>
            <ul className="min-w-[680px] divide-y divide-neutral-200">{federationFilters.map((item) => <li key={item.key}>
              <button type="button" onClick={() => { setFederationFilter(item.key); setFilterMenuOpen(false); }} className={`grid w-full grid-cols-[82px_minmax(220px,1fr)_88px_88px] items-center gap-2 px-3 py-3 text-left hover:bg-red-50/60 ${federationFilter === item.key ? "selected" : ""}`}>
                <span className="selection-callups-filter-code">{item.shield && <img src={federationShieldUrl(item.shield) ?? ""} alt="" />}{item.label}</span>
                <span className="min-w-0"><b className="block truncate text-sm text-neutral-900">{item.detail}</b><small className="text-xs font-semibold text-neutral-500">{item.key === "all" ? "Vista completa" : item.shield}</small></span>
                <strong className="text-lg text-red-600">{item.count}</strong>
                <span className="text-sm font-black text-neutral-700">{item.lines}</span>
              </button>
            </li>)}</ul>
          </div>}
        </section>
        {!state.canWrite && <section className="catalog-access-card"><div><p>ACCESO RESTRINGIDO</p><h2>Hitos deportivos</h2><span>Inicia sesión para añadir o excluir convocatorias manualmente.</span></div><Link className="catalog-menu-button" href="/catalogos">Iniciar sesión</Link></section>}
        {state.canWrite && <form id="selection-callup-form" ref={formRef} onSubmit={submit} className="selection-callups-form mt-3 grid gap-3 rounded-2xl bg-white p-5 shadow-sm lg:grid-cols-[minmax(185px,1.05fr)_108px_96px_minmax(230px,1.35fr)_124px_minmax(145px,.9fr)_auto]">
          <datalist id="selection-player-list">{state.players.map((player) => <option key={player.id} value={playerValue(player)} />)}</datalist>
          <datalist id="selection-federation-list">{federationOptions.map((federation) => <option key={federation.id} value={federationValue(federation)} />)}</datalist>
          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Jugador<input list="selection-player-list" required placeholder="JUG0000 - Nombre" value={draft.player} onChange={(event) => update("player", event.target.value)} className={inputClass} /></label>
          <div className="relative grid min-w-0 max-w-[108px] gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">
            <label htmlFor="selection-category-search">Categoría</label>
            <div className="flex min-w-0 w-full rounded-[8px] border border-neutral-300 bg-white focus-within:border-red-500">
              <input id="selection-category-search" role="combobox" placeholder="S18" value={draft.category} onChange={(event) => { update("category", event.target.value); setCategorySearchOpen(true); }} onFocus={() => setCategorySearchOpen(true)} onBlur={() => window.setTimeout(() => setCategorySearchOpen(false), 120)} className="min-w-0 flex-1 rounded-l-[8px] px-3 py-2 text-sm font-semibold text-neutral-900 outline-none" autoComplete="off" aria-autocomplete="list" aria-expanded={categorySearchOpen} aria-controls="selection-category-results" />
              {draft.category && <DeleteButton type="button" className="w-7 shrink-0 text-xs font-black text-neutral-500 hover:text-red-700" onMouseDown={(event) => event.preventDefault()} onClick={() => { update("category", ""); setCategorySearchOpen(true); }} aria-label="Limpiar categoría" />}
            </div>
            {categorySearchOpen && <div id="selection-category-results" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-[8px] border border-neutral-200 bg-white p-1 shadow-lg">
              {categoryMatches.length ? categoryMatches.map((category) => <button key={category.label} type="button" className="grid w-full gap-0.5 rounded-[6px] px-3 py-2 text-left hover:bg-red-50 focus:bg-red-50 focus:outline-none" onMouseDown={(event) => event.preventDefault()} onClick={() => selectCategory(category.label)}>
                <span className="text-sm font-black normal-case tracking-normal text-neutral-900">{category.label}</span>
                <small className="font-normal normal-case tracking-normal text-neutral-500">{state.categories?.some((item) => normalizeSearch(item.label) === normalizeSearch(category.label)) ? "Tabla de categorías" : category.count > 1 ? `${category.count} coincidencias en convocatorias` : "Opción sugerida"}</small>
              </button>) : <p className="px-3 py-2 text-sm font-normal normal-case tracking-normal text-neutral-500">Sin coincidencias. Puedes guardar la categoría escrita.</p>}
            </div>}
          </div>
          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Formato<select value={draft.format} onChange={(event) => update("format", event.target.value)} className={inputClass}><option value="XV">XV</option><option value="7s">7s</option></select></label>
          <div className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500"><span className="flex items-center gap-2"><Link href="/hitos/selecciones" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-neutral-700 hover:border-red-300 hover:text-red-700" aria-label="Abrir tabla de selecciones" title="Abrir tabla de selecciones"><Pencil size={14} aria-hidden="true" /></Link>Selección</span><input list="selection-federation-list" required placeholder="FER, FCR, FFR..." value={draft.federation} onChange={(event) => update("federation", event.target.value)} className={inputClass} /></div>
          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Temporada<input placeholder="25/26" inputMode="numeric" value={draft.season_label} onBlur={(event) => update("season_label", normalizeSeasonLabel(event.target.value))} onChange={(event) => update("season_label", event.target.value)} className={inputClass} /></label>
          <label className="grid min-w-0 gap-1 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Notas<input placeholder="Opcional" value={draft.notes} onChange={(event) => update("notes", event.target.value)} className={inputClass} /></label>
          <div className="flex items-end gap-3 pl-1"><button disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-red-600 text-white disabled:opacity-60" aria-label={editing ? "Guardar cambios" : "Añadir regularización"} title={editing ? "Guardar cambios" : "Añadir regularización"}>{busy ? <span className="text-xs font-black">...</span> : <Save size={17} aria-hidden="true" />}</button>{editing && <button type="button" disabled={busy} onClick={cancelEdit} className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-neutral-700 hover:border-red-200 hover:text-red-700 disabled:opacity-60" aria-label="Cancelar edición" title="Cancelar edición"><X size={17} aria-hidden="true" /></button>}</div>
          {notice && <p className="catalog-notice lg:col-span-7" role="status">{notice}</p>}
        </form>}
        <section className="selection-callups-table mt-4 rounded-2xl bg-white shadow-sm">
          <header className="federation-directory-title"><div><b>HITOS DEPORTIVOS</b><small>{callups.length} línea{callups.length === 1 ? "" : "s"} combinada{callups.length === 1 ? "" : "s"}: hitos detectados y regularizaciones manuales dadas por buenas.</small></div><label className="directory-search max-w-sm"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar jugador, selección, temporada..." aria-label="Buscar convocatoria o regularización" /></label></header>
          <div className="selection-callups-head grid hitos-url-grid border-y border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><button type="button" onClick={() => nextSort("status", setCallupSort)}>ESTADO {sortMark(callupSort, "status")}</button><button type="button" onClick={() => nextSort("player", setCallupSort)}>JUGADOR {sortMark(callupSort, "player")}</button><button type="button" onClick={() => nextSort("federation", setCallupSort)}>SELECCIÓN {sortMark(callupSort, "federation")}</button><button type="button" onClick={() => nextSort("season", setCallupSort)}>TEMP. {sortMark(callupSort, "season")}</button><button type="button" onClick={() => nextSort("format", setCallupSort)}>FORM. {sortMark(callupSort, "format")}</button><button type="button" onClick={() => nextSort("detail", setCallupSort)}>DETALLE {sortMark(callupSort, "detail")}</button><span>URL · guardado automático</span><span>PUBLICAR</span></div>
          <ul className="divide-y divide-neutral-200">{callups.map((record) => <li key={record.key} className={`grid hitos-url-grid items-center gap-2 px-3 py-3 ${record.excluded ? "bg-red-50/60 text-neutral-500" : ""}`}>
            <b className={record.excluded ? "text-red-700" : record.kind === "manual" ? "text-green-700" : "text-neutral-700"}>{record.status}</b>
            <span className="min-w-0"><Link href={`/jugadores/${record.player_id}`} className="block truncate font-black uppercase hover:text-red-700">{record.player_name}</Link><small className="font-mono text-xs font-bold text-neutral-500">{record.player_id}</small></span>
            <FederationShield id={record.federation_id} name={federationName(federationById, record.federation_id)} />
            <span className="text-sm font-black">{seasonLabel(record.season_label)}</span>
            <span className="text-sm font-black text-neutral-700">{formatLabel(record.format)}</span>
            <span className="min-w-0"><b className="block truncate text-sm">{detailTitle(record)}</b><small className="block truncate text-xs text-neutral-500">{detailSubtitle(record)}</small></span>
            <div className="min-w-0"><CallupSourceLink key={record.source_key + (record.source_url || "")} compact field playerId={record.player_id} sourceKey={record.source_key} sourceUrl={record.source_url} admin={state.admin} /></div>
            <span className="flex justify-end gap-1">{state.admin && <HitoPublicationButton key={(record.manual?.id || record.detected?.id) + String(record.published)} id={(record.manual?.id || record.detected?.id)!} initialPublished={record.published !== false} onChanged={() => void loadData(false)} />}{state.canWrite && record.manual ? <><button type="button" disabled={busy} onClick={() => startEdit(record.manual!)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50" aria-label={`Editar regularización de ${record.player_name}`} title="Editar"><Pencil size={16} /></button><DeleteButton type="button" disabled={busy} onClick={() => void deleteManual(record.manual!.id)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Eliminar regularización de ${record.player_name}`} title="Eliminar" /></> : state.canWrite && record.detected ? <><button type="button" disabled={busy} onClick={() => startDetectedEdit(record.detected!)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700 disabled:opacity-50" aria-label={`Modificar convocatoria de ${record.player_name}`} title="Modificar"><Pencil size={16} /></button>{record.excluded ? <span className="self-center text-xs font-black text-red-700">OK</span> : <button type="button" disabled={busy} onClick={() => startExclusion(record.detected!)} className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50" aria-label={`Excluir convocatoria de ${record.player_name}`} title="Excluir"><X size={16} /></button>}</> : null}</span>
          </li>)}</ul>
          {!callups.length && <p className="p-8 text-center text-sm text-neutral-500">{regularized.length ? "No hay convocatorias ni regularizaciones con este filtro." : "Aún no hay convocatorias ni regularizaciones para esta búsqueda."}</p>}
        </section>
      </>}
    </div>
  </div>;
}
