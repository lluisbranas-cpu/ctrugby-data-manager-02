"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save } from "lucide-react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { clubShieldUrl } from "@/app/lib/club-shields";

type Participation = {
  seasons: PlayerSeason[];
  player_id: string;
  primary_photo_url: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  category: string | null;
  birth_year: number | null;
  participation_count: number;
  participation_years: string[];
  participation_campus: Record<string, string>;
  participation_registration_numbers: Record<string, string>;
  participation_email_enabled: boolean;
  participation_pending_year: boolean;
  current_club_id: string | null;
  current_club_name: string | null;
  current_season_year: number | null;
  position_text: string | null;
  contact_email: string | null;
};
type YearRow = { year: string; players: number; participations: number };
type ClubRow = { club_id: string | null; club_name: string; players: number; participations: number };
type CampusAcademy = { id: string; name: string; siglas: string | null; kind: string; country: string | null; active: boolean };
type ClubOption = { id: string; name: string };
type PlayerSeason = { season_year: number; season_label: string; club_id: string | null; club_name: string | null; legacy_club_name: string | null; position_text: string | null };
type PlayerOption = {
  seasons: PlayerSeason[];
  id: string;
  name: string;
  primary_photo_url: string | null;
  category: string | null;
  birth_year: number | null;
  current_club_id: string | null;
  current_club_name: string | null;
  current_season_year: number | null;
  position_text: string | null;
  contact_email: string | null;
  participation_count: number;
  participation_years: string[];
  participation_campus: Record<string, string>;
  participation_registration_numbers: Record<string, string>;
  participation_email_enabled: boolean;
  participation_pending_year: boolean;
};
type State = {
  configured: boolean;
  admin: boolean;
  summary: { players: number; participations: number; years: number; clubs: number };
  years: YearRow[];
  clubs: ClubRow[];
  campuses: CampusAcademy[];
  clubOptions: ClubOption[];
  participations: Participation[];
  players: PlayerOption[];
};
type SortKey = "registration" | "photo" | "name" | "club" | "position" | "mail";
type DisplayRow = { row: Participation; target: ParticipationTarget; season: PlayerSeason | null; campusLabel: string };
const inputClass = "rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500";
const selectedPositionLabel = (row: Participation) => row.position_text || "—";
type ParticipationTarget = { year: string; campus: string };
const registrationKey = (target: ParticipationTarget) => `${target.campus}:${target.year}`;
const registrationValue = (row: Participation, target: ParticipationTarget) => row.participation_registration_numbers[registrationKey(target)] ?? row.participation_registration_numbers[target.year] ?? "";
const selectedRegistrationLabel = (row: Participation, targets: ParticipationTarget[]) => targets.map((target) => registrationValue(row, target)).filter(Boolean).join(" · ") || "—";
const selectedRegistrationValue = (row: Participation, targets: ParticipationTarget[]) => targets.map((target) => registrationValue(row, target)).filter(Boolean).join(" · ");
const emptyAddDraft = {
  player_id: "",
  name: "",
  category: "",
  birth_year: "",
  season_year: "",
  club_id: "",
  club: "",
  position: "",
  participation_count: "",
  participation_years: "",
  participation_campus: "",
  participation_registration_numbers: "",
  contact_email: "",
  participation_email_enabled: true,
  participation_pending_year: false,
};
type AddDraft = typeof emptyAddDraft;
const mapToText = (value: Record<string, string>) => {
  const entries = Object.entries(value);
  if (!entries.length) return "";
  const uniqueValues = [...new Set(entries.map(([, item]) => item))];
  return uniqueValues.length === 1 ? uniqueValues[0] : entries.map(([year, item]) => `${year}: ${item}`).join(" | ");
};
const genderText = (value: string | null) => value === "M" ? "Masculino" : value === "F" ? "Femenino" : "";
const seasonEndYear = (value: string) => {
  const text = value.trim();
  if (!text) return null;
  if (/^\d{4}$/.test(text)) return Number(text);
  const match = text.match(/^(\d{2}|\d{4})\s*[/–-]\s*(\d{2}|\d{4})$/);
  if (!match) return Number.NaN;
  const start = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const end = Number(match[2].length === 2 ? `${String(start).slice(0, 2)}${match[2]}` : match[2]);
  return end === start + 1 ? end : Number.NaN;
};

