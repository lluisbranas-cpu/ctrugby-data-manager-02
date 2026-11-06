"use client";

import { DeleteButton } from "@/app/components/delete-button";
import Link from "@/app/components/sport-link";
import { useMemo, useState } from "react";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import { SeasonPhotoEditor } from "./season-photo-editor";
import { Save, Pencil, Plus, X } from "lucide-react";
import { trajectorySeasonYears } from "@/lib/trajectory-season-input";
import styles from "./trajectory-editor.module.css";

export type TrajectorySeason = { season_year: number; club_id: string | null; club_name: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null; season_photo_url?: string | null; season_photo_primary?: boolean; playing_category?: string | null; competition_category?: string | null };
type Club = { id: string; name: string };
type Draft = { season_year: string; club_id: string; club_query: string; legacy_club_name: string; position_text: string; weight_kg: string; height_cm: string; playing_category: string; competition_category: string };
const label = (year: number) => `${String(year - 1).slice(-2)}/${String(year).slice(-2)}`;
const draftOf = (season: TrajectorySeason): Draft => ({ season_year: label(season.season_year), club_id: season.club_id ?? "", club_query: season.club_name ?? season.legacy_club_name ?? "", legacy_club_name: season.legacy_club_name ?? (season.club_id ? "" : season.club_name ?? ""), position_text: season.position_text ?? "", weight_kg: season.weight_kg == null ? "" : String(season.weight_kg), height_cm: season.height_cm == null ? "" : String(season.height_cm), competition_category: season.competition_category ?? "", playing_category: season.playing_category ?? "" });
const emptyDraft = (): Draft => ({ season_year: "", club_id: "", club_query: "", legacy_club_name: "", position_text: "", weight_kg: "", height_cm: "", competition_category: "", playing_category: "" });
const seasonEndYear = (value: string) => trajectorySeasonYears(value).at(-1) ?? Number.NaN;

