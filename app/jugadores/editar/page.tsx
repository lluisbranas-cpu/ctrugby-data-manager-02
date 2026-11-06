"use client";
import { parseBirthInput, formatBirthInput, formatBirthEditInput } from "@/lib/birth-date";
import { PlayerEditBlock } from "@/app/components/player-edit-block";
import { SearchablePicker } from "@/app/components/club-picker";
import { normalizePhone, formatSpanishPhone } from "@/lib/phone-number";
import type { PlayerEventSizes } from "@/lib/player-event-sizes";
/* eslint-disable @next/next/no-img-element */

import { trajectorySeasonYears } from "@/lib/trajectory-season-input";
import { DeleteButton } from "@/app/components/delete-button";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";
import Link from "@/app/components/sport-link";
import { AlertTriangle, Camera, Check, PersonStanding, Star, UserRound, X, Save, Pencil } from "lucide-react";
import { ImageUploadEditor } from "@/app/components/image-upload-editor";
import { emptyBilling, type PlayerBilling } from "@/lib/player-billing-types";

type PlayerOption = { id: string; first_name: string; last_name: string | null };

type ReviewState = {
  event_sizes?: PlayerEventSizes;
  career?: {retired: boolean; staff_id: string | null};
  staff_options?: {id: string; name: string}[];
  players?: PlayerOption[];
  suggested_id: string;
  expires_at: string;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  primary_photo_season: string | null;
  player: { nickname?: string | null; club_id?: string | null; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; birth_date?: string | null; dni: string | null; instagram: string | null; height_cm: number | null; weight_kg: number | null; allergies: string | null; dietary_conditions: string | null; medications: string | null };
  clubs: { id: string; name: string }[];
  campus_types: { id: string; label: string; siglas: string | null }[];
  professional_categories: { id: string; label: string; siglas: string | null }[];
  seasons: SeasonRow[];
  participations: ParticipationDraft[];
  selections: SelectionDraft[];
  professional_club_records: ProfessionalClubDraft[];
  contacts: { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null } | null;
  billing?: PlayerBilling;
  private_consents?: { food: boolean; medical: boolean; technical: boolean };
  saved_submission: { submitted_at: string; payload: SavedPayload } | null;
};
type SeasonRow = { season_year: number; playing_category?: string | null; competition_category?: string | null; club_id: string | null; club_name: string | null; legacy_club_name: string | null; position_text: string | null; photo_url: string | null };
type RowMeta = { _rowKey?: string; _pending?: boolean };

type SeasonDraft = RowMeta & { season_input?: string; season_year: number; competition_category: string; playing_category: string; club_id: string; club_name: string; position_text?: string | null; photo_url?: string | null };
type ParticipationDraft = RowMeta & { year: string; campus: string };
type SelectionDraft = RowMeta & { federation_id: string; scope: string; category: string; format: string; season_label: string; club_text: string };
type ProfessionalClubDraft = RowMeta & { id?: string; club_id: string; club_name: string; category: string; season_label: string; notes: string };
type AuthorizationDraft = { basic_publication: string; sensitive_internal_use: boolean; adult_self_declared: boolean };
type SavedPayload = {
  event_sizes?: PlayerEventSizes;
  career?: {retired: boolean; staff_id: string | null};
  billing?: PlayerBilling;
  player?: Partial<Record<"nickname" | "club_id" | "first_name" | "last_name" | "category" | "dni" | "instagram" | "position_text" | "allergies" | "dietary_conditions" | "medications", string | null>> & { birth_year?: number | null; birth_date?: string | null; height_cm?: number | null; weight_kg?: number | null };
  contacts?: Partial<Record<keyof typeof emptyContacts, string | null>>;
  seasons?: SeasonDraft[];
  participations?: ParticipationDraft[];
  selections?: SelectionDraft[];
  professional_club_records?: ProfessionalClubDraft[];
  preferred_profile_photo_season?: number | null;
  authorizations?: Partial<AuthorizationDraft>;
  observations?: string | null;
};

const fieldClass = "mt-1 w-full rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-red-500";
const labelClass = "text-xs font-black uppercase tracking-[.08em] text-neutral-500";
const helpClass = "text-xs font-semibold leading-5 text-neutral-500";
const sectionTitleClass = "text-sm font-black uppercase tracking-[.14em] text-neutral-800";
const emptyContacts = { player_email: "", player_phone_e164: "", tutor1_name: "", tutor1_email: "", tutor1_phone_e164: "", tutor2_name: "", tutor2_email: "", tutor2_phone_e164: "" };
const seasonCategoryOptions = ["S6", "S8", "S10", "S12", "S14", "S16", "S17", "S18", "S19", "S20", "S23", "Sénior", "Inactivo"];

function ConfirmableRow({ editing, columns, summary, children, onConfirm, onEdit, onRemove }: { editing: boolean; columns: string; summary: string[]; children: ReactNode; onConfirm: () => void; onEdit: () => void; onRemove: () => void }) {
  return <div className="flex items-center gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3">
    <div className={"grid min-w-0 flex-1 items-center gap-3 " + columns}>{editing ? children : summary.map((value, index) => <span key={index} className="min-w-0 break-words text-sm font-semibold">{value || "—"}</span>)}</div>
    <div className="flex shrink-0 items-center gap-2">
      {editing ? <button type="button" onClick={onConfirm} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-red-200 bg-white text-red-700" title="Guardar entrada" aria-label="Guardar entrada"><Save size={16} aria-hidden="true"/></button> : <button type="button" onClick={onEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-neutral-300 bg-white text-neutral-700" title="Editar entrada" aria-label="Editar entrada"><Pencil size={16} aria-hidden="true"/></button>}
      <DeleteButton type="button" onClick={onRemove} aria-label="Eliminar entrada de la tabla" className="rounded-[8px] border border-red-200 p-2" />
    </div>
  </div>;
}

