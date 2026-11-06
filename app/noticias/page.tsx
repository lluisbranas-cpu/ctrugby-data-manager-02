"use client";
import { campusParticipationTitle } from "@/app/lib/campus-title";
import Link from "@/app/components/sport-link";
import { groupSearchNames, type ClubGroupMembership } from "@/app/lib/club-group-membership";
import { callupDefaultImage } from "@/lib/callup-default-image";
import Image from "next/image";
import { Check, X, ImagePlus, Plus, ExternalLink, Save, Pencil, Trash2 } from "lucide-react";
import styles from "./news-table.module.css";
import { sortNewsRows, type NewsSort, type NewsSortKey } from "./news-table-sort";
import { useEffect, useRef, useState } from "react";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { ClubPicker, SearchablePicker } from "@/app/components/club-picker";
import { ClubFinderMap } from "@/app/components/club-finder-map";
import { ManagerMenu } from "@/app/components/manager-menu";
import type { PlayerNews } from "@/lib/player-news";

type Federation = {id: string; name: string; scope: string | null; active?: boolean};
type Player = { club_groups?: ClubGroupMembership[]; id: string; name: string };
type Club = {id: string; name: string; city?: string | null; province?: string | null; region?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null; maps_url?: string | null; active?: boolean | null};
type Campus = {id: string; label: string};
type Category = {id: string; label: string; image_url?: string | null; image_updated_at?: string | null};
type State = { configured: boolean; admin: boolean; news: PlayerNews[]; players: Player[]; federations: Federation[]; clubs: Club[]; categories: Category[]; campuses: Campus[] };
type Draft = { type: "noticia" | "seleccion" | "participacion"; player_id: string; player_search: string; date_or_season: string; title: string; url: string; federation_id: string; category: string; format: string; gender: string; event: string; scope: string; selection_club: string; position_text: string; selection_notes: string; participation_category: string; club_id: string; club_category: string; participation_notes: string; participation_kind: string; campus_id: string; campus_year: string; campus_registration: string; campus_count: string; campus_email: string; amount_paid: string };
const inputClass = styles.input;
const genderLabel = (value?: string) => value === "masculino" ? "Masculino" : value === "femenino" ? "Femenino" : value === "mixto" ? "Mixto" : "—";
const searchText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
function sourceLabel(value: string) {try {return new URL(value).hostname.replace(/^www\./, "");} catch {return value;}}
const emptyDraft = (): Draft => ({type: "noticia", player_id: "", player_search: "", date_or_season: "", title: "", url: "", federation_id: "", category: "", format: "", gender: "", event: "", scope: "", selection_club: "", position_text: "", selection_notes: "", participation_category: "", club_id: "", club_category: "", participation_notes: "", participation_kind: "campus", campus_id: "CAM001", campus_year: "", campus_registration: "", campus_count: "1", campus_email: "true", amount_paid: ""});
const draftFromRecord = (record: PlayerNews, players: Player[]): Draft => ({type: record.type ?? "noticia", player_id: record.player_id, player_search: record.player_id + " - " + (players.find(player => player.id === record.player_id)?.name || record.player_id), date_or_season: record.date_or_season, title: record.title, url: record.url, federation_id: record.selection?.federation_id || "", category: record.selection?.category || "", format: record.selection?.format || "", gender: record.selection?.gender || "", event: record.selection?.event || "", scope: record.selection?.scope || "", selection_club: record.selection?.club_text || "", position_text: record.selection?.position_text || "", selection_notes: record.selection?.notes || "", participation_category: record.participation?.category || "", club_id: record.participation?.club_id || "", club_category: record.participation?.club_category || "", participation_notes: record.participation?.notes || "", participation_kind: record.participation?.kind || "club", campus_id: record.participation?.campus_id || "CAM001", campus_year: record.participation?.year || "", campus_registration: record.participation?.registration_number || "", campus_count: String(record.participation?.count ?? 1), campus_email: String(record.participation?.email_enabled !== false), amount_paid: record.participation?.amount_paid === null || record.participation?.amount_paid === undefined ? "" : String(record.participation.amount_paid)});
function CampusClubBadges({record, clubId, clubName}: {record: PlayerNews; clubId?: string; clubName?: string}) {
  const club = clubId ?? record.participation?.club_id;
  const shield = club ? clubShieldUrl(club) : null;
  const name = clubName || record.participation?.club_name || "Club";
  return <div className={styles.participationBadges}>
    <Link href="/campus" title="Escudo del campus"><Image unoptimized src={record.image_url || "/ctrugby-player-logo.png"} alt="Escudo del campus" width={40} height={44} /></Link>
    {club && shield && <Link href={"/clubs/" + encodeURIComponent(club)} title={name}><Image key={club} unoptimized src={shield} alt={"Escudo de " + name} width={40} height={44} onError={event => {event.currentTarget.style.display = "none";}} /></Link>}
  </div>;
}
function NewsRow({ record, players, federations, clubs, categories, campuses, onSaved, onDeleted, onClose, defaultType = "noticia" }: { record?: PlayerNews; players: Player[]; federations: Federation[]; clubs: Club[]; categories: Category[]; campuses: Campus[]; defaultType?: "noticia" | "seleccion" | "participacion"; onSaved: (record: PlayerNews) => void; onDeleted?: (id: string) => void; onClose?: () => void }) {
  const empty = (): Draft => ({...emptyDraft(), type: defaultType});
  const [draft, setDraft] = useState<Draft>(record ? draftFromRecord(record, players) : empty());
  const isCampus = draft.type === "participacion" && draft.participation_kind === "campus";
  const automaticTitle = campusParticipationTitle(campuses.find(campus => campus.id === draft.campus_id)?.label || draft.campus_id || "Campus", draft.campus_year);
  const [rowEditing, setRowEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");
  const newImageInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!newImage) {
      const update = window.setTimeout(() => setNewImagePreview(""), 0);
      return () => window.clearTimeout(update);
    }
    const reader = new FileReader();
    reader.onload = () => setNewImagePreview(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setNotice("No se ha podido leer la imagen seleccionada. Vuelve a elegir el archivo.");
    reader.readAsDataURL(newImage);
    return () => { reader.onload = null; reader.onerror = null; if (reader.readyState === FileReader.LOADING) reader.abort(); };
  }, [newImage]);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveFailed = useRef(false);
  const field = (key: keyof Draft, value: string) => setDraft((previous) => ({ ...previous, [key]: value }));
  function selectPlayer(value: string) {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
    const id = value.trim().match(/^JUG\d{4}\b/i)?.[0].toUpperCase();
    const matches = players.filter(player => id ? player.id === id : normalize(player.name) === normalize(value));
    setDraft(previous => ({...previous, player_search: value, player_id: matches.length === 1 ? matches[0].id : ""}));
  }
  const name = record ? players.find((player) => player.id === record.player_id)?.name ?? record.player_id : "nueva noticia";
  function save(automatic = false) {
    const snapshot = { ...draft };
    if (!snapshot.player_id) {setNotice("Selecciona un jugador de las sugerencias por nombre o ID."); return Promise.resolve();}
    if (snapshot.type === "seleccion" && (!snapshot.federation_id || !snapshot.format)) {setNotice("Completa selección y modalidad para guardar la convocatoria."); return Promise.resolve();}
    if (snapshot.type === "participacion" && snapshot.participation_kind !== "campus" && !snapshot.participation_category) {setNotice("Selecciona categoría deportiva."); return Promise.resolve();}
    const operation = async () => {
      if (!automatic) setBusy(true);
      setNotice("Guardando…"); saveFailed.current = false;
      try {
        const response = await fetch("/api/noticias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...snapshot, title: snapshot.type === "participacion" && snapshot.participation_kind === "campus" ? campusParticipationTitle(campuses.find(campus => campus.id === snapshot.campus_id)?.label || snapshot.campus_id, snapshot.campus_year) : snapshot.title, participation: snapshot.type === "participacion" ? {...(snapshot.participation_kind === "campus" ? {kind: "campus", campus_id: snapshot.campus_id, year: snapshot.campus_year.trim() || null, pending_year: !snapshot.campus_year.trim(), registration_number: snapshot.campus_registration, count: !snapshot.campus_year.trim() ? Number(snapshot.campus_count) : 1, email_enabled: snapshot.campus_email === "true"} : {kind: "club"}), amount_paid: snapshot.amount_paid.trim() === "" ? null : Number(snapshot.amount_paid), category: snapshot.participation_category, club_id: snapshot.club_id, club_name: clubs.find(club => club.id === snapshot.club_id)?.name || "", club_category: snapshot.club_category, notes: snapshot.participation_notes} : null, selection: snapshot.type === "seleccion" ? {federation_id: snapshot.federation_id, category: snapshot.category, format: snapshot.format, gender: snapshot.gender, event: snapshot.event, scope: snapshot.scope || null, club_text: snapshot.selection_club || null, position_text: snapshot.position_text || null, notes: snapshot.selection_notes || null} : null, ...(record ? { id: record.id } : {}) }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        let savedRecord: PlayerNews = data.news;
        let message = "Guardado.";
        if (newImage && snapshot.type !== "participacion") {
          try {
            const form = new FormData(); form.set("file", newImage);
            const response = await fetch("/api/noticias/" + savedRecord.id + "/imagen", {method: "POST", body: form});
            const imageData = await response.json(); if (!response.ok) throw new Error(imageData.error);
            savedRecord = imageData.news; message = "Registro e imagen destacada guardados.";
          } catch (reason) {message = "Registro guardado. " + (reason instanceof Error ? reason.message : "No se ha podido subir la imagen.") + " Puedes añadirla desde el listado.";}
        }
        onSaved(savedRecord);
        setDraft((current) => JSON.stringify(current) !== JSON.stringify(snapshot) ? current : record ? draftFromRecord(data.news, players) : empty());
        if (!record) {setNewImage(null); if (newImageInput.current) newImageInput.current.value = "";}
        setNotice(message);
      } catch (reason) { saveFailed.current = true; setNotice(reason instanceof Error ? reason.message : "No se ha podido guardar. Revisa el campo y vuelve a salir de él."); }
      finally { if (!automatic) setBusy(false); }
    };
    saveQueue.current = saveQueue.current.then(operation, operation);
    return saveQueue.current;
  }
  function autoSave() {
    if (record && (Object.keys(draft) as (keyof Draft)[]).some((key) => draft[key] !== draftFromRecord(record, players)[key])) void save(true);
  }
  async function toggleStatus() {
    if (!record) return;
    if (draft.type === "seleccion" && (!draft.federation_id || !draft.format)) {setNotice("Completa los campos de selección antes de publicar."); return;}
    await saveQueue.current;
    if (saveFailed.current) {setNotice("Revisa y guarda los cambios antes de continuar."); return;}
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/noticias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set-status", id: record.id, published: !record.published }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      onSaved(data.news); setNotice(data.news.published ? "Noticia publicada." : "Noticia pendiente de revisión.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se ha podido cambiar el estado."); }
    finally { setBusy(false); }
  }
  async function removeRecord() {
    if (!record || busy) return;
    await saveQueue.current;
    if (!window.confirm("¿Deseas eliminar este registro de " + name + "?\n\n" + record.title)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/noticias", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "delete", id: record.id})});
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se ha podido eliminar.");
      onDeleted?.(record.id);
    } catch (reason) {setNotice(reason instanceof Error ? reason.message : "No se ha podido eliminar el registro.");}
    finally {setBusy(false);}
  }
  const deleteButton = record ? <button type="button" disabled={busy} className={styles.icon + " " + styles.deleteRecord} onClick={() => void removeRecord()} title="Eliminar registro" aria-label={"Eliminar registro de " + name}><Trash2 size={17} /></button> : null;
  async function uploadImage(file: File) {
    if (!record) return;
    if (!file.size || file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {setNotice("Elige una imagen JPG, PNG o WebP de hasta 8 MB."); return;}
    setNewImage(file);
    await saveQueue.current;
    setBusy(true); setNotice("Subiendo imagen…");
    try {
      const form = new FormData(); form.set("file", file);
      const response = await fetch("/api/noticias/" + record.id + "/imagen", { method: "POST", body: form });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      onSaved(data.news); setNewImage(null); setNotice("Imagen destacada guardada.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "No se ha podido subir la imagen."); }
    finally { setBusy(false); }
  }
  const selectionFields = <fieldset disabled={busy} className={styles.selectionFields}><legend>Datos de la convocatoria</legend>
<label>Selección / federación *<select className={inputClass} aria-label={"Selección o federación de " + name} value={draft.federation_id} onChange={event => field("federation_id", event.target.value)} onBlur={autoSave}><option value="">Selecciona federación</option>{federations.filter(item => item.active !== false || item.id === draft.federation_id).map(item => <option key={item.id} value={item.id}>{item.name} · {item.scope || item.id}</option>)}</select></label>
<label>Categoría<input className={inputClass} list="news-selection-categories" maxLength={100} placeholder="S18, M20, absoluta…" value={draft.category} onChange={event => field("category", event.target.value)} onBlur={autoSave} /></label>
<label>Modalidad *<select className={inputClass} value={draft.format} onChange={event => field("format", event.target.value)} onBlur={autoSave}><option value="">Selecciona</option><option value="XV">XV</option><option value="7s">7</option></select></label>
<label>Género<select className={inputClass} value={draft.gender} onChange={event => field("gender", event.target.value)} onBlur={autoSave}><option value="">Selecciona</option><option value="masculino">Masculino</option><option value="femenino">Femenino</option><option value="mixto">Mixto</option></select></label>
<label>Evento (opcional)<input className={inputClass} maxLength={240} placeholder="Europeo, concentración, torneo…" value={draft.event} onChange={event => field("event", event.target.value)} onBlur={autoSave} /></label>
<label>Ámbito<input className={inputClass} maxLength={80} value={draft.scope} onChange={event => field("scope", event.target.value)} onBlur={autoSave} /></label>
<label>Club de origen<input className={inputClass} maxLength={160} value={draft.selection_club} onChange={event => field("selection_club", event.target.value)} onBlur={autoSave} /></label>
<label>Posición<input className={inputClass} maxLength={240} value={draft.position_text} onChange={event => field("position_text", event.target.value)} onBlur={autoSave} /></label>
<label>Notas / resumen<textarea className={inputClass} maxLength={2000} value={draft.selection_notes} onChange={event => field("selection_notes", event.target.value)} onBlur={autoSave} /></label>
</fieldset>;
  const participationFields = <fieldset disabled={busy} className={`${styles.selectionFields} ${styles.participationFields}`}><legend>Datos de la participación</legend>
    <label>Tipo de participación<select className={inputClass} value={draft.participation_kind} onChange={event => field("participation_kind", event.target.value)} onBlur={autoSave}><option value="campus">Campus</option><option value="club">Club / competición</option></select></label>
    {draft.participation_kind === "campus" && <>
      <label>Campus *<select className={inputClass} value={draft.campus_id} onChange={event => field("campus_id", event.target.value)} onBlur={autoSave}><option value="">Selecciona campus</option>{campuses.map(campus => <option key={campus.id} value={campus.id}>{campus.label}</option>)}</select></label>
      <label>Año de edición<input className={inputClass} inputMode="numeric" maxLength={4} placeholder="2026" value={draft.campus_year} onChange={event => field("campus_year", event.target.value)} onBlur={autoSave} /></label>
      {!record && <label>Número de registro<input className={inputClass} maxLength={24} value={draft.campus_registration} onChange={event => field("campus_registration", event.target.value)} /></label>}
      {!draft.campus_year.trim() && <label>Participaciones sin año<input className={inputClass} type="number" min="0" max="99" value={draft.campus_count} onChange={event => field("campus_count", event.target.value)} onBlur={autoSave} /></label>}
      <label>Correo habilitado<select className={inputClass} value={draft.campus_email} onChange={event => field("campus_email", event.target.value)} onBlur={autoSave}><option value="true">Sí</option><option value="false">No</option></select></label>
      <label>Categoría del jugador<input className={inputClass} maxLength={80} placeholder="S16, S18…" value={draft.participation_category} onChange={event => field("participation_category", event.target.value)} onBlur={autoSave} /></label>
    </>}
    {draft.participation_kind !== "campus" && <label>Categoría deportiva *<select className={inputClass} value={draft.participation_category} onChange={event => field("participation_category", event.target.value)} onBlur={autoSave}><option value="">Selecciona categoría</option>{draft.participation_category && !categories.some(item => item.label === draft.participation_category) && <option value={draft.participation_category}>{draft.participation_category}</option>}{categories.map(item => <option key={item.id} value={item.label}>{item.label}</option>)}</select></label>}
    <label>Importe pagado (€)<input className={inputClass} type="number" min="0" max="100000" step="0.01" inputMode="decimal" placeholder="0,00" value={draft.amount_paid} onChange={event => field("amount_paid", event.target.value)} onBlur={autoSave} /></label>
    <ClubPicker clubs={clubs} value={draft.club_id} onChange={id => field("club_id", id)} onBlur={autoSave} inputClass={inputClass} />
    
    <label>Notas<textarea className={inputClass} maxLength={2000} value={draft.participation_notes} onChange={event => field("participation_notes", event.target.value)} onBlur={autoSave} /></label>
  </fieldset>;
  const createImagePreview = newImagePreview || (draft.type === "seleccion" && draft.federation_id && (!record || record.image_source === "federation") ? callupDefaultImage(draft.federation_id, draft.format) : record?.image_url || "");
  if (!record) return <section id="news-create-block" className={styles.addBlock}><h2 className="mb-3 font-bold">{record ? "Editar registro · " : ""}{draft.type === "seleccion" ? "Nueva convocatoria" : draft.type === "participacion" ? "Nueva participación" : "Nueva noticia"}</h2><form className={styles.createForm} onSubmit={event => {event.preventDefault(); void save();}}>
    <label>Tipo<select disabled={busy || !!record} className={inputClass} value={draft.type} onChange={event => field("type", event.target.value)}><option value="noticia">Noticia</option><option value="seleccion">Convocatoria</option><option value="participacion">Participación</option></select></label>
    <label>Jugador<input required disabled={busy} className={inputClass} list="news-player-options" placeholder="Nombre o ID JUGugby" aria-label="Buscar jugador por nombre o ID" value={draft.player_search} onChange={event => selectPlayer(event.target.value)} autoComplete="off" /></label>
    {!(draft.type === "participacion" && draft.participation_kind === "campus") && <label>Fecha / temporada<input required={draft.type === "noticia"} disabled={busy} maxLength={40} className={inputClass} placeholder="DD/MM/YY o YY/YY" value={draft.date_or_season} onChange={event => field("date_or_season", event.target.value)} /></label>}
    {!isCampus && <label>{draft.type === "seleccion" ? "Convocatoria" : "Titular"}<input required disabled={busy} maxLength={240} className={inputClass} readOnly={isCampus} value={isCampus ? automaticTitle : draft.title} onChange={event => field("title", event.target.value)} /></label>}
    {draft.type !== "participacion" && <label>URL<input required={draft.type === "noticia"} disabled={busy} type="url" maxLength={2048} className={inputClass} placeholder="https://…" value={draft.url} onChange={event => field("url", event.target.value)} /></label>}
    {draft.type !== "participacion" && <div className={styles.createImage} role="group" aria-label="Imagen destacada"><span className={styles.imageLabel}>Imagen destacada (opcional)</span>
      <button type="button" className={styles.imagePreview} disabled={busy} onClick={() => newImageInput.current?.click()} aria-label={newImagePreview ? "Cambiar imagen destacada" : "Seleccionar imagen destacada"}>
        {createImagePreview ? <Image unoptimized src={createImagePreview} alt="Vista previa de la imagen destacada" width={320} height={180} /> : <span className={styles.imagePlaceholder}><ImagePlus size={32} aria-hidden="true" /><span>Seleccionar imagen</span></span>}
      </button>
      <input ref={newImageInput} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-label="Archivo de imagen destacada" onChange={event => {
        const file = event.currentTarget.files?.[0]; if (!file) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {setNotice("Elige una imagen JPG, PNG o WebP de hasta 8 MB."); event.currentTarget.value = ""; return;}
        setNewImage(file); setNotice("");
      }} />
      {newImagePreview && <div className={styles.imageActions}><button type="button" disabled={busy} onClick={() => newImageInput.current?.click()}>Cambiar imagen</button><button type="button" disabled={busy} onClick={() => {setNewImage(null); if (newImageInput.current) newImageInput.current.value = "";}} aria-label="Quitar imagen destacada"><X size={16} aria-hidden="true" />Quitar</button></div>}
      <span className="text-xs font-normal text-neutral-500">{draft.type === "seleccion" && !newImagePreview ? "Por defecto se usa el escudo de la federación. Puedes elegir otra imagen. " : ""}JPG, PNG o WebP · hasta 8 MB</span>
    </div>}
    {draft.type === "participacion" && draft.participation_kind !== "campus" && <div className={styles.createImage}><span className={styles.imageLabel}>Imagen destacada de la categoría</span><div className={styles.imagePreview}>{categories.find(category => category.label === draft.participation_category)?.image_url ? <Image unoptimized src={categories.find(category => category.label === draft.participation_category)!.image_url!} alt={"Imagen de " + draft.participation_category} width={320} height={180} /> : <span className={styles.imagePlaceholder}>{draft.participation_category ? "Esta categoría todavía no tiene imagen" : "Selecciona la categoría deportiva"}</span>}</div><Link href="/categorias" className="text-xs font-bold text-red-700 underline">Gestionar imagen en categorías</Link></div>}
    {draft.type === "seleccion" && <div className={styles.createSelection}>{selectionFields}</div>}
    {draft.type === "participacion" && <div className={styles.createSelection}>{participationFields}</div>}
    <div className={styles.createActions}><button type="submit" className={styles.createIcon} disabled={busy} aria-label={busy ? "Guardando registro" : "Guardar registro"} aria-busy={busy} title="Guardar registro"><Save size={20} aria-hidden="true" /></button><button type="button" className={styles.createIcon + " " + styles.closeCreate} disabled={busy} onClick={() => onClose?.()} aria-label="Cerrar formulario" title="Cerrar"><X size={20} aria-hidden="true" /></button>{notice && <p role="status" className={styles.notice}>{notice}</p>}</div>
  </form></section>;
  if (rowEditing) return <><tr id={"news-edit-" + record.id} className={styles.row}>
    <td data-label="Jugador"><input title={name} aria-label={"Buscar jugador por nombre o ID: " + name} disabled={busy} className={inputClass} list="news-player-options" placeholder="Nombre o ID JUGugby" value={draft.player_search} onChange={event => selectPlayer(event.target.value)} onBlur={autoSave} autoComplete="off" /></td>
    {draft.type === "participacion" && draft.participation_kind === "campus" ? <td data-label="Imagen"><CampusClubBadges record={record} clubId={draft.club_id} clubName={clubs.find(club => club.id === draft.club_id)?.name} /></td> : draft.type === "participacion" ? <td data-label="Imagen"><Link href="/categorias" className={styles.center} title="Imagen gestionada en categorías">{record.image_url ? <Image unoptimized src={record.image_url} alt={"Imagen de " + draft.participation_category} width={60} height={42} className="h-11 w-16 object-contain" /> : <span className="text-xs text-neutral-500">Sin imagen en categoría</span>}</Link></td> : <td data-label="Imagen"><div className={styles.center}>{record ? <label className={styles.icon + " " + styles.upload} title={(record.image_updated_at ? "Cambiar imagen" : "Subir imagen") + " · JPG, PNG o WebP · hasta 8 MB"}>
      {(newImagePreview || record.image_updated_at) && <Image unoptimized width={120} height={76} src={newImagePreview || record.image_url || ("/api/noticias/" + record.id + "/imagen?v=" + encodeURIComponent(record.image_updated_at || ""))} alt={"Imagen destacada de " + record.title} className={styles.thumbnail} />}
      <ImagePlus size={20} className={newImagePreview || record.image_updated_at ? styles.camera : undefined} /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} aria-label={"Subir imagen destacada de " + name} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void uploadImage(file); }} />
    </label> : <button type="button" disabled className={styles.icon + " " + styles.upload} aria-label="Guarda la noticia antes de subir una imagen" title="Guarda la noticia antes de subir una imagen"><ImagePlus size={20} /></button>}</div></td>}
    <td data-label="Fecha / temporada">{draft.type === "participacion" && draft.participation_kind === "campus" ? <span>{draft.campus_year.trim() || "Año pendiente"}</span> : <input title="YY/YY o DD/MM/YY" aria-label={"Fecha o temporada de " + name} disabled={busy} maxLength={40} className={inputClass} placeholder="DD/MM/YY" value={draft.date_or_season} onBlur={autoSave} onChange={(event) => field("date_or_season", event.target.value)} />}</td>
    {draft.type === "participacion" && <td data-label="Nº registro">{draft.participation_kind === "campus" ? <input aria-label={"Número de registro de " + name} disabled={busy} maxLength={24} className={inputClass} value={draft.campus_registration} onChange={event => field("campus_registration", event.target.value)} onBlur={autoSave} /> : <span className="text-neutral-400">—</span>}</td>}
    <td data-label={draft.type === "seleccion" ? "Convocatoria" : "Titular"}><div className={styles.fieldPreview} data-preview={isCampus ? automaticTitle : draft.title}><input aria-label={(draft.type === "seleccion" ? "Convocatoria de " : "Titular de ") + name} disabled={busy} maxLength={240} className={inputClass} placeholder={draft.type === "seleccion" ? "Convocatoria" : "Titular"} readOnly={isCampus} value={isCampus ? automaticTitle : draft.title} onBlur={autoSave} onChange={(event) => field("title", event.target.value)} /></div></td>
    {draft.type === "seleccion" && <><td data-label="Categoría"><span className={styles.cellText} title={draft.category}>{draft.category || "—"}</span></td><td data-label="Modalidad"><span className={styles.cellText}>{draft.format === "7s" ? "7" : draft.format || "—"}</span></td><td data-label="Género"><span className={styles.cellText}>{genderLabel(draft.gender)}</span></td></>}
    {draft.type !== "participacion" && <td data-label="URL"><div className={styles.url}><div className={styles.fieldPreview} data-preview={draft.url}><input aria-label={"URL de " + name} disabled={busy} type="url" maxLength={2048} className={inputClass} placeholder="https://…" value={draft.url} onBlur={autoSave} onChange={(event) => field("url", event.target.value)} /></div>{record && /^https?:\/\//i.test(draft.url) && <a href={draft.url} target="_blank" rel="noopener noreferrer" className={styles.external} aria-label={"Abrir enlace en otra pestaña: " + record.title} title="Abrir en otra pestaña"><ExternalLink size={15} /></a>}</div></td>}
    {draft.type === "participacion" && <td data-label="Importe pagado"><input aria-label={"Importe pagado de " + name} disabled={busy} type="number" min="0" max="100000" step="0.01" inputMode="decimal" className={inputClass} placeholder="0,00 €" value={draft.amount_paid} onChange={event => field("amount_paid", event.target.value)} onBlur={autoSave} /></td>}
    <td data-label="Estado"><div className={styles.center}>{record ? <button type="button" disabled={busy || !record} aria-pressed={record?.published ?? false} aria-label={(record?.published ? "Publicado. Pasar a pendiente de revisión: " : "Pendiente de revisión. Publicar: ") + name} title={record?.published ? "Publicado · pasar a pendiente de revisión" : "Pendiente de revisión · publicar"} onClick={() => void toggleStatus()} className={styles.icon + " " + (record?.published ? styles.published : styles.pending)}>{record?.published ? <Check size={20} strokeWidth={3} /> : <X size={20} strokeWidth={3} />}</button> : <button type="button" disabled={busy} onClick={() => void save()} aria-label="Añadir noticia" title="Añadir noticia" className={styles.icon + " " + styles.save}><Plus size={20} /></button>}<button type="button" disabled={busy} className={styles.icon} title="Cerrar edición" aria-label={"Cerrar edición de " + name} aria-expanded="true" onClick={async () => {await saveQueue.current; if (!saveFailed.current) setRowEditing(false);}}><X size={17} /></button>{deleteButton}</div>{notice && <p role="status" className={styles.notice}>{notice}</p>}</td>

  </tr>{draft.type === "seleccion" && <tr className={styles.selectionRow}><td colSpan={9}>{selectionFields}{notice && <p role="status" className={styles.notice}>{notice}</p>}</td></tr>}{draft.type === "participacion" && <tr className={styles.selectionRow}><td colSpan={7}>{participationFields}</td></tr>}</>;
  return <tr className={styles.row}>
    <td data-label="Jugador"><span className={styles.cellText}>{record.player_id} · {name}</span></td>
    <td data-label="Imagen">{record.type === "participacion" && record.participation?.kind === "campus" ? <CampusClubBadges record={record} /> : <div className={styles.center}>{record.image_url || record.image_updated_at ? <Image unoptimized width={64} height={46} src={record.image_url || ("/api/noticias/" + record.id + "/imagen?v=" + encodeURIComponent(record.image_updated_at || ""))} alt={"Imagen destacada de " + record.title} className={styles.listImage} /> : <span className="text-xs text-neutral-500">Sin imagen</span>}</div>}</td>
    <td data-label="Fecha / temp."><span className={styles.cellText}>{record.date_or_season || "—"}</span></td>
    {record.type === "participacion" && <td data-label="Nº registro"><span className={styles.cellText}>{record.participation?.registration_number || "—"}</span></td>}
    <td data-label={draft.type === "seleccion" ? "Convocatoria" : "Titular"}><span className={styles.cellText} title={record.title}>{record.title}</span>{record.participation?.kind === "campus" && !record.participation.year && <small className="block text-xs text-neutral-600">{record.participation.count ?? 1} participación(es) con año pendiente</small>}</td>
    {record.type === "seleccion" && <><td data-label="Categoría"><span className={styles.cellText} title={record.selection?.category}>{record.selection?.category || "—"}</span></td><td data-label="Modalidad"><span className={styles.cellText}>{record.selection?.format === "7s" ? "7" : record.selection?.format || "—"}</span></td><td data-label="Género"><span className={styles.cellText}>{genderLabel(record.selection?.gender)}</span></td></>}
    {record.type !== "participacion" && <td data-label="URL">{record.url ? <a href={record.url} target="_blank" rel="noopener noreferrer" className={styles.listUrl} title={record.url + " · Abrir en otra pestaña"}><span className={styles.urlLabel}>{sourceLabel(record.url)}</span><ExternalLink size={14} aria-hidden="true" /></a> : <span className="text-neutral-400">—</span>}</td>}
    {record.type === "participacion" && <td data-label="Importe pagado"><span className={styles.cellText}>{record.participation?.amount_paid === null || record.participation?.amount_paid === undefined ? "—" : record.participation.amount_paid.toLocaleString("es-ES", {style: "currency", currency: "EUR"})}</span></td>}
    <td data-label="Estado"><div className={styles.center}><button type="button" disabled={busy} aria-pressed={record.published} aria-label={(record.published ? "Publicado. Pasar a pendiente: " : "Publicar: ") + name} onClick={() => void toggleStatus()} className={styles.icon + " " + (record.published ? styles.published : styles.pending)}>{record.published ? <Check size={20} strokeWidth={3} /> : <X size={20} strokeWidth={3} />}</button><button type="button" className={styles.icon} onClick={() => {setDraft(draftFromRecord(record, players)); setRowEditing(true);}} aria-label={"Editar registro de " + name} title="Editar registro" aria-expanded={rowEditing} aria-controls={"news-edit-" + record.id}><Pencil size={17} /></button>{deleteButton}</div>{notice && <p role="status" className={styles.notice}>{notice}</p>}</td>
  </tr>;
}
export default function PlayerNewsPage() {
  const [state, setState] = useState<State | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [publicPage, setPublicPage] = useState(0);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"noticia" | "seleccion" | "participacion">("noticia");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [formatFilter, setFormatFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const resetSelectionFilters = () => {setCategoryFilter(""); setFormatFilter(""); setGenderFilter("");};
  const [federationFilter, setFederationFilter] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [sort, setSort] = useState<NewsSort>(null);
  const [clubParticipantOrder, setClubParticipantOrder] = useState<1 | -1>(-1);
  const [createType, setCreateType] = useState<"noticia" | "seleccion" | "participacion" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/noticias", { cache: "no-store", signal: controller.signal }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }).then((data) => { setState(data); const query = new URLSearchParams(window.location.search); const type = query.get("tipo"); if (type === "noticia" || type === "seleccion" || type === "participacion") setTypeFilter(type); const player = query.get("jugador"); if (player) setFilter(player); }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se han podido cargar las noticias."); });
    return () => controller.abort();
  }, []);
  const saved = (record: PlayerNews) => setState((previous) => previous ? { ...previous, news: previous.news.some((item) => item.id === record.id) ? previous.news.map((item) => item.id === record.id ? record : item) : [record, ...previous.news] } : previous);
  const deleted = (id: string) => setState(previous => previous ? {...previous, news: previous.news.filter(record => record.id !== id)} : previous);
  const selectionCategories = [...new Set((state?.news ?? []).filter(item => item.type === "seleccion" && (!filter || item.player_id === filter) && (!federationFilter || item.selection?.federation_id === federationFilter)).map(item => item.selection?.category).filter((category): category is string => !!category))].sort((a,b) => a.localeCompare(b,"es",{numeric:true}));
  const titleOptions = [...new Set((state?.news ?? []).filter(item => item.type === typeFilter && (!categoryFilter || (item.selection?.category || "__missing__") === categoryFilter) && (!formatFilter || item.selection?.format === formatFilter) && (!genderFilter || (item.selection?.gender || "__missing__") === genderFilter) && (!filter || item.player_id === filter) && (!federationFilter || item.selection?.federation_id === federationFilter)).map(item => item.title))].sort((a,b) => a.localeCompare(b,"es"));
  const playerOptions = state?.players ?? [];
  const federationOptions = (state?.federations ?? []).filter(federation => (state?.news ?? []).some(item => item.type === "seleccion" && item.selection?.federation_id === federation.id && (!filter || item.player_id === filter)));
  const filteredRows = (state?.news ?? []).filter((item) => (statusFilter === "all" || item.published) && (item.type === typeFilter) && (!categoryFilter || (item.selection?.category || "__missing__") === categoryFilter) && (!formatFilter || item.selection?.format === formatFilter) && (!genderFilter || (item.selection?.gender || "__missing__") === genderFilter) && (!federationFilter || item.selection?.federation_id === federationFilter) && (!titleFilter || item.title === titleFilter) && (!filter || item.player_id === filter) && (!query || searchText([...groupSearchNames(state?.players.find(player => player.id === item.player_id)?.club_groups, undefined, categoryFilter && categoryFilter !== "__missing__" ? categoryFilter : undefined), item.player_id, item.type, item.title, item.url, item.date_or_season, item.selection?.category, item.selection?.event, state?.federations?.find(federation => federation.id === item.selection?.federation_id)?.name, state?.players.find((player) => player.id === item.player_id)?.name].join(" ")).includes(searchText(query))));
  const rows = sortNewsRows(filteredRows, state?.players || [], sort);
  async function exportExcel() {
    if (exporting || !rows.length) return;
    setExporting(true); setExportError("");
    try {
      const response = await fetch("/api/noticias/excel", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({record_ids: rows.map(record => record.id)})});
      if (!response.ok) {const data = await response.json(); throw new Error(data.error || "No se ha podido exportar el Excel.");}
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "jugadores-filtrados.xlsx";
      document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {setExportError(reason instanceof Error ? reason.message : "No se ha podido exportar el Excel.");}
    finally {setExporting(false);}
  }
  const filteredClubs = (() => {
    const clubsById = new Map((state?.clubs ?? []).map((club) => [club.id, club]));
    const clubs = new Map<string, { club: Club; players: Set<string> }>();
    for (const record of filteredRows) {
      const clubId = record.participation?.club_id;
      const club = clubId ? clubsById.get(clubId) : null;
      if (!club || !Number.isFinite(club.latitude) || !Number.isFinite(club.longitude)) continue;
      const current = clubs.get(club.id) ?? { club, players: new Set<string>() };
      current.players.add(record.player_id);
      clubs.set(club.id, current);
    }
    return [...clubs.values()].map(({ club, players }) => ({ id: club.id, name: club.name, city: club.city ?? "", province: club.province ?? "", region: club.region ?? "", country: club.country ?? "", latitude: club.latitude!, longitude: club.longitude!, active: club.active ?? true, maps_url: club.maps_url ?? undefined, player_count: players.size })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  })();
  const orderedFilteredClubs = [...filteredClubs].sort((a, b) => (a.player_count === b.player_count ? a.name.localeCompare(b.name, "es") : a.player_count - b.player_count) * clubParticipantOrder);
  const sortHeader = (key: NewsSortKey, label: string) => <th scope="col" aria-sort={sort?.key === key ? sort.direction === 1 ? "ascending" : "descending" : "none"}><button type="button" className={styles.sortHeader} onClick={() => setSort(previous => ({key, direction: previous?.key === key && previous.direction === 1 ? -1 : 1}))} aria-label={"Ordenar por " + label}>{label}<span aria-hidden="true">{sort?.key === key ? sort.direction === 1 ? "↑" : "↓" : "↕"}</span></button></th>;
  return <main className="catalog-app"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu current="news" /></header><div className="catalog-shell"><section className="catalog-workspace"><div className="catalog-content">
    <h1 className="text-2xl font-black">Noticias, Convocatorias y participaciones</h1>
    {state?.admin && typeFilter === "participacion" && <details className="news-club-map-disclosure"><summary><span>MAPA Y CLUBS FILTRADOS</span><b>{filteredClubs.length} clubs</b></summary><div className="news-club-map-layout"><ClubFinderMap clubs={filteredClubs} compact countLabel="participantes" /><section className="news-club-summary-table" aria-label="Clubs del filtro actual"><header><span>ESCUDO</span><span>CLUB</span><button type="button" onClick={() => setClubParticipantOrder((direction) => direction * -1 as 1 | -1)} aria-label="Ordenar por participantes">PART. <small aria-hidden="true">{clubParticipantOrder === -1 ? "↓" : "↑"}</small></button></header><ul>{orderedFilteredClubs.map((club) => <li key={club.id}><span className="news-club-summary-shield">{clubShieldUrl(club.id) ? <Image unoptimized src={clubShieldUrl(club.id)!} alt={`Escudo de ${club.name}`} width={40} height={40} /> : "—"}</span><Link href={`/clubs/${club.id}`} title={`Abrir ${club.name}`}>{club.name}</Link><b>{club.player_count}</b></li>)}</ul>{!filteredClubs.length && <p>No hay clubs con ubicación disponible para este filtro.</p>}</section></div></details>}
    <div className={styles.typeFilters} role="group" aria-label="Filtrar por tipo de registro">{([{value: "noticia", label: "Noticias"}, {value: "seleccion", label: "Convocatorias"}, {value: "participacion", label: "Participaciones"}] as const).map(option => <div key={option.value} className={styles.typeGroup}><button type="button" aria-pressed={typeFilter === option.value} onClick={() => {setTypeFilter(option.value); setPublicPage(0); setTitleFilter(""); setFederationFilter(""); resetSelectionFilters(); setCreateType(null);}} className={typeFilter === option.value ? styles.activeFilter : styles.typeFilter}>{option.label}<span>{(state?.news || []).filter(item => (!filter || item.player_id === filter) && (statusFilter === "all" || item.published) && item.type === option.value).length}</span></button>{state?.admin && <button type="button" className={styles.addTypeButton} aria-expanded={createType === option.value} aria-controls="news-create-block" onClick={() => {setTypeFilter(option.value); setTitleFilter(""); setFederationFilter(""); resetSelectionFilters(); setCreateType(previous => previous === option.value ? null : option.value);}}>+{option.label}</button>}</div>)}</div>
    {error && <p role="alert">{error}</p>}{!state && !error && <p>Cargando noticias…</p>}
    {state && !state.admin && <section aria-label="Noticias publicadas" className="mt-5">
      <input aria-label="Buscar noticias publicadas" placeholder="Buscar jugador, titular o fecha…" value={query} onChange={(event) => { setQuery(event.target.value); setPublicPage(0); }} className="mb-4 w-full max-w-md rounded-lg border bg-white px-3 py-2 text-sm" />
      <p className="mb-3 text-sm text-neutral-600">{rows.length} registros publicados</p>
      <div className="grid gap-3">{rows.slice(Math.min(publicPage, Math.max(0, Math.ceil(rows.length / 50) - 1)) * 50, (Math.min(publicPage, Math.max(0, Math.ceil(rows.length / 50) - 1)) + 1) * 50).map((record) => <article key={record.id} className="flex gap-4 rounded-xl border border-neutral-200 bg-white p-4">
        {record.image_url && <Image unoptimized loading="lazy" src={record.image_url} alt="" width={96} height={72} className="h-18 w-24 shrink-0 rounded-lg object-cover" />}
        <div><p className="text-xs text-neutral-500">{record.date_or_season || "—"}</p><h2 className="mt-1 font-bold">{record.title}</h2><Link href={"/jugadores/" + record.player_id} className="mt-2 inline-block text-sm text-red-700">{state.players.find((player) => player.id === record.player_id)?.name || record.player_id}</Link>{record.url && <a href={record.url} target="_blank" rel="noopener noreferrer" className="ml-4 text-sm font-bold text-red-700">Ver fuente</a>}</div>
      </article>)}</div>
      {!rows.length && <p className="mt-4 text-sm">No hay registros publicados que coincidan con la búsqueda.</p>}
      {rows.length > 50 && <div className="mt-5 flex items-center gap-4"><button type="button" disabled={publicPage === 0} onClick={() => setPublicPage((value) => Math.max(0, value - 1))} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span className="text-sm">Página {Math.min(publicPage + 1, Math.ceil(rows.length / 50))} de {Math.ceil(rows.length / 50)}</span><button type="button" disabled={(publicPage + 1) * 50 >= rows.length} onClick={() => setPublicPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div>}
    </section>}
    {state?.admin && <>{createType && <NewsRow key={"create-" + createType} defaultType={createType} onClose={() => setCreateType(null)} players={state.players} federations={state.federations ?? []} clubs={state.clubs ?? []} categories={state.categories ?? []} campuses={state.campuses ?? []} onSaved={record => {saved(record); setTypeFilter(record.type);}} />}<div className="my-4 flex flex-wrap items-end gap-3"><SearchablePicker label="Jugador" placeholder="Buscar nombre o apellido…" emptyLabel="Todos los jugadores" options={playerOptions.map(player => ({...player, name: player.name + " · " + player.id}))} value={filter} onChange={id => {setFilter(id); setFederationFilter(""); resetSelectionFilters();}} inputClass="w-full min-w-[260px] rounded border bg-white p-2 text-sm font-normal" />{typeFilter === "seleccion" && <label className="grid gap-1 text-xs font-bold">Federación<select aria-label="Filtrar por federación" className="max-w-xs rounded border p-2 text-sm font-normal" value={federationFilter} onChange={event => {setFederationFilter(event.target.value); setTitleFilter(""); resetSelectionFilters();}}><option value="">Todas las federaciones</option>{federationOptions.map(federation => <option key={federation.id} value={federation.id}>{federation.name}</option>)}</select></label>}{typeFilter === "seleccion" && <>
<label className="grid gap-1 text-xs font-bold">Categoría<select aria-label="Filtrar por categoría" className="max-w-xs rounded border p-2 text-sm font-normal" value={categoryFilter} onChange={event => {setCategoryFilter(event.target.value); setTitleFilter("");}}><option value="">Todas las categorías</option><option value="__missing__">Sin indicar</option>{selectionCategories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
<label className="grid gap-1 text-xs font-bold">Modalidad<select aria-label="Filtrar por modalidad" className="rounded border p-2 text-sm font-normal" value={formatFilter} onChange={event => {setFormatFilter(event.target.value); setTitleFilter("");}}><option value="">Todas las modalidades</option><option value="XV">XV</option><option value="7s">7</option></select></label>
<label className="grid gap-1 text-xs font-bold">Género<select aria-label="Filtrar por género" className="rounded border p-2 text-sm font-normal" value={genderFilter} onChange={event => {setGenderFilter(event.target.value); setTitleFilter("");}}><option value="">Todos los géneros</option><option value="masculino">Masculino</option><option value="femenino">Femenino</option><option value="mixto">Mixto</option><option value="__missing__">Sin indicar</option></select></label>
</>}<label className="grid gap-1 text-xs font-bold">{typeFilter === "seleccion" ? "Convocatoria" : "Titular"}<select aria-label={typeFilter === "seleccion" ? "Filtrar por convocatoria" : "Filtrar por titular"} className="max-w-md rounded border p-2 text-sm font-normal" value={titleFilter} onChange={event => setTitleFilter(event.target.value)}><option value="">{typeFilter === "seleccion" ? "Todas las convocatorias" : "Todos los titulares"}</option>{titleOptions.map(title => <option key={title} value={title}>{title}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Estado<select aria-label="Filtrar por estado" className="rounded border bg-white p-2 text-sm font-normal" value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | "active")}><option value="all">Todos</option><option value="active">Activados</option></select></label><button type="button" disabled={exporting || !rows.length} onClick={() => void exportExcel()} className="inline-flex items-center gap-2 rounded border border-green-700 bg-green-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50" aria-label="Exportar todos los datos de los jugadores filtrados a Excel">{exporting ? "Exportando…" : "Descargar Excel"}</button>{(filter || titleFilter || query || federationFilter || categoryFilter || formatFilter || genderFilter || statusFilter !== "all") && <button type="button" className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-red-700" onClick={() => {setFilter(""); setTitleFilter(""); setQuery(""); setStatusFilter("all"); setFederationFilter(""); resetSelectionFilters();}}>Limpiar filtros</button>}</div>{exportError && <p role="alert" className="mb-2 text-sm text-red-700">{exportError}</p>}<p className="mb-2 text-xs text-neutral-500">{rows.length} registros · ✓ Publicado · X Pendiente de revisión · Pulsa el lápiz para desplegar y editar. Los cambios se guardan al salir de cada campo.</p>
      <div className={styles.tableWrap}><table className={styles.table + (typeFilter === "participacion" ? " " + styles.participationTable : typeFilter === "seleccion" ? " " + styles.selectionTable : "")}><caption className="sr-only">Tabla editable de noticias por jugador</caption><thead className="bg-neutral-50"><tr>{sortHeader("player", "Jugador")}{sortHeader("image", "Imagen")}{sortHeader("date", "Fecha / temp.")}{typeFilter === "participacion" && sortHeader("registration", "Nº registro")}{sortHeader("title", typeFilter === "seleccion" ? "Convocatoria" : "Titular")}{typeFilter === "seleccion" && <>{sortHeader("category", "Categoría")}{sortHeader("format", "Modalidad")}{sortHeader("gender", "Género")}</>}{typeFilter !== "participacion" && sortHeader("url", "URL")}{typeFilter === "participacion" && <th scope="col">Importe pagado</th>}{sortHeader("status", "Estado")}</tr></thead><tbody>{rows.map((record) => <NewsRow key={record.id} record={record} onDeleted={deleted} clubs={state.clubs ?? []} categories={state.categories ?? []} campuses={state.campuses ?? []} federations={state.federations ?? []} players={state.players} onSaved={saved} />)}</tbody></table></div><datalist id="news-player-options">{state.players.map(player => <option key={player.id} value={player.id + " - " + player.name}>{player.name + " · " + player.id}</option>)}</datalist><datalist id="news-selection-categories">{["S14", "S16", "S18", "M18", "M20", "S20", "S23", "Absoluta", "Emerging"].map(category => <option key={category} value={category} />)}</datalist>{!rows.length && <p className="mt-3 text-sm">No hay registros que coincidan con los filtros.</p>}</>}
  </div></section></div></main>;
}