export function PlayerTrajectory({ id, seasons, birthYear, admin, clubs, professionalCategories = [], published, version, onSaved }: { id: string; seasons: TrajectorySeason[]; birthYear: number | null; admin: boolean; clubs: Club[]; professionalCategories?: string[]; published: boolean; version: number; onSaved?: (seasons: TrajectorySeason[]) => void }) {
  const [rows, setRows] = useState(seasons);
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isPublished, setIsPublished] = useState(published);
  const [publicationVersion, setPublicationVersion] = useState(version);
  const [showFull, setShowFull] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ year: number; file: File } | null>(null);
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [seasonDraft, setSeasonDraft] = useState<Draft | null>(null);
  const clubsByName = useMemo(() => [...clubs].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })), [clubs]);
  const grouped = useMemo(() => {
    const result: { name: string; years: number[]; season: TrajectorySeason }[] = [];
    [...rows].sort((a, b) => b.season_year - a.season_year).forEach((season) => {
      const name = season.club_name ?? season.legacy_club_name ?? "Sin club";
      const previous = result.at(-1);
      if (previous && previous.name === name) previous.years.push(season.season_year);
      else result.push({ name, years: [season.season_year], season });
    });
    return result;
  }, [rows]);
  const primaryPhotoYear = useMemo(() => {
    const explicitlySelected = rows.find((season) => season.season_photo_primary && season.season_photo_url);
    if (explicitlySelected) return explicitlySelected.season_year;
    return [...rows].filter((season) => season.season_photo_url).sort((left, right) => right.season_year - left.season_year)[0]?.season_year ?? null;
  }, [rows]);
  const update = (index: number, key: keyof Draft, value: string) => setDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  const updateClub = (index: number, value: string) => setDrafts((current) => current.map((row, rowIndex) => {
    if (rowIndex !== index) return row;
    const selected = clubsByName.find((club) => club.name.localeCompare(value, "es", { sensitivity: "base" }) === 0);
    return { ...row, club_query: value, club_id: selected?.id ?? "" };
  }));
  const save = async () => {
    const enteredDrafts = drafts.filter((row) => Object.values(row).some((value) => value.trim()));
    if (!enteredDrafts.length) { setNotice("Completa los datos de la nueva temporada antes de guardar."); return; }
    if (enteredDrafts.some((row) => !row.season_year.trim())) { setNotice("Completa la temporada de cada fila añadida antes de guardar."); return; }
    if (enteredDrafts.some((row) => !trajectorySeasonYears(row.season_year).length)) { setNotice("Indica una temporada o periodo válido, por ejemplo 26/27 o 23-27."); return; }
    const parsed = enteredDrafts.flatMap((row) => trajectorySeasonYears(row.season_year).map((year) => ({
      season_year: year, club_id: row.club_id || null, legacy_club_name: row.club_id ? null : row.legacy_club_name || row.club_query,
      position_text: row.position_text, weight_kg: row.weight_kg === "" ? null : Number(row.weight_kg), height_cm: row.height_cm === "" ? null : Number(row.height_cm),
      playing_category: row.playing_category.trim() || null, competition_category: row.competition_category.trim() || null,
    })));
    if (parsed.some((row) => !Number.isInteger(row.season_year) || row.season_year < 2000 || row.season_year > 2035) || new Set(parsed.map((row) => row.season_year)).size !== parsed.length) { setNotice("Indica una temporada única, por ejemplo 26/27, en cada fila."); return; }
    if (parsed.some((season) => rows.some((existing) => existing.season_year === season.season_year))) { setNotice("Esta temporada ya existe. Utiliza su opción de editar."); return; }
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasons: [...rows, ...parsed] }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const nextRows = (data.seasons as TrajectorySeason[]).map((season) => { const previous = rows.find((row) => row.season_year === season.season_year); return { ...season, season_photo_url: previous?.season_photo_url, season_photo_primary: previous?.season_photo_primary }; });
      setRows(nextRows); setDrafts([]); setOpen(false); onSaved?.(nextRows); setNotice("Nueva temporada guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar la trayectoria."); }
    finally { setSaving(false); }
  };
  const addSeason = () => {
    setEditingYear(null); setSeasonDraft(null);
    setOpen(true);
    const nextIndex = 0;
    setDrafts([emptyDraft()]);
    setNotice("");
    window.setTimeout(() => { const input = document.getElementById(`trajectory-season-${nextIndex}`); input?.scrollIntoView({ block: "center", behavior: "smooth" }); input?.focus({ preventScroll: true }); }, 0);
  };
  const editSeason = (season: TrajectorySeason) => {
    setOpen(false); setEditingYear(season.season_year); setSeasonDraft(draftOf(season)); setNotice("");
  };
  const saveSeason = async () => {
    if (!seasonDraft || editingYear === null) return;
    const metric = (value: string) => value.trim() === "" ? null : Number(value);
    const weight = metric(seasonDraft.weight_kg); const height = metric(seasonDraft.height_cm);
    if ([weight, height].some((value) => value !== null && (!Number.isFinite(value) || value <= 0 || value > 250))) { setNotice("Indica un peso y una altura válidos."); return; }
    const edited = { season_year: editingYear, club_id: seasonDraft.club_id || null, legacy_club_name: seasonDraft.club_id ? null : seasonDraft.legacy_club_name || seasonDraft.club_query, position_text: seasonDraft.position_text, weight_kg: weight, height_cm: height, competition_category: seasonDraft.competition_category.trim() || null, playing_category: seasonDraft.playing_category.trim() || null };
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season: edited }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const nextRows = (data.seasons as TrajectorySeason[]).map((season) => { const previous = rows.find((row) => row.season_year === season.season_year); return { ...season, season_photo_url: previous?.season_photo_url, season_photo_primary: previous?.season_photo_primary }; });
      setRows(nextRows);
      setDrafts((current) => current.map((draft) => seasonEndYear(draft.season_year) === editingYear ? draftOf(nextRows.find((season) => season.season_year === editingYear)!) : draft));
      onSaved?.(nextRows); setEditingYear(null); setSeasonDraft(null); setNotice(`Temporada ${label(editingYear)} guardada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar la temporada."); }
    finally { setSaving(false); }
  };
  const deleteSeason = async (year: number) => {
    const season = rows.find((row) => row.season_year === year);
    if (!season) return;
    if (!window.confirm(`Eliminar la temporada ${label(year)} de la trayectoria?`)) return;
    setSaving(true); setNotice("");
    const nextPayload = rows.filter((row) => row.season_year !== year).map((row) => ({
      season_year: row.season_year,
      club_id: row.club_id,
      legacy_club_name: row.club_id ? null : row.legacy_club_name ?? row.club_name,
      position_text: row.position_text,
      weight_kg: row.weight_kg,
      height_cm: row.height_cm,
      playing_category: row.playing_category ?? null, competition_category: row.competition_category ?? null,
    }));
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seasons: nextPayload }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const nextRows = (data.seasons as TrajectorySeason[]).map((item) => { const previous = rows.find((row) => row.season_year === item.season_year); return { ...item, season_photo_url: previous?.season_photo_url, season_photo_primary: previous?.season_photo_primary }; });
      setRows(nextRows); onSaved?.(nextRows);
      if (editingYear === year) { setEditingYear(null); setSeasonDraft(null); }
      setNotice(`Temporada ${label(year)} eliminada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la temporada."); }
    finally { setSaving(false); }
  };
  const importPreparedHistory = async () => {
    setImporting(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores/importar-historial-local", { method: "POST" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setNotice(`Importadas ${data.seasons} temporadas y ${data.photos} fotos. Recarga la ficha para verlas.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido importar la preparación local."); }
    finally { setImporting(false); }
  };
  const uploadSeasonPhoto = async (year: number, file: File, prepared: Blob) => {
    setSaving(true); setNotice("");
    try {
      const form = new FormData(); form.set("file", file); form.set("prepared", prepared, "portrait.png");
      const response = await fetch(`/api/jugadores/foto/${id}?season=${year}`, { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRows((current) => current.map((season) => season.season_year === year ? { ...season, season_photo_url: data.url } : season));
      setNotice(`Foto de ${label(year)} preparada y guardada.`);
      setPendingPhoto(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar la foto de la temporada."); throw error; }
    finally { setSaving(false); }
  };
  const makePrimarySeasonPhoto = async (year: number) => {
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/jugadores/foto/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ season: String(year) }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRows((current) => current.map((season) => ({ ...season, season_photo_primary: season.season_year === year })));
      setNotice(`La foto de ${label(year)} es ahora la principal.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido marcar la foto principal."); }
    finally { setSaving(false); }
  };
  const deleteSeasonPhoto = async (year: number) => {
    setSaving(true); setNotice("");
    try {
      const response = await fetch(`/api/jugadores/foto/${id}?season=${year}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setRows((current) => current.map((season) => season.season_year === year ? { ...season, season_photo_url: null, season_photo_primary: false } : season));
      setNotice(`Foto de ${label(year)} eliminada.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido eliminar la foto de la temporada."); }
    finally { setSaving(false); }
  };
  const changePublication = async () => {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/jugadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-publication", id, published: !isPublished, version: publicationVersion }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setIsPublished((current) => !current); setPublicationVersion((current) => current + 1); setNotice(!isPublished ? "Ficha y trayectoria publicadas." : "Ficha y trayectoria retiradas de la vista pública.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido cambiar la publicación."); }
    finally { setSaving(false); }
  };
  const groupLabel = (years: number[]) => {
    const ordered = [...years].sort((a, b) => a - b);
    return ordered.length === 1 ? label(ordered[0]) : `${label(ordered[0])} – ${label(ordered.at(-1)!)}`;
  };
  const competitionLabel = (years: number[]) => [...new Set(years.map((year) => rows.find((row) => row.season_year === year)?.competition_category).filter(Boolean))].join(" / ");
  const categoryLabel = (years: number[]) => {
    const categories = [...new Set(years.map((year) => rows.find((row) => row.season_year === year)?.playing_category).filter(Boolean))];
    if (categories.length) return categories.join(" / ");
    if (!birthYear) return "";
    const ages = years.map((year) => year - birthYear).filter((age) => age > 0);
    return ages.length ? `${Math.min(...ages)}${Math.max(...ages) !== Math.min(...ages) ? `-${Math.max(...ages)}` : ""} años` : "";
  };
  const categoryDetails = (years: number[]) => <><span className={styles.categoryItem}><span className={styles.categoryCaption}>Categoría</span><span>{years.map((year) => rows.find((row) => row.season_year === year)?.playing_category).some(Boolean) ? categoryLabel(years) : "Sin registrar"}</span></span><span className={styles.categoryItem}><span className={styles.categoryCaption}>Categoría profesional</span><span>{competitionLabel(years) || "Sin registrar"}</span></span></>;
  const arrow = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  const trajectoryIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 18-7-7 18-2.7-7.3L3 10Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><path d="m11.3 13.7 3.4-3.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
  const photoControl = (year: number) => { const season = rows.find((item) => item.season_year === year); return <span className="trajectory-row-photo">{season?.season_photo_url ? <img src={season.season_photo_url} alt={`Foto de ${label(year)}`} /> : <span className="trajectory-photo-placeholder" aria-label="Foto pendiente" />}<button type="button" disabled={!season?.season_photo_url || saving} className={primaryPhotoYear === year ? "trajectory-photo-star active" : "trajectory-photo-star"} onClick={() => void makePrimarySeasonPhoto(year)} aria-label={`Usar la foto de ${label(year)} como principal`}>★</button>{season?.season_photo_url && <DeleteButton type="button" className="trajectory-photo-delete" disabled={saving} onClick={() => void deleteSeasonPhoto(year)} aria-label={`Eliminar la foto de ${label(year)}`} title="Eliminar foto" />}<label className="catalog-logout">{saving ? "Preparando…" : season?.season_photo_url ? "Cambiar foto" : "Añadir foto"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) setPendingPhoto({ year, file }); }} /></label></span>; };
  const draftFields = (row: Draft, index: number, inline = false) => {
    const suffix = inline ? `de ${label(editingYear!)}` : String(index + 1);
    const setValue = (key: keyof Draft, value: string) => inline ? setSeasonDraft((current) => current ? { ...current, [key]: value } : current) : update(index, key, value);
    const setClub = (value: string) => {
      if (!inline) { updateClub(index, value); return; }
      const selected = clubsByName.find((club) => club.name.localeCompare(value, "es", { sensitivity: "base" }) === 0);
      setSeasonDraft((current) => current ? { ...current, club_query: value, club_id: selected?.id ?? "" } : current);
    };
    return <div className={styles.fields}>
      <label>Temporada<input id={inline ? `trajectory-inline-season-${editingYear}` : `trajectory-season-${index}`} aria-label={`Temporada ${suffix}`} readOnly={inline} placeholder="26/27 o 23-27" value={row.season_year} onChange={(event) => setValue("season_year", event.target.value)} /></label>
      <label>Club<input list="trajectory-clubs" aria-label={`Club ${suffix}`} value={row.club_query} onChange={(event) => setClub(event.target.value)} /></label>
      <label>Club no catalogado<input aria-label={`Club no catalogado ${suffix}`} disabled={Boolean(row.club_id)} value={row.legacy_club_name} onChange={(event) => setValue("legacy_club_name", event.target.value)} /></label>
      <label>Categoría<input list="trajectory-categories" id={inline ? `trajectory-inline-category-${editingYear}` : undefined} aria-label={`Categoría ${suffix}`} maxLength={40} placeholder="S14, S16, Sénior..." value={row.playing_category} onChange={(event) => setValue("playing_category", event.target.value)} /></label>
      <label>Categoría profesional<input list="trajectory-professional-categories" aria-label={`Categoría profesional ${suffix}`} maxLength={240} placeholder="DHA, Top 14, academia..." value={row.competition_category} onChange={(event) => setValue("competition_category", event.target.value)} /></label>
      <label>Posición<input aria-label={`Posición ${suffix}`} value={row.position_text} onChange={(event) => setValue("position_text", event.target.value)} /></label>
      <label>Peso (kg)<input aria-label={`Peso ${suffix}`} inputMode="decimal" value={row.weight_kg} onChange={(event) => setValue("weight_kg", event.target.value)} /></label>
      <label>Altura (cm)<input aria-label={`Altura ${suffix}`} inputMode="decimal" value={row.height_cm} onChange={(event) => setValue("height_cm", event.target.value)} /></label>
      {Number.isInteger(seasonEndYear(row.season_year)) && rows.some((season) => season.season_year === seasonEndYear(row.season_year)) ? photoControl(seasonEndYear(row.season_year)) : null}
      {!inline && <DeleteButton type="button" className="text-left text-red-700" onClick={() => setDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label="Eliminar temporada" />}
    </div>;
  };
  return <article className={`club-record-card player-profile-history ${styles.history}`}>
    {admin && <><datalist id="trajectory-professional-categories">{professionalCategories.map((category) => <option key={category} value={category} />)}</datalist><datalist id="trajectory-clubs">{clubsByName.map((club) => <option key={club.id} value={club.name} />)}</datalist><datalist id="trajectory-categories">{["S6", "S8", "S10", "S12", "S14", "S16", "S18", "S19", "S23", "Sénior"].map((category) => <option key={category} value={category} />)}</datalist></>}
    {pendingPhoto && <SeasonPhotoEditor file={pendingPhoto.file} season={label(pendingPhoto.year)} onClose={() => setPendingPhoto(null)} onSave={(prepared) => uploadSeasonPhoto(pendingPhoto.year, pendingPhoto.file, prepared)} />}
    <div className={styles.heading}><h2><span className="trajectory-title-icon">{trajectoryIcon}</span>TRAYECTORIA</h2></div>
    {grouped.length ? <ul className="trajectory-highlights">{grouped.slice(0, 3).map((group) => <li key={`${group.name}-${group.years[0]}`}><div className="trajectory-period"><b>{groupLabel(group.years)}</b><small className={styles.categoryDetails}>{categoryDetails(group.years)}</small></div><span className={`trajectory-star${primaryPhotoYear === group.season.season_year ? " current" : ""}`}>★</span>{group.season.season_photo_url ? <img className="trajectory-player-photo" src={group.season.season_photo_url} alt={`Foto de ${groupLabel(group.years)}`} /> : <span className="trajectory-player-photo trajectory-player-photo-empty" aria-label="Foto de temporada pendiente" />}<span className="trajectory-club"><>{group.season.club_id && clubShieldUrl(group.season.club_id) ? <img src={clubShieldUrl(group.season.club_id)!} alt="" /> : null}</>{group.season.club_id ? <Link href={`/clubs/${group.season.club_id}`}>{group.name}</Link> : <b>{group.name}</b>}{rugbyPositionLabel(group.season.position_text) && <small>{rugbyPositionLabel(group.season.position_text)}</small>}</span><span className="trajectory-arrow">{arrow}</span></li>)}</ul> : <p>Sin temporadas registradas.</p>}
    {rows.length > 0 && <section className="trajectory-complete"><button type="button" onClick={() => setShowFull((current) => !current)}>{showFull ? "Ocultar trayectoria completa" : "Ver trayectoria completa"}{arrow}</button>{showFull && <ul>{[...rows].sort((a, b) => b.season_year - a.season_year).map((season) => <li key={season.season_year} className={admin ? styles.editableRow : undefined}>
      <b>{label(season.season_year)}</b><small className={styles.categoryDetails}>{categoryDetails([season.season_year])}</small>
      {season.season_photo_url ? <img className="trajectory-season-photo" src={season.season_photo_url} alt={`Foto de ${label(season.season_year)}`} /> : <i className="trajectory-season-photo-placeholder" />}
      {season.club_id && clubShieldUrl(season.club_id) ? <img className="trajectory-club-shield" src={clubShieldUrl(season.club_id)!} alt="" /> : <i className="trajectory-club-shield-placeholder" />}
      {season.club_id ? <Link href={`/clubs/${season.club_id}`}>{season.club_name}</Link> : <strong>{season.club_name ?? season.legacy_club_name ?? "Sin club"}</strong>}
      {admin && <span className={styles.rowActions}><button type="button" className={styles.rowEdit} title={`Editar temporada ${label(season.season_year)}`} aria-label={`Editar temporada ${label(season.season_year)}`} aria-expanded={editingYear === season.season_year} disabled={saving || importing} onClick={() => editSeason(season)}><Pencil size={15} /></button><DeleteButton type="button" className={styles.rowDelete} title={`Eliminar temporada ${label(season.season_year)}`} aria-label={`Eliminar temporada ${label(season.season_year)}`} disabled={saving || importing} onClick={() => void deleteSeason(season.season_year)} confirmationHandled /></span>}
      {admin && editingYear === season.season_year && seasonDraft && <div className={styles.inlineEditor} aria-label={`Editar temporada ${label(season.season_year)}`}>
        <fieldset disabled={saving || importing} className="border-0 p-0">{draftFields(seasonDraft, 0, true)}</fieldset>
        <div className={styles.actions}><button type="button" className={styles.rowSave} disabled={saving || importing} aria-label="Guardar temporada" title="Guardar temporada" onClick={() => void saveSeason()}><Save size={16} aria-hidden="true" />{saving ? "Guardando..." : "Guardar temporada"}</button><button type="button" className={styles.rowCancel} disabled={saving} aria-label="Salir sin guardar la temporada" title="Salir sin guardar" onClick={() => { setEditingYear(null); setSeasonDraft(null); setNotice(""); }}><X size={16} />Cancelar</button></div>
      </div>}
    </li>)}</ul>}</section>}
    {admin && <button type="button" className={styles.add} disabled={saving || importing || open} onClick={addSeason}><Plus size={16} />Añadir temporada</button>}
    {admin && open && <section id="trajectory-editor" className={styles.editor} aria-label="Añadir temporada">
      <fieldset disabled={saving || importing} className="border-0 p-0">
      {drafts.map((row, index) => <div key={index}>{draftFields(row, index)}</div>)}
      </fieldset>
      <div className={styles.actions}><button type="button" className="catalog-menu-button" disabled={saving || importing} onClick={() => void save()}><Save size={16} aria-hidden="true" />{saving ? "Guardando..." : "Guardar temporada"}</button><button type="button" className="catalog-logout" disabled={saving || importing} onClick={() => { setOpen(false); setDrafts([]); setNotice(""); }} aria-label="Salir sin guardar la temporada" title="Salir sin guardar"><X size={16} aria-hidden="true" />Cancelar</button><button type="button" className="catalog-logout" disabled={saving || importing} onClick={() => void changePublication()}>{isPublished ? "Retirar ficha" : "Publicar ficha y trayectoria"}</button><button type="button" className="catalog-logout" disabled={importing || saving} onClick={() => void importPreparedHistory()}>{importing ? "Importando..." : "Importar todas las trayectorias y fotos"}</button></div>
    </section>}
    {notice && <p className="mt-3 text-sm" role="status">{notice}</p>}
  </article>;
}