export default function EditPlayerPage() {
  const sportLabel = "Rugby";
  const clientHeader = <header className="player-edit-client-header"><Link href="/jugadores" className="player-edit-client-brand" aria-label={`Volver al directorio de ${sportLabel}`}><span aria-hidden="true" className="player-edit-client-logo"/><span><small>{sportLabel}</small><strong>GESTIÓN DE JUGADORES</strong></span></Link></header>;
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const blockRollback = useRef<(() => void) | null>(null);
  const [nextPlayerId, setNextPlayerId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [playerId, setPlayerId] = useState("");
  const createdPlayer = useRef<string | null>(null);
  const reviewToken = useRef<string | null>(null);
  const [loadingId, setLoadingId] = useState(false);
  const [existingPlayer, setExistingPlayer] = useState(false);
  const [checkedId, setCheckedId] = useState("");
  const [resumePlayerId, setResumePlayerId] = useState<string | null>(null);
  const loadSequence = useRef(0);
  const blankState = useRef<ReviewState | null>(null);
  const [state, setState] = useState<ReviewState | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [incompleteSave, setIncompleteSave] = useState(false);
  const [draft, setDraft] = useState({
    nickname: "",
    club_id: "",
    first_name: "",
    last_name: "",
    category: "",
    birth_year: "",
    dni: "",
    instagram: "",
    position_text: "",
    height_cm: "",
    weight_kg: "",
    dietary_conditions: "",
    allergies: "",
    medications: "",
    observations: "",
    ...emptyContacts,
  });
  const [seasonDrafts, setSeasonDrafts] = useState<SeasonDraft[]>([]);
  const [participationDrafts, setParticipationDrafts] = useState<ParticipationDraft[]>([]);
  const [selectionDrafts, setSelectionDrafts] = useState<SelectionDraft[]>([]);
  const [professionalClubDrafts, setProfessionalClubDrafts] = useState<ProfessionalClubDraft[]>([]);
  const [preferredSeasonPhotoYear, setPreferredSeasonPhotoYear] = useState("");
  const [authorizations, setAuthorizations] = useState<AuthorizationDraft>({ basic_publication: "", sensitive_internal_use: false, adult_self_declared: false });
  const [eventSizes, setEventSizes] = useState<PlayerEventSizes>({technical_shirt: "", playing_shirt: "", playing_shorts: "", bermudas: ""});
  const [career, setCareer] = useState({retired: false, staff_id: null as string | null});
  const [billing, setBilling] = useState<PlayerBilling>(emptyBilling());
  const [privateConsents, setPrivateConsents] = useState({ food: false, medical: false, technical: false });
  const [showSecondTutor, setShowSecondTutor] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({ player_photo_original: null, player_photo_prepared: null, dni_front: null, dni_back: null, extra_image: null });
  const [photoEditorFile, setPhotoEditorFile] = useState<File | null>(null);
  const [seasonPhotoEditor, setSeasonPhotoEditor] = useState<{ year: number; file: File } | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [seasonPhotoPreviewUrls, setSeasonPhotoPreviewUrls] = useState<Record<string, string>>({});

  const fillForm = useCallback((data: ReviewState) => {
        setState(data);
        const saved = data.saved_submission?.payload;
        const savedPlayer = saved?.player ?? {};
        const savedContacts = saved?.contacts ?? {};
        setDraft({
          nickname: String(savedPlayer.nickname ?? data.player.nickname ?? ""),
          club_id: String(savedPlayer.club_id ?? data.player.club_id ?? data.seasons[0]?.club_id ?? ""),
          dietary_conditions: String(savedPlayer.dietary_conditions ?? data.player.dietary_conditions ?? ""),
          first_name: String(savedPlayer.first_name ?? data.player.first_name ?? ""),
          last_name: String(savedPlayer.last_name ?? data.player.last_name ?? ""),
          category: String(savedPlayer.category ?? data.player.category ?? ""),
          birth_year: formatBirthEditInput(savedPlayer.birth_date ?? data.player.birth_date, savedPlayer.birth_year ?? data.player.birth_year),
          dni: String(savedPlayer.dni ?? data.player.dni ?? ""),
          instagram: String(savedPlayer.instagram ?? data.player.instagram ?? ""),
          position_text: String(savedPlayer.position_text ?? saved?.seasons?.find((season) => season.position_text)?.position_text ?? data.seasons.find((season) => season.position_text)?.position_text ?? ""),
          height_cm: savedPlayer.height_cm ? String(savedPlayer.height_cm) : data.player.height_cm ? String(data.player.height_cm) : "",
          weight_kg: savedPlayer.weight_kg ? String(savedPlayer.weight_kg) : data.player.weight_kg ? String(data.player.weight_kg) : "",
          allergies: String(savedPlayer.allergies ?? data.player.allergies ?? ""),
          medications: String(savedPlayer.medications ?? data.player.medications ?? ""),
          observations: saved?.observations ?? "",
          player_email: String(savedContacts.player_email ?? data.contacts?.player_email ?? ""),
          player_phone_e164: formatSpanishPhone(savedContacts.player_phone_e164 ?? data.contacts?.player_phone_e164),
          tutor1_name: String(savedContacts.tutor1_name ?? data.contacts?.tutor1_name ?? ""),
          tutor1_email: String(savedContacts.tutor1_email ?? data.contacts?.tutor1_email ?? ""),
          tutor1_phone_e164: formatSpanishPhone(savedContacts.tutor1_phone_e164 ?? data.contacts?.tutor1_phone_e164),
          tutor2_name: String(savedContacts.tutor2_name ?? data.contacts?.tutor2_name ?? ""),
          tutor2_email: String(savedContacts.tutor2_email ?? data.contacts?.tutor2_email ?? ""),
          tutor2_phone_e164: formatSpanishPhone(savedContacts.tutor2_phone_e164 ?? data.contacts?.tutor2_phone_e164),
        });
        const savedSeasons = saved?.seasons?.map((season) => ({
          season_year: season.season_year,
          competition_category: String(season.competition_category ?? data.seasons.find(item => item.season_year === season.season_year)?.competition_category ?? ""), playing_category: String(season.playing_category ?? ""),
          club_id: String(season.club_id ?? ""),
          club_name: String(season.club_name ?? ""),
          photo_url: data.seasons.find((item) => item.season_year === season.season_year)?.photo_url ?? null,
        }));
        setSeasonDrafts((savedSeasons?.length ? savedSeasons : data.seasons.map((season) => ({
          season_year: season.season_year,
          competition_category: season.competition_category ?? "", playing_category: season.playing_category ?? "",
          club_id: season.club_id ?? "",
          club_name: season.club_name ?? season.legacy_club_name ?? "",
          photo_url: season.photo_url,
        }))).sort((left, right) => right.season_year - left.season_year));
        setParticipationDrafts((saved?.participations?.length ? saved.participations : data.participations).map((entry) => ({ year: String(entry.year ?? ""), campus: String(entry.campus ?? "") })).sort((left, right) => Number(right.year) - Number(left.year)));
        setSelectionDrafts((saved?.selections?.length ? saved.selections : data.selections).map((entry) => ({
          federation_id: String(entry.federation_id ?? ""),
          scope: String(entry.scope ?? ""),
          category: String(entry.category ?? ""),
          format: String(entry.format ?? ""),
          season_label: String(entry.season_label ?? ""),
          club_text: String(entry.club_text ?? ""),
        })).sort((left, right) => right.season_label.localeCompare(left.season_label, "es")));
        setProfessionalClubDrafts((saved?.professional_club_records?.length ? saved.professional_club_records : data.professional_club_records).map((entry) => ({
          id: entry.id,
          club_id: String(entry.club_id ?? ""),
          club_name: String(entry.club_name ?? ""),
          category: String(entry.category ?? ""),
          season_label: String(entry.season_label ?? ""),
          notes: String(entry.notes ?? ""),
        })).sort((left, right) => right.season_label.localeCompare(left.season_label, "es") || left.club_name.localeCompare(right.club_name, "es")));
        setPreferredSeasonPhotoYear(saved?.preferred_profile_photo_season ? String(saved.preferred_profile_photo_season) : data.primary_photo_season ? String(data.primary_photo_season) : "");
        setAuthorizations({
          basic_publication: String(saved?.authorizations?.basic_publication ?? ""),
          sensitive_internal_use: Boolean(saved?.authorizations?.sensitive_internal_use),
          adult_self_declared: Boolean(saved?.authorizations?.adult_self_declared),
        });
        setBilling(saved?.billing ?? data.billing ?? emptyBilling());
        setEventSizes(saved?.event_sizes ?? data.event_sizes ?? {technical_shirt: "", playing_shirt: "", playing_shorts: "", bermudas: ""});
        setCareer(saved?.career ?? data.career ?? {retired: false, staff_id: null});
        setPrivateConsents(data.private_consents ?? { food: false, medical: false, technical: false });
        setShowSecondTutor(Boolean(savedContacts.tutor2_name ?? savedContacts.tutor2_email ?? savedContacts.tutor2_phone_e164 ?? data.contacts?.tutor2_name ?? data.contacts?.tutor2_email ?? data.contacts?.tutor2_phone_e164));

        setFiles({ player_photo_original: null, player_photo_prepared: null, dni_front: null, dni_back: null, extra_image: null });
        setPhotoPreviewUrl(null);
        setSeasonPhotoPreviewUrls({});
        setPhotoEditorFile(null);
        setSeasonPhotoEditor(null);
        setSent(false);
        setIncompleteSave(false);
  }, [setEventSizes, setCareer, setAuthorizations, setBilling, setPrivateConsents, setShowSecondTutor, setPhotoEditorFile, setSeasonPhotoEditor, setSeasonDrafts, setParticipationDrafts, setSelectionDrafts, setProfessionalClubDrafts]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/jugadores/alta", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se ha podido cargar el formulario.");
        return data as ReviewState;
      })
      .then((data) => {
        blankState.current = data;
        setPlayers(data.players ?? []);
        setCheckedId(data.suggested_id);
        setNextPlayerId(data.suggested_id);
        setPlayerId(data.suggested_id);
        fillForm(data);
      })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se ha podido cargar el formulario."); });
    return () => controller.abort();
  }, [fillForm]);

  const loadPlayerId = async (selectedId: string) => {
    const id = selectedId.trim().toUpperCase();
    if (!/^JUG\d{4}$/.test(id)) { setNotice("Indica un ID con formato JUG0000."); return; }
    const sequence = ++loadSequence.current;
    setLoadingId(true);
    setNotice("");
    try {
      const response = await fetch("/api/jugadores/alta", { cache: "no-store" });
      const catalog = await response.json() as { admin?: boolean; players?: { id: string }[]; error?: string };
      if (!response.ok || !catalog.players) throw new Error(catalog.error || "No se ha podido comprobar la ID.");
      if (sequence !== loadSequence.current) return;
      if (catalog.players.some((player) => player.id === id)) {
        const linkResponse = await fetch("/api/revision-jugador/crear", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ player_id: id }),
        });
        const link = await linkResponse.json() as { token?: string; error?: string };
        if (!linkResponse.ok || !link.token) throw new Error(link.error || "No se ha podido abrir la ficha.");
        const dataResponse = await fetch(`/api/revision-jugador/${link.token}`, { cache: "no-store" });
        const data = await dataResponse.json();
        if (!dataResponse.ok) throw new Error(data.error || "No se han podido cargar todos los datos.");
        if (sequence !== loadSequence.current) return;
        fillForm(data as ReviewState);
        createdPlayer.current = id;
        reviewToken.current = link.token;
        setExistingPlayer(true);
        setNotice(`Ficha ${id} cargada. Puedes modificar todos sus campos.`);
      } else {
        if (blankState.current) fillForm(blankState.current);
        createdPlayer.current = null;
        reviewToken.current = null;
        setExistingPlayer(false);
        setNotice(`La ID ${id} es nueva. Completa los datos para crear el jugador.`);
      }
      setCheckedId(id);
      setPlayerId(id);
      setFormOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (sequence === loadSequence.current) setNotice(error instanceof Error ? error.message : "No se ha podido cargar la ficha.");
    } finally {
      if (sequence === loadSequence.current) setLoadingId(false);
    }
  };

  const name = useMemo(() => [draft.first_name, draft.last_name].filter(Boolean).join(" ") || "Jugador", [draft.first_name, draft.last_name]);
  const isAdultByBirthYear = (parseBirthInput(draft.birth_year)?.birth_year ?? 0) > 0 && new Date().getFullYear() - (parseBirthInput(draft.birth_year)?.birth_year ?? 0) >= 18;
  const setValue = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const setBillingValue = (field: keyof PlayerBilling, value: string) => setBilling((current) => ({ ...current, [field]: value }));
  const editRow = <T extends RowMeta,>(setter: Dispatch<SetStateAction<T[]>>, index: number) => setter((rows) => rows.map((row, i) => i === index ? { ...row, _pending: true, _rowKey: row._rowKey ?? crypto.randomUUID() } : row));
  const confirmRow = <T extends RowMeta,>(setter: Dispatch<SetStateAction<T[]>>, index: number, valid: boolean) => {
    if (!valid) { setNotice("Completa una temporada válida (25/26 o 2026), el año y la entidad que corresponda. No repitas temporadas en la trayectoria."); return; }
    setter((rows) => rows.map((row, i) => i === index ? { ...row, _pending: false } : row));
    setNotice("");
  };
  const removeRow = <T extends RowMeta,>(setter: Dispatch<SetStateAction<T[]>>, index: number) => setter((rows) => rows.filter((_, i) => i !== index));
  const seasonYearFromInput = (value: string) => trajectorySeasonYears(value).at(-1) ?? 0;
  const confirmTrajectory = (index: number) => {
    const row = seasonDrafts[index];
    const years = trajectorySeasonYears(row.season_input ?? String(row.season_year));
    if (!years.length || !(row.club_id || row.club_name) || seasonDrafts.some((other, i) => i !== index && years.includes(other.season_year))) {
      setNotice("Completa una temporada o periodo válido (25/26 o 23-27) y el club. No repitas temporadas en la trayectoria.");
      return;
    }
    setSeasonDrafts((rows) => rows.flatMap((item, i) => i !== index ? [item] : years.map((year) => ({ ...item, season_year: year, season_input: undefined, _pending: false, _rowKey: crypto.randomUUID() }))));
    setNotice("");
  };
  const setSeasonValue = (index: number, field: keyof Omit<SeasonDraft, "season_year">, value: string) => setSeasonDrafts((current) => current.map((season, i) => i === index ? { ...season, [field]: value } : season));
  const setSeasonClub = (index: number, value: string) => {
    const club = state?.clubs.find((item) => item.id === value);
    setSeasonDrafts((current) => current.map((season, i) => i === index ? { ...season, club_id: club?.id ?? "", club_name: club?.name ?? (value.startsWith("legacy:") ? value.slice(7) : "") } : season));
  };
  const addTrajectory = () => {
    setSeasonDrafts((current) => [{ _rowKey: crypto.randomUUID(), _pending: true, season_year: 0, season_input: "", competition_category: "", playing_category: "", club_id: "", club_name: "", photo_url: null }, ...current]);
  };
  const setParticipationValue = (index: number, field: keyof ParticipationDraft, value: string) => setParticipationDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const addParticipation = () => {
    setParticipationDrafts((current) => [{ _rowKey: crypto.randomUUID(), _pending: true, year: "", campus: "" }, ...current]);
  };
  const setSelectionValue = (index: number, field: keyof SelectionDraft, value: string) => setSelectionDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const addSelection = () => setSelectionDrafts((current) => [{ _rowKey: crypto.randomUUID(), _pending: true, federation_id: "", scope: "", category: "", format: "", season_label: "", club_text: "" }, ...current]);
  const setProfessionalClubValue = (index: number, field: keyof ProfessionalClubDraft, value: string) => setProfessionalClubDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const setProfessionalClub = (index: number, value: string) => {
    const club = state?.clubs.find((item) => item.id === value);
    setProfessionalClubDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, club_id: club?.id ?? "", club_name: club?.name ?? (value.startsWith("legacy:") ? value.slice(7) : "") } : entry));
  };
  const addProfessionalClub = () => setProfessionalClubDrafts((current) => [{ _rowKey: crypto.randomUUID(), _pending: true, club_id: "", club_name: "", category: "", season_label: "", notes: "" }, ...current]);
  const chooseSeasonPhoto = (year: number, file: File | null) => {
    if (!file) return;
    setSeasonPhotoEditor({ year, file });
    setPreferredSeasonPhotoYear((current) => current || String(year));
  };
  const saveSeasonPreparedPhoto = async (blob: Blob) => {
    if (!seasonPhotoEditor) return;
    const year = seasonPhotoEditor.year;
    const prepared = new File([blob], `foto-temporada-${year}.png`, { type: "image/png" });
    setFiles((current) => ({ ...current, [`season_photo_${year}`]: prepared }));
    setSeasonPhotoPreviewUrls((current) => {
      const previous = current[String(year)];
      if (previous) URL.revokeObjectURL(previous);
      return { ...current, [String(year)]: URL.createObjectURL(blob) };
    });
    setSeasonPhotoEditor(null);
  };
  const togglePreferredSeasonPhoto = (year: number) => setPreferredSeasonPhotoYear((current) => current === String(year) ? "" : String(year));
  const choosePlayerPhoto = (file: File | null) => {
    if (!file) return;
    setFiles((current) => ({ ...current, player_photo_original: file }));
    setPhotoEditorFile(file);
  };
  const savePreparedPhoto = async (blob: Blob) => {
    const prepared = new File([blob], "foto-jugador-preparada.png", { type: "image/png" });
    setFiles((current) => ({ ...current, player_photo_prepared: prepared }));
    setPhotoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(blob);
    });
    setPhotoEditorFile(null);
  };

  const submit = async (keepOpen = false): Promise<boolean> => {
    if (loadingId || checkedId !== playerId.trim().toUpperCase()) { setNotice("Espera a que se compruebe la ID antes de guardar."); return false; }
    setNotice("");
    if (!/^JUG\d{4}$/.test(playerId.trim().toUpperCase())) { setNotice("Indica un ID con formato JUG0000."); return false; }
    if (!draft.first_name.trim()) {
      setNotice("Indica el nombre del jugador.");
      return false;
    }
    if ([...seasonDrafts, ...participationDrafts, ...selectionDrafts, ...professionalClubDrafts].some((row) => row._pending)) {
      setNotice("Pulsa el disquete Guardar entrada en las filas que estás editando antes de enviar la ficha.");
      return false;
    }
    const birth = parseBirthInput(draft.birth_year);
    if (!birth) {setNotice("Indica nacimiento como AAAA o DD/MM/AAAA.");return false;}
    setSaving(true);
    try {
      const form = new FormData();
      form.set("data", JSON.stringify({
        submitted_name: name,
        event_sizes: eventSizes,
        career,
        player: {
          nickname: draft.nickname.trim() || null,
          club_id: draft.club_id || null,
          dietary_conditions: draft.dietary_conditions.trim() || null,
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim() || null,
          category: draft.category || null,
          birth_year: birth.birth_year, birth_date: birth.birth_date,
          dni: draft.dni.trim().toUpperCase() || null,
          instagram: draft.instagram.trim() || null,
          position_text: draft.position_text.trim() || null,
          height_cm: draft.height_cm ? Number(draft.height_cm) : null,
          weight_kg: draft.weight_kg ? Number(draft.weight_kg) : null,
          allergies: draft.allergies.trim() || null,
          medications: draft.medications.trim() || null,
        },
        seasons: seasonDrafts.map((season) => ({
          season_year: season.season_year,
          competition_category: season.competition_category.trim() || null, playing_category: season.playing_category.trim() || null,
          club_id: season.club_id || null,
          club_name: season.club_name.trim() || null,
        })),
        participations: participationDrafts.map((entry) => ({
          year: entry.year.trim(),
          campus: entry.campus,
        })).filter((entry) => entry.year || entry.campus),
        selections: selectionDrafts.map((entry) => ({
          federation_id: entry.federation_id.trim() || null,
          scope: entry.scope.trim() || null,
          category: entry.category.trim() || null,
          format: entry.format.trim() || null,
          season_label: entry.season_label.trim() || null,
          club_text: entry.club_text.trim() || null,
        })).filter((entry) => entry.federation_id || entry.scope || entry.category || entry.format || entry.season_label || entry.club_text),
        professional_club_records: professionalClubDrafts.map((entry) => ({
          club_id: entry.club_id || null,
          club_name: entry.club_name.trim() || null,
          category: entry.category.trim() || null,
          season_label: entry.season_label.trim() || null,
          notes: entry.notes.trim() || null,
        })).filter((entry) => entry.club_id || entry.club_name || entry.category || entry.season_label || entry.notes),
        preferred_profile_photo_season: preferredSeasonPhotoYear ? Number(preferredSeasonPhotoYear) : null,
        authorizations: {
          basic_publication: authorizations.basic_publication || null,
          sensitive_internal_use: true,
          adult_self_declared: authorizations.adult_self_declared,
          sensitive_internal_scope: "DNI, contacto, necesidades alimenticias, necesidades medicas, medicamentos, informes tecnicos e imagenes originales quedan solo para uso interno de CTRugby.",
        },
        billing,
        private_consents: privateConsents,
        contacts: {
          player_email: draft.player_email.trim().toLowerCase() || null,
          player_phone_e164: normalizePhone(draft.player_phone_e164),
          tutor1_name: billing.full_name.trim() || draft.tutor1_name.trim() || null,
          tutor1_email: draft.tutor1_email.trim().toLowerCase() || null,
          tutor1_phone_e164: normalizePhone(draft.tutor1_phone_e164),
          tutor2_name: draft.tutor2_name.trim() || null,
          tutor2_email: draft.tutor2_email.trim().toLowerCase() || null,
          tutor2_phone_e164: normalizePhone(draft.tutor2_phone_e164),
        },
        observations: draft.observations.trim() || null,
      }));
      for (const [field, file] of Object.entries(files)) if (file) form.set(field, file);
      // Retain successful steps when a later save fails, so retry does not create another player.
      if (!createdPlayer.current) {
        const createdResponse = await fetch("/api/jugadores", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "create-player", auto_id: true, id: playerId.trim().toUpperCase(),
            first_name: draft.first_name.trim(), last_name: draft.last_name.trim() || null,
            category: draft.category || null, birth_year: birth.birth_year, birth_date: birth.birth_date,
            dni: draft.dni.trim().toUpperCase() || null, instagram: draft.instagram.trim() || null,
            published: true, season: null }),
        });
        const created = await createdResponse.json() as { id?: string; existing_player_id?: string; error?: string };
        if (created.existing_player_id) setResumePlayerId(created.existing_player_id);
        if (created.id) {
          createdPlayer.current = created.id;
          setPlayerId(created.id);
          setCheckedId(created.id);
        }
        if (!createdResponse.ok || !created.id) throw new Error(created.error || "No se ha podido crear el jugador.");
      }
      if (!reviewToken.current) {
        const tokenResponse = await fetch("/api/revision-jugador/crear", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: createdPlayer.current }),
        });
        const link = await tokenResponse.json() as { token?: string; error?: string };
        if (!tokenResponse.ok || !link.token) throw new Error(link.error || "No se ha podido preparar el guardado de los datos completos.");
        reviewToken.current = link.token;
      }
      const response = await fetch(`/api/revision-jugador/${reviewToken.current}`, { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se ha podido guardar la revision.");
      setIncompleteSave(false);
      if (keepOpen) {setExistingPlayer(true); setNotice("Bloque guardado.");} else setSent(true);
      return true;
    } catch (error) {
      setIncompleteSave(Boolean(createdPlayer.current));
      setNotice((createdPlayer.current ? `La ficha ${createdPlayer.current} ya está creada. Conserva esta página y pulsa Completar guardado para terminar el envío. ` : "") + (error instanceof Error ? error.message : "No se ha podido guardar el alta."));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const beginBlockEdit = (key: string) => {
    const snapshot = {draft:structuredClone(draft),billing:structuredClone(billing),career:structuredClone(career),eventSizes:structuredClone(eventSizes),privateConsents:structuredClone(privateConsents),authorizations:structuredClone(authorizations),seasons:structuredClone(seasonDrafts),participations:structuredClone(participationDrafts),selections:structuredClone(selectionDrafts),professionals:structuredClone(professionalClubDrafts),files:{...files},seasonPhotoPreviewUrls:{...seasonPhotoPreviewUrls},preferredSeasonPhotoYear};
    blockRollback.current = () => {setDraft(snapshot.draft);setBilling(snapshot.billing);setCareer(snapshot.career);setEventSizes(snapshot.eventSizes);setPrivateConsents(snapshot.privateConsents);setAuthorizations(snapshot.authorizations);setSeasonDrafts(snapshot.seasons);setParticipationDrafts(snapshot.participations);setSelectionDrafts(snapshot.selections);setProfessionalClubDrafts(snapshot.professionals);setFiles(snapshot.files);setSeasonPhotoPreviewUrls(snapshot.seasonPhotoPreviewUrls);setPreferredSeasonPhotoYear(snapshot.preferredSeasonPhotoYear);};
    setNotice(""); setEditingBlock(key);
  };
  const saveEditingBlock = async () => {if(await submit(true)){blockRollback.current=null;setEditingBlock(null);}};
  const cancelEditingBlock = () => {blockRollback.current?.();blockRollback.current=null;setEditingBlock(null);setNotice("");};

  const startNewPlayer = async () => {
    setLoadingId(true);
    setNotice("");
    try {
      const response = await fetch("/api/jugadores/alta", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido obtener el próximo ID.");
      blankState.current = data;
      setPlayers(data.players ?? []);
      fillForm(data);
      setCheckedId(data.suggested_id);
        setNextPlayerId(data.suggested_id);
      setPlayerId(data.suggested_id);
      createdPlayer.current = null;
      reviewToken.current = null;
      setResumePlayerId(null);
      setExistingPlayer(false);
      setFormOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido abrir el alta.");
    } finally {
      setLoadingId(false);
    }
  };
  const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
  const searchTerms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const matchingPlayers = searchTerms.length ? players.filter((player) => {
    const text = normalizeSearch(`${player.first_name} ${player.last_name ?? ""} ${player.id}`);
    return searchTerms.every((term) => text.includes(term));
  }).sort((a, b) => `${a.first_name} ${a.last_name ?? ""}`.localeCompare(`${b.first_name} ${b.last_name ?? ""}`, "es")) : [];

  if (!formOpen) return <main className="player-edit-page min-h-screen bg-neutral-100 px-4 pb-8 pt-24 text-neutral-950">{clientHeader}
    <section className="mx-auto grid max-w-4xl gap-6 rounded-[8px] bg-white p-6 shadow-sm sm:p-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[.18em] text-red-700">Gestión de jugadores</p>
        <h1 className="mt-2 text-3xl font-black uppercase">Editar jugador</h1>
        <p className="mt-2 text-sm text-neutral-600">Busca un jugador para editar sus datos. También puedes añadir uno nuevo.</p>
      </header>
      <label className={labelClass}>Buscar jugador por nombre o ID
        <input type="search" className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej. nombre, apellidos o JUG0001" disabled={!state || loadingId} />
      </label>
      {searchTerms.length > 0 && state && <div aria-live="polite">
        <p className="mb-3 text-sm text-neutral-600">{matchingPlayers.length ? `${matchingPlayers.length} ${matchingPlayers.length === 1 ? "jugador encontrado" : "jugadores encontrados"}` : "No se han encontrado jugadores."}</p>
        <ul className="grid max-h-96 gap-2 overflow-y-auto">{matchingPlayers.map((player) => <li key={player.id}>
          <button type="button" disabled={loadingId} onClick={() => void loadPlayerId(player.id)} className="flex w-full items-center justify-between gap-4 rounded-[8px] border border-neutral-200 p-4 text-left hover:border-red-600 disabled:opacity-60">
            <span><strong className="block">{player.first_name} {player.last_name}</strong><small className="text-neutral-500">{player.id}</small></span><span className="text-sm font-bold text-red-700">Abrir ficha →</span>
          </button>
        </li>)}</ul>
      </div>}
      <div className="border-t border-neutral-200 pt-6">
        <button type="button" disabled={!state || loadingId} onClick={() => void startNewPlayer()} className="rounded-[8px] bg-red-700 px-5 py-3 font-black text-white disabled:opacity-60">+ Añadir nuevo jugador{nextPlayerId ? ` · ${nextPlayerId}` : ""}</button>
        <p className="mt-2 text-xs text-neutral-500">El ID se asigna al guardar el nuevo jugador.</p>
      </div>
      {loadingId && <p role="status" className="text-sm font-bold">Cargando ficha...</p>}
      {!state && !notice && <p role="status" className="text-sm text-neutral-500">Cargando jugadores y próximo ID disponible...</p>}
      {notice && <p role="alert" className="text-sm font-bold text-red-800">{notice}</p>}
      <Link className="text-sm font-bold text-red-700" href="/jugadores">Volver al directorio</Link>
    </section>
  </main>;

  return <main className="player-edit-page min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950">{clientHeader}
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[8px] bg-white shadow-sm">
      <header className="grid gap-5 border-b border-neutral-200 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-700">Gestión de jugadores</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-normal">{existingPlayer ? name : "Editar jugador"}</h1>
          <p className="mt-2 text-sm font-semibold text-neutral-600">Completa los mismos datos que en la hoja de revisión. Se creará una ficha oculta y se enviarán los datos completos e imágenes al circuito de revisión de Rugby.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid gap-2 text-center">
            <span className="group relative flex h-36 w-24 items-center justify-center overflow-visible rounded-[8px] bg-neutral-200 text-sm font-black text-neutral-400">
              {photoPreviewUrl || state?.cover_photo_url ? <>
                <img src={photoPreviewUrl ?? state?.cover_photo_url ?? ""} alt={`Foto de cabecera de ${name}`} className="h-full w-full rounded-[8px] object-contain transition-transform duration-200 group-hover:scale-105" />
                <span className="pointer-events-none absolute right-full top-1/2 z-50 mr-4 hidden w-48 -translate-y-1/2 rounded-[8px] border border-neutral-200 bg-white p-2 shadow-xl group-hover:block"><img src={photoPreviewUrl ?? state?.cover_photo_url ?? ""} alt="" className="max-h-72 w-full rounded-[6px] object-contain" /></span>
              </> : <PersonStanding size={70} strokeWidth={1.5} aria-hidden="true" />}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[.08em] text-neutral-500">Fotografía para la cabecera (opcional)</span>
          </div>
          <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-[8px] border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:border-red-600 hover:text-red-700" title="Cambiar foto" aria-label="Cambiar foto">
            <Camera size={19} aria-hidden="true" />
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => choosePlayerPhoto(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </header>
      {sent ? <div className="p-8">
        <h2 className="text-2xl font-black">{existingPlayer ? "Cambios enviados" : "Jugador creado y datos enviados"}</h2>
        <p className="mt-3 text-sm text-neutral-700">Los datos e imágenes se han enviado al circuito de revisión e importación de Rugby.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={loadingId} onClick={() => void startNewPlayer()} className="rounded-[8px] bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{loadingId ? "Preparando formulario..." : "Añadir nuevo jugador"}</button>
          <Link className="rounded-[8px] border border-neutral-300 px-5 py-3 text-sm font-black" href="/jugadores">Salir</Link>
          <Link className="px-2 py-3 text-sm font-bold text-red-700" href={`/jugadores/${playerId}`}>Abrir ficha</Link>
        </div>
        {notice && <p role="alert" className="mt-4 text-sm font-bold text-red-800">{notice}</p>}
      </div> : !state && notice ? <p role="alert" className="p-8 text-red-700">{notice}</p> : !state ? <p className="p-8 text-neutral-500">Cargando hoja...</p> : <div className="grid gap-6 p-6">
        <button type="button" disabled={saving} onClick={() => { setFormOpen(false); setNotice(""); }} className="justify-self-start text-sm font-bold text-red-700">← Buscar o añadir otro jugador</button>
        <label className={labelClass}>ID jugador<input className={fieldClass} value={playerId} readOnly /></label>
        {loadingId && <p role="status" className="text-sm font-bold text-neutral-600">Cargando ficha...</p>}
        {notice && <p role="status" className="text-sm font-bold text-red-800">{notice}</p>}
        {resumePlayerId && <button type="button" onClick={() => { createdPlayer.current = resumePlayerId; reviewToken.current = null; setPlayerId(resumePlayerId); setCheckedId(resumePlayerId); setExistingPlayer(true); setResumePlayerId(null); setNotice("Ficha existente seleccionada. Los datos del formulario se conservan; pulsa Guardar cambios para completar el envío."); }} className="text-left text-sm font-bold text-red-700 underline">Continuar con la ficha {resumePlayerId} y conservar estos datos</button>}
        <Link className="text-sm font-bold text-red-700" href="/jugadores">Volver al directorio</Link>
        {state?.saved_submission && <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-600">Se han recuperado los datos guardados en Drive de esta revision.</p>}
        <PlayerEditBlock title="Datos jugador" editing={editingBlock==="block-0"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-0"} onEdit={()=>beginBlockEdit("block-0")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <h2 className={sectionTitleClass}>Datos jugador</h2>
            <p className={helpClass}>Revisa los datos personales. Completa solo lo que falte o corrige lo que no sea correcto.</p>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>Nombre<input className={fieldClass} value={draft.first_name} onChange={(event) => setValue("first_name", event.target.value)} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Apellidos<input className={fieldClass} value={draft.last_name} onChange={(event) => setValue("last_name", event.target.value)} /></label>
          <label className={labelClass}>Apodo<input maxLength={80} className={fieldClass} value={draft.nickname} onChange={event => setValue("nickname", event.target.value)} /></label>
          <SearchablePicker label="Club actual" options={state?.clubs ?? []} value={draft.club_id} onChange={value => setValue("club_id", value)} inputClass={fieldClass} placeholder="Buscar club por nombre o ID…" emptyLabel="Sin indicar" />
          <label className={labelClass}>Situación<select className={fieldClass} value={career.retired ? "retired" : "active"} onChange={event => setCareer(current => ({...current, retired: event.target.value === "retired"}))}><option value="active">En activo</option><option value="retired">Retirado/a</option></select></label>
          <label className={labelClass}>Ficha de staff<select className={fieldClass} value={career.staff_id ?? ""} onChange={event => setCareer(current => ({...current, staff_id: event.target.value || null}))}><option value="">Sin ficha vinculada</option>{state?.staff_options?.map(person => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}</select></label>
          <label className={labelClass}>Genero<select className={fieldClass} value={draft.category} onChange={(event) => setValue("category", event.target.value)}><option value="">Sin indicar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>
          <label className={labelClass}>Fecha o año de nacimiento<input type="text" inputMode="numeric" placeholder="AAAA o DD/MM/AAAA" maxLength={10} className={fieldClass} value={editingBlock === "block-0" ? draft.birth_year : formatBirthInput(parseBirthInput(draft.birth_year)?.birth_date, parseBirthInput(draft.birth_year)?.birth_year)} onChange={(event) => setValue("birth_year", event.target.value)} /></label>
          <label className={labelClass}>DNI/NIE<input className={`${fieldClass} uppercase`} value={draft.dni} onChange={(event) => setValue("dni", event.target.value.toUpperCase())} /></label>
          <label className={labelClass}>Instagram<input className={fieldClass} value={draft.instagram} onChange={(event) => setValue("instagram", event.target.value)} placeholder="@usuario" /></label>
          <label className={labelClass}>Altura cm<input type="number" min="1" max="250" className={fieldClass} value={draft.height_cm} onChange={(event) => setValue("height_cm", event.target.value)} /></label>
          <label className={labelClass}>Peso kg<input type="number" min="1" max="250" className={fieldClass} value={draft.weight_kg} onChange={(event) => setValue("weight_kg", event.target.value)} /></label>
          <label className={labelClass}>Nº posiciones juego<input className={fieldClass} value={draft.position_text} onChange={(event) => setValue("position_text", event.target.value)} placeholder="Ej. 6, 7, 15" /></label>
          <label className={`${labelClass} sm:col-span-2`}>Necesidades alimenticias: alergias, intolerancias y dieta<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.allergies} onChange={(event) => setValue("allergies", event.target.value)} placeholder="Ej. alergias, intolerancias o dieta especial. Si no hay, indicar No." /></label>
          
          <label className={`${labelClass} sm:col-span-2`}>MEDICINA<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.medications} onChange={(event) => setValue("medications", event.target.value)} placeholder="Ej. medicacion, indicaciones medicas o condicion relevante. Si no hay, indicar No." /></label>
        </PlayerEditBlock>
        <PlayerEditBlock title="Contacto" editing={editingBlock==="block-1"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-1"} onEdit={()=>beginBlockEdit("block-1")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4">
          <div>
            <h2 className={sectionTitleClass}>Contacto</h2>
            <p className={helpClass}>Indica el mejor telefono y mail para comunicaciones. En menores, rellena al menos un tutor.</p>
          </div>
          <div className="grid gap-2">
            <div className={`${labelClass} hidden px-3 sm:grid sm:grid-cols-[120px_1fr_1fr_1fr] sm:gap-3`}><span></span><span>Nombre</span><span>Tel.</span><span>Mail</span></div>
            <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800">Jugador</p>
              <label className={`${labelClass} sm:sr-only`}>Nombre jugador</label><input readOnly aria-label="Nombre jugador" className={`${fieldClass} mt-0 bg-neutral-100`} value={name} />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" onBlur={() => setValue("player_phone_e164", formatSpanishPhone(draft.player_phone_e164))} aria-label="Telefono jugador" className={`${fieldClass} mt-0`} value={draft.player_phone_e164} onChange={(event) => setValue("player_phone_e164", event.target.value)} placeholder="+34 XXX XXX XXX" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail jugador" className={`${fieldClass} mt-0`} value={draft.player_email} onChange={(event) => setValue("player_email", event.target.value)} />
            </div>
            {isAdultByBirthYear && <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, adult_self_declared: !current.adult_self_declared }))} className={`justify-self-start rounded-[8px] border px-3 py-2 text-xs font-black ${authorizations.adult_self_declared ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-800 hover:border-red-600 hover:text-red-700"}`}>{authorizations.adult_self_declared ? "Soy mayor de edad marcado" : "Soy mayor de edad"}</button>}
            <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800">Tutor 1 <span className="block text-[10px] font-bold normal-case tracking-normal text-neutral-500">si es menor</span></p>
              <label className={`${labelClass} sm:sr-only`}>Nombre tutor 1</label><input aria-label="Nombre tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_name} onChange={(event) => setValue("tutor1_name", event.target.value)} placeholder="Nombre tutor 1" />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" onBlur={() => setValue("tutor1_phone_e164", formatSpanishPhone(draft.tutor1_phone_e164))} aria-label="Telefono tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_phone_e164} onChange={(event) => setValue("tutor1_phone_e164", event.target.value)} placeholder="Tel. tutor 1" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_email} onChange={(event) => setValue("tutor1_email", event.target.value)} placeholder="Mail tutor 1" />
            </div>
            {showSecondTutor ? <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800">Tutor 2</p>
              <label className={`${labelClass} sm:sr-only`}>Nombre tutor 2</label><input aria-label="Nombre tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_name} onChange={(event) => setValue("tutor2_name", event.target.value)} placeholder="Nombre tutor 2" />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" onBlur={() => setValue("tutor2_phone_e164", formatSpanishPhone(draft.tutor2_phone_e164))} aria-label="Telefono tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_phone_e164} onChange={(event) => setValue("tutor2_phone_e164", event.target.value)} placeholder="Tel. tutor 2" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_email} onChange={(event) => setValue("tutor2_email", event.target.value)} placeholder="Mail tutor 2" />
            </div> : <button type="button" onClick={() => setShowSecondTutor(true)} className="justify-self-start rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir tutor</button>}
          </div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Datos privados jugador" editing={editingBlock==="block-2"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-2"} onEdit={()=>beginBlockEdit("block-2")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4">
          <div><h2 className={sectionTitleClass}>Datos privados jugador</h2><p className={helpClass}>Estos datos solo se comparten con el club cuando se autoriza expresamente.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>DNI/NIE jugador<input className={`${fieldClass} uppercase`} value={draft.dni} onChange={(event) => setValue("dni", event.target.value.toUpperCase())} /></label>
            <label className={labelClass}>Instagram<input className={fieldClass} value={draft.instagram} onChange={(event) => setValue("instagram", event.target.value)} placeholder="@usuario" /></label>
            <label className={labelClass}>Necesidades alimenticias (alergias)<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.allergies} onChange={(event) => setValue("allergies", event.target.value)} /></label>
            <label className={labelClass}>Necesidades médicas (medicamentos)<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.medications} onChange={(event) => setValue("medications", event.target.value)} /></label>
          </div>
          <div className="flex flex-wrap gap-2"><span className={labelClass}>Autorizar compartir con su club</span>{([['food','Necesidades alimenticias'],['medical','Necesidades médicas'],['technical','Datos técnicos']] as const).map(([kind,label]) => <button key={kind} type="button" onClick={() => setPrivateConsents((current) => ({ ...current, [kind]: !current[kind] }))} className={`inline-flex items-center gap-1 rounded-[8px] border px-3 py-2 text-xs font-black ${privateConsents[kind] ? "border-green-600 bg-green-50 text-green-700" : "border-red-300 bg-red-50 text-red-700"}`}>{privateConsents[kind] ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}{label}</button>)}</div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Datos de facturación" editing={editingBlock==="block-3"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-3"} onEdit={()=>beginBlockEdit("block-3")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4">
          <div><h2 className={sectionTitleClass}>Datos de facturación</h2><p className={helpClass}>Titular, DNI y dirección de facturación. El nombre, mail y teléfono corresponden al Tutor/a 1.</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Nombre y apellidos (Tutor/a 1)<input className={fieldClass} value={billing.full_name} onChange={(event) => setBillingValue("full_name", event.target.value)} /></label><label className={labelClass}>DNI titular<input className={`${fieldClass} uppercase`} value={billing.dni} onChange={(event) => setBillingValue("dni", event.target.value.toUpperCase())} /></label><label className={labelClass}>Mail Tutor/a 1<input type="email" className={fieldClass} value={draft.tutor1_email} onChange={(event) => setValue("tutor1_email", event.target.value)} /></label><label className={labelClass}>Teléfono Tutor/a 1<input type="tel" onBlur={() => setValue("tutor1_phone_e164", formatSpanishPhone(draft.tutor1_phone_e164))} className={fieldClass} value={draft.tutor1_phone_e164} onChange={(event) => setValue("tutor1_phone_e164", event.target.value)} /></label><label className={`${labelClass} sm:col-span-2`}>Dirección<input className={fieldClass} value={billing.address} onChange={(event) => setBillingValue("address", event.target.value)} /></label><label className={labelClass}>Código postal<input className={fieldClass} value={billing.postal_code} onChange={(event) => setBillingValue("postal_code", event.target.value)} /></label><label className={labelClass}>Población<input className={fieldClass} value={billing.city} onChange={(event) => setBillingValue("city", event.target.value)} /></label><label className={labelClass}>Provincia<input className={fieldClass} value={billing.province} onChange={(event) => setBillingValue("province", event.target.value)} /></label></div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Temporadas" editing={editingBlock==="block-4"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-4"} onEdit={()=>beginBlockEdit("block-4")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div>
              <h2 className={sectionTitleClass}>Temporadas</h2>
              <p className={helpClass}>Las fotos son opcionales para administración. Si añades fotos, puedes marcar con la estrella la que se mostrará en la ficha.</p>
            </div>
            <button type="button" onClick={addTrajectory} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir trayectoria</button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <datalist id="trajectory-professional-categories">{state?.professional_categories.map(category => <option key={category.id} value={category.label} />)}</datalist>{seasonDrafts.length ? <>
              {seasonDrafts.map((season, index) => {
                const seasonPhoto = seasonPhotoPreviewUrls[String(season.season_year)] ?? season.photo_url;
                return <ConfirmableRow key={season._rowKey ?? `season-${index}`} editing={Boolean(season._pending)} columns="sm:grid-cols-[90px_100px_160px_1fr_132px]" summary={[`${String(season.season_year - 1).slice(-2)}/${String(season.season_year).slice(-2)}`, season.playing_category, season.competition_category, season.club_name, seasonPhoto ? "Con foto" : "Sin foto"]} onEdit={() => editRow(setSeasonDrafts, index)} onConfirm={() => confirmTrajectory(index)} onRemove={() => removeRow(setSeasonDrafts, index)}>
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input placeholder="25/26 o 23-27" aria-label="Temporada" className={`${fieldClass} mt-0`} value={season.season_input ?? (season.season_year ? `${String(season.season_year - 1).slice(-2)}/${String(season.season_year).slice(-2)}` : "")} onChange={(event) => { const value = event.target.value; setSeasonDrafts((rows) => rows.map((row, i) => i === index ? { ...row, season_input: value, season_year: seasonYearFromInput(value) } : row)); }} />
                <label className={`${labelClass} sm:sr-only`}>Categoria</label><select aria-label="Categoria" className={`${fieldClass} mt-0 ${season.playing_category ? "" : "text-neutral-400"}`} value={season.playing_category} onChange={(event) => setSeasonValue(index, "playing_category", event.target.value)}><option value="">Sin indicar</option>{!seasonCategoryOptions.includes(season.playing_category) && season.playing_category && <option value={season.playing_category}>{season.playing_category}</option>}{seasonCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Categoría profesional</label><input aria-label="Categoría profesional" list="trajectory-professional-categories" maxLength={240} className={`${fieldClass} mt-0`} value={season.competition_category} onChange={(event) => setSeasonValue(index, "competition_category", event.target.value)} placeholder="Categoría profesional" />
                <SearchablePicker label="Club" options={[...(state?.clubs ?? []), ...(season.club_name && !season.club_id ? [{id: `legacy:${season.club_name}`, name: season.club_name}] : [])]} value={season.club_id || (season.club_name ? `legacy:${season.club_name}` : "")} onChange={value => setSeasonClub(index,value)} inputClass={`${fieldClass} mt-0`} placeholder="Buscar club por nombre o ID…" emptyLabel="Sin indicar" />
                <div className="grid grid-cols-[40px_40px_40px] gap-2">
                  <span className="group relative flex h-10 w-10 items-center justify-center overflow-visible rounded-full border border-neutral-200 bg-white text-neutral-300">{seasonPhoto ? <>
                    <img src={seasonPhoto} alt={`Foto temporada ${season.season_year}`} className="h-full w-full rounded-full object-cover transition-transform duration-200 group-hover:scale-110" />
                    <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-3 hidden h-36 w-36 rounded-full border border-neutral-200 bg-white p-1 shadow-xl group-hover:block"><img src={seasonPhoto} alt="" className="h-full w-full rounded-full object-cover" /></span>
                  </> : <UserRound size={24} strokeWidth={1.6} aria-hidden="true" />}</span>
                  <button type="button" disabled={!season.season_year} onClick={() => togglePreferredSeasonPhoto(season.season_year)} className={`grid h-10 place-items-center rounded-[8px] border ${preferredSeasonPhotoYear === String(season.season_year) ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-500"} hover:border-red-600 hover:text-red-700`} title="Usar esta foto en la ficha" aria-label={`Usar foto de ${season.season_year} en la ficha`}>
                    <Star size={18} fill={preferredSeasonPhotoYear === String(season.season_year) ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                  <label className={`grid h-10 cursor-pointer place-items-center rounded-[8px] border ${files[`season_photo_${season.season_year}`] ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-700"} hover:border-red-600 hover:text-red-700`} title="Subir foto de temporada" aria-label={`Subir foto de temporada ${season.season_year}`}>
                    <Camera size={18} aria-hidden="true" />
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={!season.season_year} onChange={(event) => chooseSeasonPhoto(season.season_year, event.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </ConfirmableRow>;
              })}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin temporadas registradas con datos.</p>}
          </div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Participaciones" editing={editingBlock==="block-5"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-5"} onEdit={()=>beginBlockEdit("block-5")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div>
              <h2 className={sectionTitleClass}>Participaciones</h2>
              <p className={helpClass}>Indica los campus realizados. Si falta alguno, añádelo con el año y el tipo de campus.</p>
            </div>
            <button type="button" onClick={addParticipation} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir participación</button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            {participationDrafts.length ? <>
              <div className={`${labelClass} hidden px-3 sm:grid sm:grid-cols-[120px_1fr] sm:gap-3`}><span>Año</span><span>Tipo campus</span></div>
              {participationDrafts.map((entry, index) => <ConfirmableRow key={entry._rowKey ?? `participationDrafts-${index}`} editing={Boolean(entry._pending)} columns="grid-cols-[minmax(55px,120px)_minmax(0,1fr)]" summary={[entry.year, state?.campus_types.find((campus) => campus.id === entry.campus)?.label ?? entry.campus]} onEdit={() => editRow(setParticipationDrafts, index)} onConfirm={() => confirmRow(setParticipationDrafts, index, /^20\d{2}$/.test(entry.year) && Boolean(entry.campus))} onRemove={() => removeRow(setParticipationDrafts, index)}>
                <label className={`${labelClass} sm:sr-only`}>Año</label><input aria-label="Año" inputMode="numeric" className={`${fieldClass} mt-0`} value={entry.year} onChange={(event) => setParticipationValue(index, "year", event.target.value.replace(/\D/g, "").slice(0, 4))} />
                <label className={`${labelClass} sm:sr-only`}>Tipo campus</label><select aria-label="Tipo campus" className={`${fieldClass} mt-0`} value={entry.campus} onChange={(event) => setParticipationValue(index, "campus", event.target.value)}><option value="">Sin indicar</option>{state?.campus_types.map((campus) => <option key={campus.id} value={campus.id}>{campus.siglas ? `${campus.siglas} · ${campus.label}` : campus.label}</option>)}</select>
              </ConfirmableRow>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin participaciones registradas.</p>}
          </div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Convocatorias selecciones" editing={editingBlock==="block-6"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-6"} onEdit={()=>beginBlockEdit("block-6")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div>
              <h2 className={sectionTitleClass}>Convocatorias selecciones</h2>
              <p className={helpClass}>Anota convocatorias territoriales o nacionales. El detalle puede usarse para torneo, lugar o comentario breve.</p>
            </div>
            <button type="button" onClick={addSelection} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir convocatoria</button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            {selectionDrafts.length ? <>
              <div className={`${labelClass} hidden px-3 sm:grid sm:grid-cols-[110px_1fr_120px_100px_1fr] sm:gap-3`}><span>Temporada</span><span>Selección</span><span>Categoría</span><span>Formato</span><span>Detalle</span></div>
              {selectionDrafts.map((entry, index) => <ConfirmableRow key={entry._rowKey ?? `selectionDrafts-${index}`} editing={Boolean(entry._pending)} columns="sm:grid-cols-[110px_1fr_120px_100px_1fr]" summary={[entry.season_label, entry.scope, entry.category, entry.format, entry.club_text]} onEdit={() => editRow(setSelectionDrafts, index)} onConfirm={() => confirmRow(setSelectionDrafts, index, Boolean(entry.season_label.trim() && (entry.scope.trim() || entry.federation_id)))} onRemove={() => removeRow(setSelectionDrafts, index)}>
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input aria-label="Temporada convocatoria" className={`${fieldClass} mt-0`} value={entry.season_label} onChange={(event) => setSelectionValue(index, "season_label", event.target.value)} placeholder="25/26" />
                <label className={`${labelClass} sm:sr-only`}>Selección</label><input aria-label="Selección" className={`${fieldClass} mt-0`} value={entry.scope} onChange={(event) => setSelectionValue(index, "scope", event.target.value)} placeholder="Catalunya / España" />
                <label className={`${labelClass} sm:sr-only`}>Categoría</label><select aria-label="Categoría selección" className={`${fieldClass} mt-0 ${entry.category ? "" : "text-neutral-400"}`} value={entry.category} onChange={(event) => setSelectionValue(index, "category", event.target.value)}><option value="">Sin indicar</option>{!seasonCategoryOptions.includes(entry.category) && entry.category && <option value={entry.category}>{entry.category}</option>}{seasonCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Formato</label><input aria-label="Formato selección" className={`${fieldClass} mt-0`} value={entry.format} onChange={(event) => setSelectionValue(index, "format", event.target.value)} placeholder="XV" />
                <label className={`${labelClass} sm:sr-only`}>Detalle</label><input aria-label="Detalle convocatoria" className={`${fieldClass} mt-0`} value={entry.club_text} onChange={(event) => setSelectionValue(index, "club_text", event.target.value)} />
              </ConfirmableRow>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin convocatorias registradas.</p>}
          </div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Clubs profesionales" editing={editingBlock==="block-7"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-7"} onEdit={()=>beginBlockEdit("block-7")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div>
              <h2 className={sectionTitleClass}>Clubs profesionales</h2>
              <p className={helpClass}>Rellena solo si ha estado en un club profesional o competicion destacada. Categoria puede ser DHA, DHB, Top 14, etc.</p>
            </div>
            <button type="button" onClick={addProfessionalClub} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir club profesional</button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            {professionalClubDrafts.length ? <>
              <div className={`${labelClass} hidden px-3 sm:grid sm:grid-cols-[110px_1fr_160px_1fr] sm:gap-3`}><span>Temporada</span><span>Club</span><span>Categoría</span><span>Notas</span></div>
              {professionalClubDrafts.map((entry, index) => <ConfirmableRow key={entry._rowKey ?? `professionalClubDrafts-${index}`} editing={Boolean(entry._pending)} columns="sm:grid-cols-[110px_1fr_160px_1fr]" summary={[entry.season_label, entry.club_name, entry.category, entry.notes]} onEdit={() => editRow(setProfessionalClubDrafts, index)} onConfirm={() => confirmRow(setProfessionalClubDrafts, index, Boolean(entry.season_label.trim() && (entry.club_id || entry.club_name.trim())))} onRemove={() => removeRow(setProfessionalClubDrafts, index)}>
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input aria-label="Temporada club profesional" className={`${fieldClass} mt-0`} value={entry.season_label} onChange={(event) => setProfessionalClubValue(index, "season_label", event.target.value)} placeholder="25/26" />
                <SearchablePicker label="Club profesional" options={[...(state?.clubs ?? []), ...(entry.club_name && !entry.club_id ? [{id: `legacy:${entry.club_name}`, name: entry.club_name}] : [])]} value={entry.club_id || (entry.club_name ? `legacy:${entry.club_name}` : "")} onChange={value => setProfessionalClub(index,value)} inputClass={`${fieldClass} mt-0`} placeholder="Buscar club por nombre o ID…" emptyLabel="Sin indicar" />
                <label className={`${labelClass} sm:sr-only`}>Categoría</label><select aria-label="Categoría club profesional" className={`${fieldClass} mt-0 ${entry.category ? "" : "text-neutral-400"}`} value={entry.category} onChange={(event) => setProfessionalClubValue(index, "category", event.target.value)}><option value="">Sin indicar</option>{entry.category && !state?.professional_categories.some((category) => category.label === entry.category) && <option value={entry.category}>{entry.category}</option>}{state?.professional_categories.map((category) => <option key={category.id} value={category.label}>{category.siglas ? `${category.siglas} · ${category.label}` : category.label}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Notas</label><input aria-label="Notas club profesional" className={`${fieldClass} mt-0`} value={entry.notes} onChange={(event) => setProfessionalClubValue(index, "notes", event.target.value)} />
              </ConfirmableRow>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin clubs profesionales registrados.</p>}
          </div>
        </PlayerEditBlock>
        <PlayerEditBlock title="Autorización de publicación" editing={editingBlock==="block-8"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-8"} onEdit={()=>beginBlockEdit("block-8")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <h2 className={sectionTitleClass}>Autorización de publicación (opcional para administración)</h2>
            <p className={helpClass}>Esta autorizacion separa lo que puede verse publicamente de la informacion sensible que solo usara CTRugby.</p>
          </div>
          <p className={`${helpClass} rounded-[8px] border border-neutral-200 bg-white px-3 py-2`}>Datos publicables: nombre, año de nacimiento, foto de ficha, fotografía de cabecera, trayectoria deportiva, participaciones, convocatorias y clubs profesionales.</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className={labelClass}>Datos basicos publicables</p>
            <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, basic_publication: "authorized" }))} className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-black ${authorizations.basic_publication === "authorized" ? "border-green-600 bg-green-50 text-green-700" : "border-neutral-300 bg-white text-neutral-700 hover:border-green-600 hover:text-green-700"}`}><Check size={14} aria-hidden="true" />Sí autorizo</button>
            <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, basic_publication: "denied" }))} className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-black ${authorizations.basic_publication === "denied" ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-700 hover:border-red-600 hover:text-red-700"}`}><X size={14} aria-hidden="true" />No autorizo</button>
          </div>
          <p className="flex items-center gap-2 rounded-[8px] border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-neutral-700"><AlertTriangle size={15} className="shrink-0 text-yellow-600" aria-hidden="true" />DNI, contacto, necesidades alimenticias, necesidades medicas, medicamentos, informes tecnicos e imagenes originales no se publicaran. Solo uso interno de CTRugby.</p>
        </PlayerEditBlock>
        <PlayerEditBlock title="Tallas" editing={editingBlock==="block-9"} busy={saving} locked={editingBlock!==null && editingBlock!=="block-9"} onEdit={()=>beginBlockEdit("block-9")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-4"><div className="sm:col-span-4"><h2 className={sectionTitleClass}>Tallas</h2><p className={helpClass}>Actualizar en cada evento.</p></div>{([["technical_shirt", "Camiseta técnica"], ["playing_shirt", "Camiseta de juego"], ["playing_shorts", "Pantalón de juego"], ["bermudas", "Bermudas"]] as const).map(([field, label]) => <label key={field} className={labelClass}>{label}<input maxLength={30} className={fieldClass} value={eventSizes[field]} onChange={event => setEventSizes(current => ({...current, [field]: event.target.value.toUpperCase()}))} /></label>)}</PlayerEditBlock>
        <PlayerEditBlock title="Observaciones" editing={editingBlock==="observations"} busy={saving} locked={editingBlock!==null && editingBlock!=="observations"} onEdit={()=>beginBlockEdit("observations")} onSave={saveEditingBlock} onCancel={cancelEditingBlock} className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4"><label className={labelClass}>Observaciones<textarea className={`${fieldClass} min-h-28 resize-y`} value={draft.observations} onChange={(event) => setValue("observations", event.target.value)} placeholder="Anota aqui cualquier aclaracion que ayude a Rugby a validar los cambios." /></label></PlayerEditBlock>
        {notice && <p className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{notice}</p>}
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button type="button" disabled={saving || loadingId || checkedId !== playerId.trim().toUpperCase()} onClick={() => void submit()} className="rounded-[8px] bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? "Guardando..." : existingPlayer ? "Guardar cambios" : incompleteSave ? "Completar guardado" : "Guardar nuevo jugador"}</button>
        </div>
      </div>}
      {photoEditorFile && <ImageUploadEditor
        file={photoEditorFile}
        title={`Fotografia para la cabecera de ${name}`}
        outputWidth={1200}
        outputHeight={1500}
        initialFit="contain"
        allowRemoveBackground
        onChooseFile={() => document.querySelector<HTMLInputElement>('input[type="file"][accept="image/png,image/jpeg,image/webp"]')?.click()}
        onSave={savePreparedPhoto}
        onClose={() => setPhotoEditorFile(null)}
      />}
      {seasonPhotoEditor && <ImageUploadEditor
        file={seasonPhotoEditor.file}
        title={`Foto redonda temporada ${seasonPhotoEditor.year}`}
        outputWidth={1200}
        outputHeight={1200}
        initialFit="cover"
        allowRemoveBackground
        outputBackground="#e5e7eb"
        circularFrame
        onChooseFile={() => document.querySelector<HTMLInputElement>(`input[aria-label="Subir foto de temporada ${seasonPhotoEditor.year}"]`)?.click()}
        onSave={saveSeasonPreparedPhoto}
        onClose={() => setSeasonPhotoEditor(null)}
      />}
    </section>
  </main>;
}
