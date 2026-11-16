"use client";

import Image from "next/image";
import { SearchablePicker } from "@/app/components/club-picker";
import { Check, ExternalLink, Eye, ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import type { PlayerTitle } from "@/lib/player-titles";
import { playerTitleLabel, playerTitleYear } from "@/lib/player-titles";
import { searchOptions } from "@/lib/search-options";

type Person = { id: string; name: string };
type DirectoryState = { admin: boolean; players: Person[]; staff: Person[] };
type TitleDraft = {
  id: string;
  year: string;
  title: string;
  competition: string;
  result: string;
  team: string;
  date: string;
  source_name: string;
  source_url: string;
  unlinked_participants: string;
};
type TitleSortKey = "id" | "year" | "title" | "competition" | "result" | "image" | "participants";
type TitleSort = {key: TitleSortKey; direction: 1 | -1} | null;

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("es");
const emptyDraft = (): TitleDraft => ({id: "", year: "", title: "", competition: "", result: "", team: "", date: "", source_name: "", source_url: "", unlinked_participants: ""});
const titleParticipantCount = (title: PlayerTitle) => title.player_ids.length + (title.staff_ids?.length ?? 0) + (title.unlinked_participants?.length ?? 0);

function titleSortValue(title: PlayerTitle, key: TitleSortKey): string | number {
  switch (key) {
    case "id": return title.id;
    case "year": return playerTitleYear(title) ?? 0;
    case "title": return playerTitleLabel(title);
    case "competition": return title.competition ?? "";
    case "result": return title.result ?? "";
    case "image": return title.image_updated_at ? 1 : 0;
    case "participants": return titleParticipantCount(title);
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error(`El servidor respondió sin contenido (HTTP ${response.status}).`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`);
  }
}

function draftFromTitle(title: PlayerTitle): TitleDraft {
  return {
    id: title.id,
    year: String(playerTitleYear(title) ?? ""),
    title: playerTitleLabel(title),
    competition: title.competition ?? "",
    result: title.result ?? "",
    team: title.team ?? "",
    date: title.date ?? "",
    source_name: title.source_name ?? "",
    source_url: title.source_url ?? "",
    unlinked_participants: (title.unlinked_participants ?? []).join("\n"),
  };
}

function TitleImageCell({title, admin, editing, onSaved}: {title: PlayerTitle; admin: boolean; editing: boolean; onSaved: (titles: PlayerTitle[]) => void}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch(`/api/player-titles/${encodeURIComponent(title.id)}/image`, {method: "POST", body: formData});
      const data = await responseJson<{error?: string; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se ha podido guardar la imagen.");
      if (!Array.isArray(data.titles)) throw new Error("La respuesta no incluye el catálogo actualizado.");
      onSaved(data.titles);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "No se ha podido guardar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/player-titles/${encodeURIComponent(title.id)}/image`, {method: "DELETE"});
      const data = await responseJson<{error?: string; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se ha podido eliminar la imagen.");
      if (!Array.isArray(data.titles)) throw new Error("La respuesta no incluye el catálogo actualizado.");
      onSaved(data.titles);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "No se ha podido eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex items-center gap-2">
    {title.image_updated_at ? <Image unoptimized src={`/api/player-titles/${encodeURIComponent(title.id)}/image?v=${encodeURIComponent(title.image_updated_at)}`} alt={`Imagen de ${playerTitleLabel(title)}`} width={96} height={64} className="h-16 w-24 rounded border bg-neutral-50 object-contain" /> : !admin && "—"}
    {admin && editing && <label title={title.image_updated_at ? "Cambiar imagen" : "Subir imagen"} className={`inline-flex cursor-pointer items-center justify-center rounded border border-neutral-300 p-2 text-red-700 ${busy ? "pointer-events-none opacity-50" : ""}`}>
      <ImagePlus size={17} aria-hidden="true" /><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${title.image_updated_at ? "Cambiar" : "Subir"} imagen de ${playerTitleLabel(title)}`} disabled={busy} onChange={(event) => {const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(file);}} />
    </label>}
    {admin && editing && title.image_updated_at && <button type="button" disabled={busy} onClick={() => void deleteImage()} aria-label={`Eliminar imagen de ${playerTitleLabel(title)}`} title="Eliminar imagen" className="rounded border border-neutral-300 p-2 text-red-700 disabled:opacity-50"><Trash2 size={16} aria-hidden="true" /></button>}
    {notice && <span role="status" className="max-w-40 text-xs text-red-700">{notice}</span>}
  </div>;
}

function TitleForm({players, staff, initialTitle, onSaved, onClose}: {
  players: Person[];
  staff: Person[];
  initialTitle?: PlayerTitle;
  onSaved: (titles: PlayerTitle[]) => void;
  onClose: () => void;
}) {
  const [savedTitle, setSavedTitle] = useState<PlayerTitle | null>(initialTitle ?? null);
  const [draft, setDraft] = useState<TitleDraft>(() => initialTitle ? draftFromTitle(initialTitle) : emptyDraft());
  const [participantQuery, setParticipantQuery] = useState("");
  const [playerIds, setPlayerIds] = useState<string[]>(initialTitle?.player_ids ?? []);
  const [staffIds, setStaffIds] = useState<string[]>(initialTitle?.staff_ids ?? []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const imagePreviewUrl = useRef("");
  const selectedIds = new Set([...playerIds, ...staffIds]);
  const candidates = participantQuery.trim()
    ? searchOptions([...players, ...staff], participantQuery).filter((person) => !selectedIds.has(person.id)).slice(0, 20)
    : [];
  const selectedPlayers = players.filter((person) => playerIds.includes(person.id));
  const selectedStaff = staff.filter((person) => staffIds.includes(person.id));
  const activeTitle = savedTitle;

  function addParticipant(person: Person) {
    if (person.id.startsWith("JUG")) setPlayerIds((current) => current.includes(person.id) ? current : [...current, person.id]);
    else setStaffIds((current) => current.includes(person.id) ? current : [...current, person.id]);
    setParticipantQuery("");
  }

  useEffect(() => () => {
    if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current);
  }, []);

  function selectImage(file: File | null) {
    if (imagePreviewUrl.current) URL.revokeObjectURL(imagePreviewUrl.current);
    imagePreviewUrl.current = file ? URL.createObjectURL(file) : "";
    setImageFile(file);
    setImagePreview(imagePreviewUrl.current);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const unlinkedParticipants = draft.unlinked_participants.split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
    if (!playerIds.length && !staffIds.length && !unlinkedParticipants.length) {
      setNotice("Selecciona al menos un jugador o miembro del staff.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/player-titles", {
        method: activeTitle ? "PUT" : "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          ...draft,
          year: Number(draft.year),
          player_ids: playerIds,
          staff_ids: staffIds,
          unlinked_participants: unlinkedParticipants,
          ...(activeTitle ? {original_id: activeTitle.id} : {}),
        }),
      });
      const data = await responseJson<{error?: string; title?: PlayerTitle; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se ha podido guardar el título.");
      if (!data.title || !Array.isArray(data.titles)) throw new Error("La respuesta no incluye el título actualizado.");
      setSavedTitle(data.title);
      onSaved(data.titles);

      if (imageFile) {
        const formData = new FormData();
        formData.set("file", imageFile);
        const imageResponse = await fetch(`/api/player-titles/${encodeURIComponent(data.title.id)}/image`, {method: "POST", body: formData});
        const imageData = await responseJson<{error?: string; title?: PlayerTitle; titles?: PlayerTitle[]}>(imageResponse);
        if (!imageResponse.ok) throw new Error(imageData.error || "El título se guardó, pero no se pudo guardar la imagen.");
        if (!imageData.title || !Array.isArray(imageData.titles)) throw new Error("El título se guardó, pero la respuesta de imagen no es válida.");
        setSavedTitle(imageData.title);
        onSaved(imageData.titles);
        selectImage(null);
        if (imageInput.current) imageInput.current.value = "";
      }

      if (initialTitle) onClose();
      else {
        setDraft(draftFromTitle(data.title));
        setNotice(imageFile ? "Título e imagen guardados." : "Título guardado. Ya puedes añadir una imagen.");
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "No se ha podido guardar el título.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage() {
    if (!activeTitle) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/player-titles/${encodeURIComponent(activeTitle.id)}/image`, {method: "DELETE"});
      const data = await responseJson<{error?: string; title?: PlayerTitle; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se ha podido eliminar la imagen.");
      if (!data.title || !Array.isArray(data.titles)) throw new Error("La respuesta no incluye el catálogo actualizado.");
      setSavedTitle(data.title);
      onSaved(data.titles);
      setNotice("Imagen eliminada.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "No se ha podido eliminar la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return <section id={activeTitle ? `edit-title-${activeTitle.id}` : "title-create-block"} className="my-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm" aria-label={activeTitle ? `Editar título ${activeTitle.id}` : "Añadir título"}>
    <h2 className="mb-3 font-bold">{activeTitle ? `Editar título ${activeTitle.id}` : "Nuevo título"}</h2>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
      <label className="grid gap-1 text-xs font-bold">ID-Título<input required maxLength={80} pattern="[A-Za-z0-9][A-Za-z0-9._-]{1,79}" title="Usa letras, números, punto, guion o guion bajo." className="rounded border p-2 text-sm font-normal" value={draft.id} onChange={(event) => setDraft((current) => ({...current, id: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Año<input required type="number" min="1800" max="2200" step="1" className="rounded border p-2 text-sm font-normal" value={draft.year} onChange={(event) => setDraft((current) => ({...current, year: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Título<input required maxLength={240} className="rounded border p-2 text-sm font-normal" value={draft.title} onChange={(event) => setDraft((current) => ({...current, title: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Competición<input required maxLength={240} className="rounded border p-2 text-sm font-normal" value={draft.competition} onChange={(event) => setDraft((current) => ({...current, competition: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Resultado<input required maxLength={240} className="rounded border p-2 text-sm font-normal" value={draft.result} onChange={(event) => setDraft((current) => ({...current, result: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Equipo<input maxLength={240} className="rounded border p-2 text-sm font-normal" value={draft.team} onChange={(event) => setDraft((current) => ({...current, team: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold">Fecha<input maxLength={40} className="rounded border p-2 text-sm font-normal" value={draft.date} onChange={(event) => setDraft((current) => ({...current, date: event.target.value}))} placeholder="16/04/2018" /></label>
      <label className="grid gap-1 text-xs font-bold">Nombre de la fuente<input maxLength={160} className="rounded border p-2 text-sm font-normal" value={draft.source_name} onChange={(event) => setDraft((current) => ({...current, source_name: event.target.value}))} /></label>
      <label className="grid gap-1 text-xs font-bold sm:col-span-2">URL de la fuente<input type="url" maxLength={2048} className="rounded border p-2 text-sm font-normal" value={draft.source_url} onChange={(event) => setDraft((current) => ({...current, source_url: event.target.value}))} /></label>
      <fieldset className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:col-span-2">
        <legend className="px-1 text-xs font-bold">Jugadores y staff participantes</legend>
        <label className="grid gap-1 text-xs font-semibold">Buscar por nombre o ID<input type="search" className="rounded border p-2 text-sm font-normal" value={participantQuery} onChange={(event) => setParticipantQuery(event.target.value)} placeholder="Nombre o ID…" /></label>
        {participantQuery.trim() ? <ul className="grid max-h-52 gap-1 overflow-y-auto rounded border border-neutral-100 p-2" aria-label="Resultados de búsqueda">{candidates.map((person) => <li key={person.id} className="flex items-center justify-between gap-3 rounded px-2 py-1 text-sm"><span>{person.name} · {person.id}</span><button type="button" onClick={() => addParticipant(person)} className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs font-bold text-red-700">Añadir</button></li>)}{!candidates.length && <li role="status" className="text-xs text-neutral-500">No hay coincidencias disponibles.</li>}</ul> : <p className="text-xs text-neutral-500">Busca un jugador o miembro del staff para añadirlo.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <section aria-label="Jugadores relacionados" className="grid content-start gap-1"><b className="text-xs">Jugadores relacionados ({selectedPlayers.length})</b>{selectedPlayers.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 rounded border border-neutral-100 px-2 py-1 text-sm"><span>{person.name} · {person.id}</span><button type="button" onClick={() => setPlayerIds((current) => current.filter((id) => id !== person.id))} aria-label={`Quitar a ${person.name}`} className="font-bold text-red-700">×</button></div>)}</section>
          <section aria-label="Staff relacionado" className="grid content-start gap-1"><b className="text-xs">Staff relacionado ({selectedStaff.length})</b>{selectedStaff.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 rounded border border-neutral-100 px-2 py-1 text-sm"><span>{person.name} · {person.id}</span><button type="button" onClick={() => setStaffIds((current) => current.filter((id) => id !== person.id))} aria-label={`Quitar a ${person.name}`} className="font-bold text-red-700">×</button></div>)}</section>
        </div>
        <label className="grid gap-1 text-xs font-semibold">Otros participantes sin ficha local<textarea rows={3} className="rounded border p-2 text-sm font-normal" value={draft.unlinked_participants} onChange={(event) => setDraft((current) => ({...current, unlinked_participants: event.target.value}))} placeholder="Un nombre por línea" /></label>
      </fieldset>
      <div className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:col-span-2">
        <span className="text-xs font-bold">Imagen del título</span>
        <div className="flex flex-wrap items-center gap-3">
          {(imageFile && imagePreview) || (activeTitle?.image_updated_at && activeTitle.id === draft.id) ? <Image unoptimized src={imageFile && imagePreview ? imagePreview : `/api/player-titles/${encodeURIComponent(activeTitle!.id)}/image?v=${encodeURIComponent(activeTitle!.image_updated_at ?? "")}`} alt={`Imagen de ${draft.title}`} width={180} height={110} className="h-24 w-40 rounded border object-cover" /> : <span className="flex h-24 w-40 items-center justify-center rounded border border-dashed text-xs text-neutral-500">Sin imagen</span>}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-xs font-bold"><ImagePlus size={16} aria-hidden="true" />{activeTitle?.image_updated_at ? "Cambiar imagen" : "Subir imagen"}<input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => selectImage(event.currentTarget.files?.[0] ?? null)} /></label>
          {activeTitle?.image_updated_at && <button type="button" disabled={busy} onClick={() => void deleteImage()} className="rounded border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50">Eliminar imagen</button>}
        </div>
        <p className="text-xs text-neutral-500">JPG, PNG o WebP · hasta 8 MB. Las imágenes se guardan en local.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : activeTitle ? "Guardar cambios" : "Guardar título"}</button>
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold">Cerrar</button>
        {notice && <p role="status" className="text-sm text-neutral-700">{notice}</p>}
      </div>
    </form>
  </section>;
}

function InlineTitleRow({title, names, players, staff, admin, editing, detailsOpen, onToggleEditing, onToggleDetails, onFinishEditing, onSaved}: {
  title: PlayerTitle;
  names: Map<string, string>;
  players: Person[];
  staff: Person[];
  admin: boolean;
  editing: boolean;
  detailsOpen: boolean;
  onToggleEditing: () => void;
  onToggleDetails: () => void;
  onFinishEditing: () => void;
  onSaved: (titles: PlayerTitle[], updatedId?: string) => void;
}) {
  const [draft, setDraft] = useState(() => draftFromTitle(title));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [participantQuery, setParticipantQuery] = useState("");
  const [participantBusy, setParticipantBusy] = useState(false);
  const [participantNotice, setParticipantNotice] = useState("");
  const [participantSort, setParticipantSort] = useState<{key: "id" | "name"; direction: 1 | -1}>({key: "name", direction: 1});
  const draftRef = useRef(draft);
  const savedDraftRef = useRef(draftFromTitle(title));
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const inputClass = "w-full min-w-24 rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm font-normal";
  const selectedIds = new Set([...title.player_ids, ...(title.staff_ids ?? [])]);
  const candidates = participantQuery.trim()
    ? searchOptions([...players, ...staff], participantQuery).filter((person) => !selectedIds.has(person.id)).slice(0, 20)
    : [];
  const participantRows = [
    ...title.player_ids.map((id) => ({id, name: names.get(id) ?? id, kind: "player" as const, key: id})),
    ...(title.staff_ids ?? []).map((id) => ({id, name: names.get(id) ?? id, kind: "staff" as const, key: id})),
    ...(title.unlinked_participants ?? []).map((name, index) => ({id: "—", name, kind: "unlinked" as const, key: `${name}-${index}`})),
  ].sort((left, right) => left[participantSort.key].localeCompare(right[participantSort.key], "es", {numeric: true, sensitivity: "base"}) * participantSort.direction);
  const participantCount = title.player_ids.length + (title.staff_ids?.length ?? 0) + (title.unlinked_participants?.length ?? 0);

  async function updateParticipants(playerIds: string[], staffIds: string[], unlinkedParticipants: string[]) {
    await saveQueue.current;
    if (JSON.stringify(draftRef.current) !== JSON.stringify(savedDraftRef.current)) {
      setParticipantNotice("Guarda los campos del título antes de cambiar sus participantes.");
      return;
    }
    if (participantCount <= 1 && playerIds.length + staffIds.length + unlinkedParticipants.length === 0) {
      setParticipantNotice("El título debe conservar al menos un participante.");
      return;
    }
    const savedDraft = savedDraftRef.current;
    const year = Number(savedDraft.year);
    if (!Number.isInteger(year) || year < 1800 || year > 2200) {
      setParticipantNotice("No se puede actualizar la participación: el título no tiene un año válido.");
      return;
    }
    setParticipantBusy(true);
    setParticipantNotice("");
    try {
      const response = await fetch("/api/player-titles", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          id: savedDraft.id,
          year,
          title: savedDraft.title,
          competition: savedDraft.competition,
          result: savedDraft.result,
          team: savedDraft.team,
          date: savedDraft.date,
          source_name: savedDraft.source_name,
          source_url: savedDraft.source_url,
          player_ids: playerIds,
          staff_ids: staffIds,
          unlinked_participants: unlinkedParticipants,
          original_id: title.id,
        }),
      });
      const data = await responseJson<{error?: string; title?: PlayerTitle; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se han podido actualizar los participantes.");
      if (!data.title || !Array.isArray(data.titles)) throw new Error("La respuesta no incluye los participantes actualizados.");
      onSaved(data.titles);
      setParticipantQuery("");
      setParticipantNotice("Participantes actualizados.");
    } catch (reason) {
      setParticipantNotice(reason instanceof Error ? reason.message : "No se han podido actualizar los participantes.");
    } finally {
      setParticipantBusy(false);
    }
  }

  function addParticipant(person: Person) {
    if (person.id.startsWith("JUG")) void updateParticipants([...title.player_ids, person.id], title.staff_ids ?? [], title.unlinked_participants ?? []);
    else void updateParticipants(title.player_ids, [...(title.staff_ids ?? []), person.id], title.unlinked_participants ?? []);
  }

  function removePlayer(id: string) {
    void updateParticipants(title.player_ids.filter((current) => current !== id), title.staff_ids ?? [], title.unlinked_participants ?? []);
  }

  function removeStaff(id: string) {
    void updateParticipants(title.player_ids, (title.staff_ids ?? []).filter((current) => current !== id), title.unlinked_participants ?? []);
  }

  function removeUnlinked(index: number) {
    void updateParticipants(title.player_ids, title.staff_ids ?? [], (title.unlinked_participants ?? []).filter((_, current) => current !== index));
  }

  function sortParticipants(key: "id" | "name") {
    setParticipantSort((current) => ({key, direction: current.key === key && current.direction === 1 ? -1 : 1}));
  }

  function change(field: keyof TitleDraft, value: string) {
    const next = {...draftRef.current, [field]: value};
    draftRef.current = next;
    setDraft(next);
  }

  function saveIfChanged() {
    if (JSON.stringify(draftRef.current) === JSON.stringify(savedDraftRef.current)) return;
    const operation = async () => {
      const snapshot = {...draftRef.current};
      if (JSON.stringify(snapshot) === JSON.stringify(savedDraftRef.current)) return;
      setBusy(true);
      setNotice("Guardando…");
      try {
        const response = await fetch("/api/player-titles", {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            ...snapshot,
            year: Number(snapshot.year),
            player_ids: title.player_ids,
            staff_ids: title.staff_ids ?? [],
            unlinked_participants: title.unlinked_participants ?? [],
            original_id: title.id,
          }),
        });
        const data = await response.json() as {error?: string; title?: PlayerTitle; titles?: PlayerTitle[]};
        if (!response.ok) throw new Error(data.error || "No se ha podido guardar el título.");
        if (!data.title || !Array.isArray(data.titles)) throw new Error("La respuesta no incluye el título actualizado.");
        const savedDraft = draftFromTitle(data.title);
        draftRef.current = savedDraft;
        savedDraftRef.current = savedDraft;
        setDraft(savedDraft);
        onSaved(data.titles, data.title.id);
        setNotice("Guardado.");
      } catch (reason) {
        setNotice(reason instanceof Error ? reason.message : "No se ha podido guardar el título.");
      } finally {
        setBusy(false);
      }
    };
    saveQueue.current = saveQueue.current.then(operation, operation);
    return saveQueue.current;
  }

  async function finishEditing() {
    await saveQueue.current;
    if (JSON.stringify(draftRef.current) !== JSON.stringify(savedDraftRef.current)) {
      saveIfChanged();
      await saveQueue.current;
    }
    if (JSON.stringify(draftRef.current) === JSON.stringify(savedDraftRef.current)) onFinishEditing();
  }

  async function cancelEditing() {
    await saveQueue.current;
    onFinishEditing();
  }

  async function deleteTitle() {
    await saveQueue.current;
    if (!window.confirm(`¿Deseas eliminar el título ${title.id}?\n\n${playerTitleLabel(title)}`)) return;
    setParticipantBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/player-titles", {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({id: title.id}),
      });
      const data = await responseJson<{error?: string; titles?: PlayerTitle[]}>(response);
      if (!response.ok) throw new Error(data.error || "No se ha podido eliminar el título.");
      if (!Array.isArray(data.titles)) throw new Error("La respuesta no incluye el catálogo actualizado.");
      onSaved(data.titles);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "No se ha podido eliminar el título.");
    } finally {
      setParticipantBusy(false);
    }
  }

  function field(fieldName: keyof TitleDraft, label: string, value: string, extra: Record<string, string> = {}) {
    return editing
      ? <input {...extra} aria-label={`${label} de ${title.id}`} disabled={busy} className={inputClass} value={value} onChange={(event) => change(fieldName, event.target.value)} onBlur={saveIfChanged} />
      : value || "—";
  }

  return <Fragment>
    <tr id={`title-row-${title.id}`} className="border-t border-neutral-200 align-top">
      <td className="px-3 py-3 font-semibold">{field("id", "ID-Título", draft.id, {maxLength: "80"})}</td>
      <td className="px-3 py-3">{field("year", "Año", draft.year, {type: "number", min: "1800", max: "2200", step: "1"})}</td>
      <td className="px-3 py-3"><TitleImageCell title={title} admin={admin} editing={editing} onSaved={(nextTitles) => onSaved(nextTitles)} /></td>
      <td className="px-3 py-3 font-bold">{field("title", "Título", draft.title, {maxLength: "240"})}</td>
      <td className="px-3 py-3">{editing ? <div className="grid min-w-52 gap-1">
        <input aria-label={`Competición de ${title.id}`} disabled={busy} maxLength={240} className={inputClass} placeholder="Competición" value={draft.competition} onChange={(event) => change("competition", event.target.value)} onBlur={saveIfChanged} />
        <input aria-label={`Equipo de ${title.id}`} disabled={busy} maxLength={240} className={inputClass} placeholder="Equipo" value={draft.team} onChange={(event) => change("team", event.target.value)} onBlur={saveIfChanged} />
        <input aria-label={`Fecha de ${title.id}`} disabled={busy} maxLength={40} className={inputClass} placeholder="Fecha" value={draft.date} onChange={(event) => change("date", event.target.value)} onBlur={saveIfChanged} />
        <input aria-label={`Fuente de ${title.id}`} disabled={busy} maxLength={160} className={inputClass} placeholder="Nombre de la fuente" value={draft.source_name} onChange={(event) => change("source_name", event.target.value)} onBlur={saveIfChanged} />
        <input aria-label={`URL de la fuente de ${title.id}`} disabled={busy} type="url" maxLength={2048} className={inputClass} placeholder="URL de la fuente" value={draft.source_url} onChange={(event) => change("source_url", event.target.value)} onBlur={saveIfChanged} />
      </div> : <>{title.competition || "—"}{title.source_url && <a href={title.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-red-700 underline">Fuente: {title.source_name || "Ver fuente"}<ExternalLink size={12} aria-hidden="true" /></a>}</>}</td>
      <td className="px-3 py-3">{field("result", "Resultado", draft.result, {maxLength: "240"})}</td>
      <td className="px-3 py-3"><span>{titleParticipantCount(title)}</span><button type="button" aria-expanded={detailsOpen} aria-controls={`title-participants-${title.id}`} aria-label={`${detailsOpen ? "Ocultar" : "Ver"} participantes del título ${title.id}`} title="Ver participantes" onClick={onToggleDetails} className="ml-2 rounded border border-neutral-300 p-1.5 text-neutral-700 hover:text-red-700"><Eye size={16} aria-hidden="true" /></button></td>
      <td className="px-3 py-3"><div className="grid justify-items-start gap-1">
        <div className="inline-flex items-center gap-1">
          {admin && (editing ? <>
            <button type="button" disabled={busy || participantBusy} aria-label={`Guardar y salir del título ${title.id}`} title="Guardar y salir" onClick={() => void finishEditing()} className="rounded border border-green-200 bg-green-50 p-1.5 text-green-700 disabled:opacity-50"><Check size={17} aria-hidden="true" /></button>
            <button type="button" disabled={busy || participantBusy} aria-label={`Cancelar edición del título ${title.id}`} title="Cancelar edición" onClick={() => void cancelEditing()} className="rounded border border-neutral-300 p-1.5 text-neutral-700 disabled:opacity-50"><X size={17} aria-hidden="true" /></button>
          </> : <button type="button" disabled={busy || participantBusy} aria-expanded={editing} aria-controls={`title-row-${title.id}`} aria-label={`Editar título ${title.id}`} title="Editar título" onClick={() => {const fresh = draftFromTitle(title); draftRef.current = fresh; savedDraftRef.current = fresh; setDraft(fresh); setNotice(""); onToggleEditing();}} className="rounded border border-neutral-300 p-1.5 text-red-700 disabled:opacity-50"><Pencil size={17} aria-hidden="true" /></button>)}
          {admin && <button type="button" disabled={busy || participantBusy} aria-label={`Eliminar título ${title.id}`} title="Eliminar título" onClick={() => void deleteTitle()} className="rounded border border-neutral-300 p-1.5 text-red-700 disabled:opacity-50"><Trash2 size={17} aria-hidden="true" /></button>}
        </div>
        {admin && notice && <span role="status" className="max-w-48 text-xs text-red-700">{notice}</span>}
      </div></td>
    </tr>
    {detailsOpen && <tr><td colSpan={8} className="border-t border-neutral-100 bg-neutral-50 px-4 py-3">
      <section id={`title-participants-${title.id}`} aria-label={`Participantes del título ${title.id}`} className="grid max-w-xl gap-3">
        {admin && <div className="grid gap-2">
          <label className="grid max-w-xl gap-1 text-xs font-bold">Buscar jugador o staff para añadir<input type="search" disabled={participantBusy} value={participantQuery} onChange={(event) => setParticipantQuery(event.target.value)} placeholder="Nombre o ID…" className="rounded border bg-white p-2 text-sm font-normal" /></label>
          {participantQuery.trim() && <ul className="grid max-h-40 max-w-xl gap-1 overflow-y-auto rounded border border-neutral-200 bg-white p-2" aria-label="Resultados para añadir">{candidates.map((person) => <li key={person.id}><button type="button" disabled={participantBusy} onClick={() => addParticipant(person)} className="w-full rounded px-2 py-1 text-left text-sm hover:bg-neutral-100 disabled:opacity-50">{person.name} · {person.id} <span className="font-bold text-red-700">Añadir</span></button></li>)}{!candidates.length && <li role="status" className="text-xs text-neutral-500">No hay coincidencias disponibles.</li>}</ul>}
        </div>}
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Participantes asignados al título {title.id}</caption>
            <thead className="bg-neutral-50 text-xs font-bold uppercase text-neutral-600"><tr>
              <th scope="col" aria-sort={participantSort.key === "id" ? participantSort.direction === 1 ? "ascending" : "descending" : "none"} className="px-3 py-2"><button type="button" onClick={() => sortParticipants("id")} aria-label="Ordenar participantes por ID" className="inline-flex items-center gap-1">ID<span aria-hidden="true">{participantSort.key === "id" ? participantSort.direction === 1 ? "↑" : "↓" : "↕"}</span></button></th>
              <th scope="col" aria-sort={participantSort.key === "name" ? participantSort.direction === 1 ? "ascending" : "descending" : "none"} className="px-3 py-2"><button type="button" onClick={() => sortParticipants("name")} aria-label="Ordenar participantes por nombre" className="inline-flex items-center gap-1">Nombre<span aria-hidden="true">{participantSort.key === "name" ? participantSort.direction === 1 ? "↑" : "↓" : "↕"}</span></button></th>
              {admin && <th scope="col" className="px-3 py-2">Eliminar</th>}
            </tr></thead>
            <tbody>
              {participantRows.map((person) => <tr key={person.key} className="border-t border-neutral-100">
                <td className="px-3 py-2">{person.id}</td>
                <td className="px-3 py-2">{person.name}</td>
                {admin && <td className="px-3 py-2"><button type="button" disabled={participantBusy || participantCount <= 1} onClick={() => person.kind === "player" ? removePlayer(person.id) : person.kind === "staff" ? removeStaff(person.id) : removeUnlinked((title.unlinked_participants ?? []).indexOf(person.name))} aria-label={`Quitar a ${person.name} del título`} title="Quitar participante" className="rounded border border-neutral-300 p-1.5 text-red-700 disabled:opacity-40"><Trash2 size={16} aria-hidden="true" /></button></td>}
              </tr>)}
              {!participantCount && <tr><td colSpan={admin ? 3 : 2} className="px-3 py-3 text-sm text-neutral-500">No hay participantes asignados.</td></tr>}
            </tbody>
          </table>
        </div>
        {participantNotice && <p role="status" className="text-sm text-red-700">{participantNotice}</p>}
      </section>
    </td></tr>}
  </Fragment>;
}

export default function PlayerTitlesManager({initialFormOpen = false, embedded = false, onCountChange, onCreateFormClose}: {initialFormOpen?: boolean; embedded?: boolean; onCountChange?: (count: number) => void; onCreateFormClose?: () => void}) {
  const [titles, setTitles] = useState<PlayerTitle[] | null>(null);
  const [directory, setDirectory] = useState<DirectoryState | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(initialFormOpen);
  const [sort, setSort] = useState<TitleSort>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/player-titles", {cache: "no-store", signal: controller.signal}).then(async (response) => {
        const data = await responseJson<{error?: string; titles?: PlayerTitle[]}>(response);
        if (!response.ok || !Array.isArray(data.titles)) throw new Error(data.error || "No se han podido cargar los títulos.");
        return data.titles as PlayerTitle[];
      }),
      fetch("/api/noticias?view=participants", {cache: "no-store", signal: controller.signal}).then(async (response) => {
        const data = await responseJson<{error?: string; players?: Person[]; staff?: Person[]; admin?: boolean}>(response);
        if (!response.ok || !Array.isArray(data.players) || !Array.isArray(data.staff)) throw new Error(data.error || "No se han podido cargar los participantes.");
        return data as DirectoryState;
      }),
    ]).then(([titleRecords, participantDirectory]) => {
      setTitles(titleRecords);
      onCountChange?.(titleRecords.length);
      setDirectory(participantDirectory);
      setError("");
    }).catch((reason) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se han podido cargar los títulos.");
    });
    return () => controller.abort();
  }, [onCountChange]);

  const players = directory?.players ?? [];
  const staff = directory?.staff ?? [];
  const participants = [...players, ...staff];
  const names = new Map(participants.map((person) => [person.id, person.name]));
  const visibleTitles = (titles ?? []).filter((title) => {
    if (filter && !title.player_ids.includes(filter) && !title.staff_ids?.includes(filter)) return false;
    const searchable = normalize([
      title.id, playerTitleLabel(title), playerTitleYear(title)?.toString() ?? "", title.competition, title.result,
      title.team, title.date, title.source_name, ...title.player_ids.map((id) => names.get(id) ?? id),
      ...(title.staff_ids ?? []).map((id) => names.get(id) ?? id), ...(title.unlinked_participants ?? []),
    ].join(" "));
    return normalize(query).split(/\s+/).filter(Boolean).every((word) => searchable.includes(word));
  });
  const sortedTitles = sort
    ? [...visibleTitles].sort((left, right) => {
      const leftValue = titleSortValue(left, sort.key);
      const rightValue = titleSortValue(right, sort.key);
      const order = typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue), "es", {numeric: true, sensitivity: "base"});
      return order * sort.direction;
    })
    : visibleTitles;
  const updateTitles = (nextTitles: PlayerTitle[]) => {
    setTitles(nextTitles);
    onCountChange?.(nextTitles.length);
    setError("");
  };
  const sortHeader = (key: TitleSortKey, label: string) => {
    const active = sort?.key === key;
    return <th scope="col" aria-sort={active ? sort.direction === 1 ? "ascending" : "descending" : "none"} className="px-3 py-3">
      <button type="button" aria-label={`Ordenar por ${label}`} onClick={() => setSort((current) => ({key, direction: current?.key === key && current.direction === 1 ? -1 : 1}))} className="inline-flex items-center gap-1 text-left hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
        {label}<span aria-hidden="true">{active ? sort.direction === 1 ? "↑" : "↓" : "↕"}</span>
      </button>
    </th>;
  };

  return <section aria-label="Títulos deportivos">
      <div className="flex flex-wrap items-center justify-between gap-3">{embedded ? <h2 className="text-xl font-black">Títulos</h2> : <h1 className="text-2xl font-black">Títulos</h1>}{directory?.admin && !embedded && <button type="button" aria-expanded={formOpen} aria-controls="title-create-block" onClick={() => {setFormOpen((open) => !open); setEditingId(null);}} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white">{formOpen ? "Cerrar alta" : "+ Título"}</button>}</div>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {!titles && !error && <p className="mt-4 text-sm text-neutral-500">Cargando títulos…</p>}
      {directory?.admin && formOpen && <TitleForm players={players} staff={staff} onSaved={updateTitles} onClose={() => {setFormOpen(false); onCreateFormClose?.();}} />}
      <div className="my-4 flex flex-wrap items-end gap-3">
        <SearchablePicker label="Jugador o staff" placeholder="Buscar participante…" emptyLabel="Todos los participantes" options={participants.map((person) => ({...person, name: `${person.name} · ${person.id}`}))} value={filter} onChange={setFilter} inputClass="min-w-[250px] rounded border bg-white p-2 text-sm font-normal" />
        <label className="grid min-w-[250px] gap-1 text-xs font-bold">Buscar título<input type="search" placeholder="ID, competición, año, jugador o staff…" value={query} onChange={(event) => setQuery(event.target.value)} className="rounded border bg-white p-2 text-sm font-normal" /></label>
        {(filter || query) && <button type="button" onClick={() => {setFilter(""); setQuery("");}} className="rounded border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-red-700">Limpiar filtros</button>}
      </div>
      <p className="mb-3 text-sm text-neutral-600">{visibleTitles.length} títulos</p>
      {visibleTitles.length ? <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <caption className="sr-only">Títulos deportivos, imágenes y participantes asociados</caption>
          <thead className="bg-neutral-50 text-xs font-bold uppercase tracking-wide text-neutral-600"><tr>
            {sortHeader("id", "ID-Título")}{sortHeader("year", "Año")}{sortHeader("image", "Imagen")}{sortHeader("title", "Título")}{sortHeader("competition", "Competición")}{sortHeader("result", "Resultado")}{sortHeader("participants", "Participantes")}<th scope="col" className="px-3 py-3">Acciones</th>
          </tr></thead>
          <tbody>{sortedTitles.map((title) => <Fragment key={title.id}>
            <InlineTitleRow
              title={title}
              names={names}
              players={players}
              staff={staff}
              admin={Boolean(directory?.admin)}
              editing={editingId === title.id}
              detailsOpen={detailsId === title.id}
              onToggleEditing={() => {const entering = editingId !== title.id; setEditingId(entering ? title.id : null); setDetailsId(entering ? title.id : null); setFormOpen(false);}}
              onToggleDetails={() => setDetailsId((current) => current === title.id ? null : title.id)}
              onFinishEditing={() => {setEditingId(null); setDetailsId(null);}}
              onSaved={(nextTitles, updatedId) => {updateTitles(nextTitles); if (updatedId) {setEditingId(updatedId); setDetailsId(updatedId);}}}
            />
          </Fragment>)}</tbody>
        </table>
      </div> : titles && <p className="rounded-xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600">{titles.length ? "No hay títulos que coincidan con la búsqueda." : "No hay títulos registrados."}</p>}
  </section>;
}