function RegistrationInput({ row, targets, meta, onSave }: { row: Participation; targets: ParticipationTarget[]; meta: string; onSave: (row: Participation, targets: ParticipationTarget[], fields: { registration_number?: string }) => void }) {
  const currentValue = selectedRegistrationValue(row, targets);
  const [value, setValue] = useState(currentValue);
  useEffect(() => setValue(currentValue), [currentValue]);
  return <span className="flex min-w-0 items-center gap-0.5"><small className="shrink-0 text-[10px] font-black uppercase text-neutral-400">{meta}</small><input className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-0 text-[10px] font-black uppercase text-red-600 outline-none placeholder:text-neutral-300 hover:border-red-100 focus:border-red-300 focus:bg-white focus:px-1" value={value} placeholder="—" aria-label={`Registro de ${row.display_name}`} onChange={(event) => setValue(event.target.value.toUpperCase())} onBlur={() => { if (value !== currentValue) onSave(row, targets, { registration_number: value }); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span>;
}

export default function ParticipationsContent({embedded = false}: {embedded?: boolean}) {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [addingParticipation, setAddingParticipation] = useState(false);
  const [year, setYear] = useState("all");
  const [campus, setCampus] = useState("all");
  const [gender, setGender] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "name", direction: 1 });
  const [addDraft, setAddDraft] = useState<AddDraft>(emptyAddDraft);
  const participationEditorRef = useRef<HTMLFormElement | null>(null);

  const loadData = (clearNotice = true, signal?: AbortSignal) => {
    if (clearNotice) setNotice("");
    return fetch("/api/participaciones", { cache: "no-store", signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then(setState)
      .catch((error) => { if (!signal?.aborted) setNotice(error instanceof Error ? error.message : "No se han podido cargar las participaciones."); });
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadData(true, controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const years = useMemo(() => state?.years ?? [], [state?.years]);
  const campusFilterOptions = useMemo(() => (state?.campuses ?? []).filter((item) => item.kind === "CAMP"), [state?.campuses]);
  const campusById = useMemo(() => new Map((state?.campuses ?? []).map((item) => [item.id, item])), [state?.campuses]);
  const campusShortLabel = useCallback((campusId: string) => campusById.get(campusId)?.siglas || (campusId === "CAM001" ? "CV" : campusId), [campusById]);
  const participationCampusForYear = useCallback((row: Participation, itemYear: string) => row.participation_campus[itemYear] || "CAM001", []);
  const rowMatchesFilters = useCallback((row: Participation, campusFilter: string, yearFilter: string) => {
    if (!row.participation_years.length) return campusFilter === "all" && yearFilter === "all";
    return row.participation_years.some((itemYear) => {
      const matchesYear = yearFilter === "all" || itemYear === yearFilter;
      const matchesCampus = campusFilter === "all" || participationCampusForYear(row, itemYear) === campusFilter;
      return matchesYear && matchesCampus;
    });
  }, [participationCampusForYear]);
  const rowMatchesGender = useCallback((row: Participation, genderFilter: string) => {
    if (genderFilter === "all") return true;
    return String(row.category ?? "").toUpperCase() === genderFilter;
  }, []);
  const campusYearOptions = useMemo(() => {
    if (campus === "all") return years;
    const counts = new Map<string, { year: string; players: number; participations: number }>();
    for (const row of state?.participations ?? []) {
      for (const itemYear of row.participation_years) {
        if (participationCampusForYear(row, itemYear) !== campus) continue;
        const current = counts.get(itemYear) ?? { year: itemYear, players: 0, participations: 0 };
        current.players += 1;
        current.participations += 1;
        counts.set(itemYear, current);
      }
    }
    return [...counts.values()].sort((a, b) => Number(b.year) - Number(a.year));
  }, [campus, participationCampusForYear, state?.participations, years]);
  const selectedYear = year === "all" || campusYearOptions.some((item) => item.year === year) ? year : "all";
  const rows = useMemo(() => {
    return [...(state?.participations ?? [])].filter((row) => {
      return rowMatchesFilters(row, campus, selectedYear) && rowMatchesGender(row, gender);
    }).sort((a, b) => {
      const visibleRegistration = (row: Participation) => selectedRegistrationLabel(row, row.participation_years.flatMap((itemYear) => {
        const matchesYear = selectedYear === "all" || itemYear === selectedYear;
        const matchesCampus = campus === "all" || participationCampusForYear(row, itemYear) === campus;
        return matchesYear && matchesCampus ? [{ year: itemYear, campus: participationCampusForYear(row, itemYear) }] : [];
      }));
      const values: Record<SortKey, [string, string]> = {
        registration: [visibleRegistration(a), visibleRegistration(b)],
        photo: [a.primary_photo_url ? "0" : "1", b.primary_photo_url ? "0" : "1"],
        name: [a.display_name, b.display_name],
        club: [a.current_club_name ?? "", b.current_club_name ?? ""],
        position: [selectedPositionLabel(a), selectedPositionLabel(b)],
        mail: [a.contact_email ?? "", b.contact_email ?? ""],
      };
      const [left, right] = values[sort.key];
      return (left.localeCompare(right, "es", { numeric: true, sensitivity: "base" }) || a.player_id.localeCompare(b.player_id, "es")) * sort.direction;
    });
  }, [campus, gender, participationCampusForYear, rowMatchesFilters, rowMatchesGender, selectedYear, sort, state?.participations]);
  const displayRows = useMemo(() => {
    return rows.flatMap((row) => row.participation_years.flatMap((itemYear): DisplayRow[] => {
      const itemCampus = participationCampusForYear(row, itemYear);
      const matchesYear = selectedYear === "all" || itemYear === selectedYear;
      const matchesCampus = campus === "all" || itemCampus === campus;
      if (!matchesYear || !matchesCampus) return [];
      const season = row.seasons.find((item) => item.season_year === Number(itemYear)) ?? null;
      return [{ row, target: { year: itemYear, campus: itemCampus }, season, campusLabel: campusShortLabel(itemCampus) }];
    })).sort((a, b) => {
      const position = (item: DisplayRow) => item.season?.position_text || selectedPositionLabel(item.row);
      const club = (item: DisplayRow) => item.season?.club_name || item.row.current_club_name || "";
      const values: Record<SortKey, [string, string]> = {
        registration: [selectedRegistrationLabel(a.row, [a.target]), selectedRegistrationLabel(b.row, [b.target])],
        photo: [a.row.primary_photo_url ? "0" : "1", b.row.primary_photo_url ? "0" : "1"],
        name: [a.row.display_name, b.row.display_name],
        club: [club(a), club(b)],
        position: [position(a), position(b)],
        mail: [a.row.contact_email ?? "", b.row.contact_email ?? ""],
      };
      const [left, right] = values[sort.key];
      return (left.localeCompare(right, "es", { numeric: true, sensitivity: "base" }) || b.target.year.localeCompare(a.target.year, "es", { numeric: true }) || a.row.player_id.localeCompare(b.row.player_id, "es")) * sort.direction;
    });
  }, [campus, campusShortLabel, participationCampusForYear, rows, selectedYear, sort]);
  const matchingParticipationCount = useCallback((row: Participation, campusFilter: string, yearFilter: string) => {
    return row.participation_years.filter((itemYear) => {
      const matchesYear = yearFilter === "all" || itemYear === yearFilter;
      const matchesCampus = campusFilter === "all" || participationCampusForYear(row, itemYear) === campusFilter;
      return matchesYear && matchesCampus;
    }).length;
  }, [participationCampusForYear]);
  const filteredSummary = useMemo(() => {
    const baseRows = (state?.participations ?? []).filter((row) => rowMatchesFilters(row, campus, selectedYear) && rowMatchesGender(row, gender));
    const yearSet = new Set(baseRows.flatMap((row) => row.participation_years.filter((itemYear) => campus === "all" || participationCampusForYear(row, itemYear) === campus)));
    const clubSet = new Set(baseRows.map((row) => row.current_club_id).filter(Boolean));
    return {
      participations: baseRows.reduce((total, row) => total + matchingParticipationCount(row, campus, selectedYear), 0),
      players: baseRows.length,
      years: selectedYear === "all" ? yearSet.size : baseRows.length ? 1 : 0,
      clubs: clubSet.size,
    };
  }, [campus, gender, matchingParticipationCount, participationCampusForYear, rowMatchesFilters, rowMatchesGender, selectedYear, state?.participations]);
  const order = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key ? current.direction * -1 as 1 | -1 : 1 }));
  const mark = (key: SortKey) => sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  const playerById = useMemo(() => new Map((state?.players ?? []).map((player) => [player.id, player])), [state?.players]);
  const clubById = useMemo(() => new Map((state?.clubOptions ?? []).map((club) => [club.id, club])), [state?.clubOptions]);
  const setAddValue = (field: keyof AddDraft, value: string | boolean) => setAddDraft((draft) => ({ ...draft, [field]: value }));
  const fillSeasonFields = (draft: AddDraft, seasonValue: string) => {
    const player = playerById.get(draft.player_id);
    const parsedYear = seasonEndYear(seasonValue);
    const season = Number.isInteger(parsedYear) ? player?.seasons.find((item) => item.season_year === parsedYear) : null;
    return {
      ...draft,
      season_year: seasonValue,
      club_id: season?.club_id ?? "",
      club: season?.club_name ?? season?.legacy_club_name ?? "",
      position: season?.position_text ?? draft.position,
    };
  };
  const setSeasonValue = (value: string) => setAddDraft((draft) => fillSeasonFields(draft, value));
  const setClubValue = (clubId: string) => setAddDraft((draft) => ({ ...draft, club_id: clubId, club: clubById.get(clubId)?.name ?? "" }));
  const fillAddDraftFromPlayer = (value: string) => {
    const match = value.trim().toUpperCase().match(/JUG\d{4}/);
    const playerId = match?.[0] ?? value.trim().toUpperCase();
    const player = playerById.get(playerId);
    if (!player) {
      setAddDraft((draft) => ({ ...draft, player_id: value }));
      return;
    }
    setAddDraft({
      player_id: player.id,
      name: player.name,
      category: genderText(player.category),
      birth_year: player.birth_year ? String(player.birth_year) : "",
      season_year: player.seasons[0]?.season_label ?? (player.current_season_year ? String(player.current_season_year) : ""),
      club_id: player.seasons[0]?.club_id ?? player.current_club_id ?? "",
      club: player.seasons[0]?.club_name ?? player.current_club_name ?? "",
      position: player.seasons[0]?.position_text ?? player.position_text ?? "",
      participation_count: player.participation_count ? String(player.participation_count) : "",
      participation_years: player.participation_years.join(", "),
      participation_campus: mapToText(player.participation_campus),
      participation_registration_numbers: mapToText(player.participation_registration_numbers),
      contact_email: player.contact_email ?? "",
      participation_email_enabled: player.participation_email_enabled,
      participation_pending_year: player.participation_pending_year,
    });
  };
  const openParticipationEditor = (row: Participation) => {
    setAddDraft({
      player_id: row.player_id,
      name: row.display_name,
      category: genderText(row.category),
      birth_year: row.birth_year ? String(row.birth_year) : "",
      season_year: row.seasons[0]?.season_label ?? (row.current_season_year ? String(row.current_season_year) : ""),
      club_id: row.seasons[0]?.club_id ?? row.current_club_id ?? "",
      club: row.seasons[0]?.club_name ?? row.current_club_name ?? "",
      position: row.seasons[0]?.position_text ?? row.position_text ?? "",
      participation_count: String(row.participation_count),
      participation_years: row.participation_years.join(", "),
      participation_campus: mapToText(row.participation_campus),
      participation_registration_numbers: mapToText(row.participation_registration_numbers),
      contact_email: row.contact_email ?? "",
      participation_email_enabled: row.participation_email_enabled,
      participation_pending_year: row.participation_pending_year,
    });
    setAddingParticipation(true);
    setNotice("");
    window.requestAnimationFrame(() => {
      participationEditorRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  async function saveParticipation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const target = event.currentTarget;
    const form = new FormData(target);
    try {
      const response = await fetch("/api/participaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player_id: addDraft.player_id,
          participation_count: Number(addDraft.participation_count),
          participation_years: addDraft.participation_years,
          participation_campus: addDraft.participation_campus,
          participation_registration_numbers: addDraft.participation_registration_numbers,
          season_year: addDraft.season_year,
          club_id: addDraft.club_id,
          contact_email: addDraft.contact_email,
          participation_email_enabled: addDraft.participation_email_enabled,
          participation_pending_year: addDraft.participation_pending_year,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Participación guardada.");
      target.reset();
      setAddDraft(emptyAddDraft);
      setAddingParticipation(false);
      void loadData(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la participación.");
    } finally {
      setBusy(false);
    }
  }
  async function setEmailEnabled(row: Participation, enabled: boolean) {
    setNotice("");
    setState((current) => current ? {
      ...current,
      participations: current.participations.map((item) => item.player_id === row.player_id ? { ...item, participation_email_enabled: enabled } : item),
    } : current);
    try {
      const response = await fetch("/api/participaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-email-enabled", player_id: row.player_id, enabled }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    } catch (error) {
      setState((current) => current ? {
        ...current,
        participations: current.participations.map((item) => item.player_id === row.player_id ? { ...item, participation_email_enabled: row.participation_email_enabled } : item),
      } : current);
      setNotice(error instanceof Error ? error.message : "No se ha podido cambiar el estado del correo.");
    }
  }
  async function saveListFields(row: Participation, targets: ParticipationTarget[], fields: { registration_number?: string; contact_email?: string }) {
    const registration = fields.registration_number?.trim().toUpperCase();
    const contactEmail = fields.contact_email?.trim().toLowerCase();
    const previous = row;
    setNotice("");
    setState((current) => current ? {
      ...current,
      participations: current.participations.map((item) => {
        if (item.player_id !== row.player_id) return item;
        const nextRegistrations = { ...item.participation_registration_numbers };
        if (registration !== undefined) {
          for (const target of targets) {
            delete nextRegistrations[target.year];
            if (registration) nextRegistrations[registrationKey(target)] = registration;
            else delete nextRegistrations[registrationKey(target)];
          }
        }
        return {
          ...item,
          participation_registration_numbers: nextRegistrations,
          contact_email: contactEmail !== undefined ? contactEmail || null : item.contact_email,
        };
      }),
    } : current);
    try {
      const response = await fetch("/api/participaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-list-fields",
          player_id: row.player_id,
          registration_targets: targets,
          ...(registration !== undefined ? { registration_number: registration } : {}),
          ...(contactEmail !== undefined ? { contact_email: contactEmail } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    } catch (error) {
      setState((current) => current ? {
        ...current,
        participations: current.participations.map((item) => item.player_id === previous.player_id ? previous : item),
      } : current);
      setNotice(error instanceof Error ? error.message : "No se han podido guardar los campos editables.");
    }
  }

  return <div className="directory-app">
    {!embedded && <>
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>CTRUGBY - HUB</strong></span></Link><ManagerMenu current="participations"/></header>
    <section className="directory-cover participations-cover">
      <span className="directory-cover-world-rugby"><img src="/ctrugby-player-logo.png" alt="CTRugby" /></span>
      <div className="directory-cover-copy"><p><i className="ctrugby-marker"/><b>CTRugby</b><i/>DIRECTORIO DE PARTICIPACIONES</p><h1>PARTICIPACIONES</h1><span>Jugadores, programas, ediciones y clubes</span></div>
      <div className="directory-cover-actions"><Link href="/jugadores">+Añadir participación</Link></div>
    </section>
    </>}
    <div className="mx-auto max-w-6xl px-5 pb-8 pt-2 sm:px-8">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando participaciones...</p>}
      {state && <>
        <section className="grid grid-cols-4 gap-2 sm:gap-3">
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Ediciones</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.years}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Jugadores</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.players}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Participaciones</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.participations}</b></article>
          <article className="min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:rounded-2xl sm:p-5"><span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">Clubs</span><b className="mt-1 block text-2xl sm:mt-2 sm:text-3xl">{filteredSummary.clubs}</b></article>
        </section>
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <header className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.14em] text-red-700">Filtros</p><h2 className="text-lg font-black text-neutral-900">Tabla campus y año</h2></div><small className="font-bold text-neutral-500">{rows.length} jugador{rows.length === 1 ? "" : "es"}</small></header>
          <div className="directory-filter-toolbar m-0"><label className="player-year-filter player-year-select selected"><select value={campus} onChange={(event) => setCampus(event.target.value)} aria-label="Filtrar por tabla campus"><option value="all">Campus: Todos</option>{campusFilterOptions.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label><label className="player-year-filter player-year-select selected"><select value={selectedYear} onChange={(event) => setYear(event.target.value)} aria-label="Filtrar por año"><option value="all">Año: Todos</option>{campusYearOptions.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}</select></label><label className="player-year-filter player-year-select selected"><select value={gender} onChange={(event) => setGender(event.target.value)} aria-label="Filtrar por masculino o femenino"><option value="all">Género: Todos</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label></div>
        </section>
        {state.admin && <section className="mt-4 rounded-2xl bg-white shadow-sm">
          <header className="federation-directory-title"><div><b>LISTADO FILTRADO</b><small>{displayRows.length} línea{displayRows.length === 1 ? "" : "s"} de participación para este filtro.</small></div><button type="button" onClick={() => setAddingParticipation((current) => !current)} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-700 hover:border-red-200 hover:text-red-700">{addingParticipation ? "Cerrar alta" : "+ Añadir participación"}</button></header>
          <datalist id="participation-player-list">{state.players.map((player) => <option key={player.id} value={`${player.id} - ${player.name}`} />)}</datalist>
          <datalist id="participation-program-list">{state.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</datalist>
          {addingParticipation && <form ref={participationEditorRef} onSubmit={saveParticipation} className="border-y border-neutral-200 bg-neutral-50 p-3">
            <div className="overflow-x-auto">
              <div className="grid min-w-[1850px] grid-cols-[150px_minmax(220px,1fr)_110px_110px_110px_minmax(190px,.8fr)_120px_80px_minmax(130px,.7fr)_minmax(160px,.8fr)_minmax(130px,.7fr)_minmax(220px,1fr)_82px_110px_92px] gap-2 rounded-t-[8px] border border-neutral-200 bg-white px-3 py-2 text-[10px] font-black tracking-[.12em] text-neutral-500">
                <span>ID</span>
                <span>NOMBRE</span>
                <span>SEXO</span>
                <span>AÑO NAC.</span>
                <span>TEMPORADA</span>
                <span>CLUB</span>
                <span>POSICIÓN</span>
                <span>TOTAL</span>
                <span>AÑOS</span>
                <span>CAMPUS</span>
                <span>REGISTRO</span>
                <span>MAIL</span>
                <span>CORREO</span>
                <span>AÑO PEND.</span>
                <span aria-hidden="true" />
              </div>
              <div className="grid min-w-[1850px] grid-cols-[150px_minmax(220px,1fr)_110px_110px_110px_minmax(190px,.8fr)_120px_80px_minmax(130px,.7fr)_minmax(160px,.8fr)_minmax(130px,.7fr)_minmax(220px,1fr)_82px_110px_92px] items-center gap-2 rounded-b-[8px] border-x border-b border-neutral-200 bg-white p-3">
                <input name="player_id" list="participation-player-list" required placeholder="JUG0000" className={inputClass} value={addDraft.player_id} onChange={(event) => fillAddDraftFromPlayer(event.target.value)} onBlur={(event) => fillAddDraftFromPlayer(event.target.value)} />
                <input readOnly value={addDraft.name} placeholder="Nombre" className={`${inputClass} bg-neutral-50 text-neutral-600`} />
                <input readOnly value={addDraft.category} placeholder="Sexo" className={`${inputClass} bg-neutral-50 text-neutral-600`} />
                <input readOnly value={addDraft.birth_year} placeholder="Año" className={`${inputClass} bg-neutral-50 text-neutral-600`} />
                <input name="season_year" placeholder="26/27" className={inputClass} value={addDraft.season_year} onChange={(event) => setSeasonValue(event.target.value)} />
                <select name="club_id" className={inputClass} value={addDraft.club_id} onChange={(event) => setClubValue(event.target.value)}><option value="">Sin club</option>{state.clubOptions.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
                <input readOnly value={addDraft.position} placeholder="Posición" className={`${inputClass} bg-neutral-50 text-neutral-600`} />
                <input name="participation_count" required type="number" min="0" max="99" placeholder="Total" className={inputClass} value={addDraft.participation_count} onChange={(event) => setAddValue("participation_count", event.target.value)} />
                <input name="participation_years" placeholder="2024, 2025" className={inputClass} value={addDraft.participation_years} onChange={(event) => setAddValue("participation_years", event.target.value)} />
                <input name="participation_campus" list="participation-program-list" placeholder="CAM001 o 2024: CAM001" className={inputClass} value={addDraft.participation_campus} onChange={(event) => setAddValue("participation_campus", event.target.value)} />
                <input name="participation_registration_numbers" placeholder="M01 o 2027: M01" className={inputClass} value={addDraft.participation_registration_numbers} onChange={(event) => setAddValue("participation_registration_numbers", event.target.value.toUpperCase())} />
                <input name="contact_email" type="email" placeholder="mail@dominio.com" className={inputClass} value={addDraft.contact_email} onChange={(event) => setAddValue("contact_email", event.target.value)} />
                <button type="button" className={`flex h-10 items-center justify-center rounded-[8px] border ${addDraft.participation_email_enabled ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-300 bg-neutral-100 text-neutral-400"}`} title={addDraft.participation_email_enabled ? "Correo activo" : "Correo desactivado"} aria-pressed={addDraft.participation_email_enabled} onClick={() => setAddValue("participation_email_enabled", !addDraft.participation_email_enabled)}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4Z" /><path d="m4 7 8 6 8-6" /></svg></button>
                <label className="flex h-10 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-xs font-black text-neutral-700"><input name="participation_pending_year" type="checkbox" checked={addDraft.participation_pending_year} onChange={(event) => setAddValue("participation_pending_year", event.target.checked)} /></label>
                <button disabled={busy} className="flex h-10 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-neutral-800 hover:border-red-200 hover:text-red-700 disabled:opacity-60" aria-label="Guardar participación" title="Guardar"><Save size={18} aria-hidden="true" /></button>
              </div>
            </div>
          </form>}
          <div className="overflow-x-auto">
            <div className="grid min-w-[1000px] grid-cols-[112px_52px_minmax(220px,1.2fr)_96px_120px_64px_minmax(220px,1fr)] gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500">
              <button type="button" onClick={() => order("registration")} className="text-left hover:text-red-700">ID {mark("registration")}</button>
              <button type="button" onClick={() => order("photo")} className="text-center hover:text-red-700">FOTO {mark("photo")}</button>
              <button type="button" onClick={() => order("name")} className="text-left hover:text-red-700">NOMBRE {mark("name")}</button>
              <button type="button" onClick={() => order("club")} className="text-left hover:text-red-700">CLUB {mark("club")}</button>
              <button type="button" onClick={() => order("position")} className="text-left hover:text-red-700">POSICIÓN {mark("position")}</button>
              <span className="text-center">CORREO</span>
              <button type="button" onClick={() => order("mail")} className="text-left hover:text-red-700">MAIL {mark("mail")}</button>
            </div>
            <ul className="min-w-[1000px] divide-y divide-neutral-200">{displayRows.map(({ row, target, season, campusLabel }) => {
              const matchingTargets = [target];
              const clubId = season?.club_id ?? row.current_club_id;
              const clubName = season?.club_name ?? row.current_club_name;
              return <li key={`filtered-${row.player_id}-${target.campus}-${target.year}`} className="grid grid-cols-[112px_52px_minmax(220px,1.2fr)_96px_120px_64px_minmax(220px,1fr)] items-center gap-3 px-4 py-3">
              <span className="grid gap-0.5 font-mono"><RegistrationInput row={row} targets={matchingTargets} meta={`${campusLabel} ${target.year.slice(-2)}`} onSave={(item, targets, fields) => void saveListFields(item, targets, fields)} /><Link href={`/jugadores/${row.player_id}`} className="text-xs font-black text-neutral-700 hover:text-red-700">{row.player_id}</Link></span>
              <span className="image-hover-preview flex h-10 w-10 items-center justify-center overflow-visible rounded-full bg-neutral-100 text-xs font-black text-neutral-400">{row.primary_photo_url ? <img src={row.primary_photo_url} alt={`Foto de ${row.display_name}`} className="image-hover-preview-image h-10 w-10 rounded-full object-cover" /> : "—"}</span>
              <span className="min-w-0"><button type="button" className="block max-w-full truncate text-left text-sm font-black hover:text-red-700" onClick={() => openParticipationEditor(row)}>{row.display_name}</button><small className="block truncate text-xs text-neutral-500">{row.category ?? "Sin categoría"}</small></span>
              <span className="image-hover-preview flex h-10 w-12 items-center justify-center">{clubId && clubShieldUrl(clubId) ? <Link href={`/clubs/${clubId}`} title={clubName ?? clubId}><img src={clubShieldUrl(clubId)!} alt={`Escudo de ${clubName ?? clubId}`} className="image-hover-preview-image h-10 w-10 object-contain" /></Link> : <span className="text-xs text-neutral-400">—</span>}</span>
              <span className="text-sm font-bold text-neutral-700">{season?.position_text || selectedPositionLabel(row)}</span>
              <span className="flex justify-center"><button type="button" className={`flex h-9 w-9 items-center justify-center rounded-full border ${row.participation_email_enabled ? "border-red-200 bg-red-50 text-red-700" : "border-neutral-200 bg-neutral-100 text-neutral-400"}`} title={row.participation_email_enabled ? "Correo activo. Desactivar para evitar duplicado." : "Correo desactivado. Activar envío."} aria-label={row.participation_email_enabled ? `Desactivar correo de ${row.display_name}` : `Activar correo de ${row.display_name}`} aria-pressed={row.participation_email_enabled} onClick={() => void setEmailEnabled(row, !row.participation_email_enabled)}><svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4Z" /><path d="m4 7 8 6 8-6" /></svg></button></span>
              <span className="min-w-0"><input className="w-full rounded border border-transparent bg-transparent px-0 text-sm text-neutral-700 outline-none hover:border-neutral-200 focus:border-red-300 focus:bg-white focus:px-2 focus:py-1" type="email" defaultValue={row.contact_email ?? ""} placeholder="—" aria-label={`Mail de ${row.display_name}`} onBlur={(event) => { const value = event.currentTarget.value; if (value !== (row.contact_email ?? "")) void saveListFields(row, matchingTargets, { contact_email: value }); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></span>
            </li>;
            })}</ul>
          </div>
        </section>}
      </>}
    </div>
  </div>;
}
