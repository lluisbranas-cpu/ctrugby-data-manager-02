"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/sport-navigation";
import { LockKeyhole, AlertTriangle, Camera, Check, PersonStanding, Star, UserRound, X } from "lucide-react";
import { ImageUploadEditor } from "@/app/components/image-upload-editor";
import { playerPdfFilename } from "@/lib/player-pdf-filename";

type ReviewState = {
  expires_at: string;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  primary_photo_season: string | null;
  player: { first_name: string; last_name: string | null; category: string | null; birth_year: number | null; dni: string | null; instagram: string | null; height_cm: number | null; weight_kg: number | null; allergies: string | null; dietary_conditions: string | null; medications: string | null };
  clubs: { id: string; name: string }[];
  campus_types: { id: string; label: string; siglas: string | null }[];
  professional_categories: { id: string; label: string; siglas: string | null }[];
  seasons: SeasonRow[];
  participations: ParticipationDraft[];
  selections: SelectionDraft[];
  professional_club_records: ProfessionalClubDraft[];
  contacts: { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null } | null;
  saved_submission: { submitted_at: string; payload: SavedPayload } | null;
};
type SeasonRow = { season_year: number; playing_category?: string | null; competition_category?: string | null; club_id: string | null; club_name: string | null; legacy_club_name: string | null; position_text: string | null; photo_url: string | null };
type SeasonDraft = { season_year: number; competition_category: string; playing_category: string; club_id: string; club_name: string; position_text?: string | null; photo_url?: string | null };
type ParticipationDraft = { year: string; campus: string };
type SelectionDraft = { federation_id: string; scope: string; category: string; format: string; season_label: string; club_text: string };
type ProfessionalClubDraft = { id?: string; club_id: string; club_name: string; category: string; season_label: string; notes: string };
type AuthorizationDraft = { basic_publication: string; sensitive_internal_use: boolean; adult_self_declared: boolean };
type SavedPayload = {
  player?: Partial<Record<"first_name" | "last_name" | "category" | "dni" | "instagram" | "position_text" | "allergies" | "dietary_conditions" | "medications", string | null>> & { birth_year?: number | null; height_cm?: number | null; weight_kg?: number | null };
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

export default function PlayerReviewPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const [state, setState] = useState<ReviewState | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);
  const [reviewedPdf, setReviewedPdf] = useState<{ file: Blob; filename: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [publicPreview, setPublicPreview] = useState(false);
  const [draft, setDraft] = useState({
    first_name: "",
    last_name: "",
    category: "",
    birth_year: "",
    dni: "",
    instagram: "",
    position_text: "",
    height_cm: "",
    weight_kg: "",
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
  const [showSecondTutor, setShowSecondTutor] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({ player_photo_original: null, player_photo_prepared: null, dni_front: null, dni_back: null, extra_image: null });
  const [photoEditorFile, setPhotoEditorFile] = useState<File | null>(null);
  const [seasonPhotoEditor, setSeasonPhotoEditor] = useState<{ year: number; file: File } | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [seasonPhotoPreviewUrls, setSeasonPhotoPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetch(`/api/revision-jugador/${token}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Enlace no valido.");
        return data as ReviewState;
      })
      .then((data) => {
        setState(data);
        const saved = data.saved_submission?.payload;
        const savedPlayer = saved?.player ?? {};
        const savedContacts = saved?.contacts ?? {};
        setDraft({
          first_name: String(savedPlayer.first_name ?? data.player.first_name ?? ""),
          last_name: String(savedPlayer.last_name ?? data.player.last_name ?? ""),
          category: String(savedPlayer.category ?? data.player.category ?? ""),
          birth_year: savedPlayer.birth_year ? String(savedPlayer.birth_year) : data.player.birth_year ? String(data.player.birth_year) : "",
          dni: String(savedPlayer.dni ?? data.player.dni ?? ""),
          instagram: String(savedPlayer.instagram ?? data.player.instagram ?? ""),
          position_text: String(savedPlayer.position_text ?? saved?.seasons?.find((season) => season.position_text)?.position_text ?? data.seasons.find((season) => season.position_text)?.position_text ?? ""),
          height_cm: savedPlayer.height_cm ? String(savedPlayer.height_cm) : data.player.height_cm ? String(data.player.height_cm) : "",
          weight_kg: savedPlayer.weight_kg ? String(savedPlayer.weight_kg) : data.player.weight_kg ? String(data.player.weight_kg) : "",
          allergies: String(savedPlayer.allergies ?? savedPlayer.dietary_conditions ?? data.player.allergies ?? data.player.dietary_conditions ?? ""),
          medications: String(savedPlayer.medications ?? data.player.medications ?? ""),
          observations: saved?.observations ?? "",
          player_email: String(savedContacts.player_email ?? data.contacts?.player_email ?? ""),
          player_phone_e164: String(savedContacts.player_phone_e164 ?? data.contacts?.player_phone_e164 ?? ""),
          tutor1_name: String(savedContacts.tutor1_name ?? data.contacts?.tutor1_name ?? ""),
          tutor1_email: String(savedContacts.tutor1_email ?? data.contacts?.tutor1_email ?? ""),
          tutor1_phone_e164: String(savedContacts.tutor1_phone_e164 ?? data.contacts?.tutor1_phone_e164 ?? ""),
          tutor2_name: String(savedContacts.tutor2_name ?? data.contacts?.tutor2_name ?? ""),
          tutor2_email: String(savedContacts.tutor2_email ?? data.contacts?.tutor2_email ?? ""),
          tutor2_phone_e164: String(savedContacts.tutor2_phone_e164 ?? data.contacts?.tutor2_phone_e164 ?? ""),
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
        setShowSecondTutor(Boolean(savedContacts.tutor2_name ?? savedContacts.tutor2_email ?? savedContacts.tutor2_phone_e164 ?? data.contacts?.tutor2_name ?? data.contacts?.tutor2_email ?? data.contacts?.tutor2_phone_e164));
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : "No se ha podido cargar la hoja."));
  }, [token]);

  useEffect(() => {
    const showPublicPreview = () => setPublicPreview(true);
    window.addEventListener("ctrugby:show-public-preview", showPublicPreview);
    return () => window.removeEventListener("ctrugby:show-public-preview", showPublicPreview);
  }, []);

  const name = useMemo(() => [draft.first_name, draft.last_name].filter(Boolean).join(" ") || "Jugador", [draft.first_name, draft.last_name]);
  const isAdultByBirthYear = Number(draft.birth_year) > 0 && new Date().getFullYear() - Number(draft.birth_year) >= 18;
  const setValue = (field: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [field]: value }));
  const setSeasonValue = (year: number, field: keyof Omit<SeasonDraft, "season_year">, value: string) => setSeasonDrafts((current) => current.map((season) => season.season_year === year ? { ...season, [field]: value } : season));
  const setSeasonClub = (year: number, value: string) => {
    const club = state?.clubs.find((item) => item.id === value);
    setSeasonDrafts((current) => current.map((season) => season.season_year === year ? { ...season, club_id: club?.id ?? "", club_name: club?.name ?? "" } : season));
  };
  const addTrajectory = () => {
    const nextYear = Math.max(new Date().getFullYear() + 1, ...seasonDrafts.map((season) => season.season_year)) + 1;
    setSeasonDrafts((current) => [{ season_year: nextYear, competition_category: "", playing_category: "", club_id: "", club_name: "", photo_url: null }, ...current]);
  };
  const setParticipationValue = (index: number, field: keyof ParticipationDraft, value: string) => setParticipationDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const addParticipation = () => {
    const currentYear = String(new Date().getFullYear());
    setParticipationDrafts((current) => [{ year: currentYear, campus: state?.campus_types[0]?.id ?? "" }, ...current]);
  };
  const setSelectionValue = (index: number, field: keyof SelectionDraft, value: string) => setSelectionDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const addSelection = () => setSelectionDrafts((current) => [{ federation_id: "", scope: "", category: "", format: "", season_label: "", club_text: "" }, ...current]);
  const setProfessionalClubValue = (index: number, field: keyof ProfessionalClubDraft, value: string) => setProfessionalClubDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, [field]: value } : entry));
  const setProfessionalClub = (index: number, value: string) => {
    const club = state?.clubs.find((item) => item.id === value);
    setProfessionalClubDrafts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, club_id: club?.id ?? "", club_name: club?.name ?? "" } : entry));
  };
  const addProfessionalClub = () => setProfessionalClubDrafts((current) => [{ club_id: "", club_name: "", category: "", season_label: "", notes: "" }, ...current]);
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

  const submit = async () => {
    setNotice("");
    if (!reviewedPdf) {
      setNotice("Primero abre la vista previa del PDF para confirmar la ficha.");
      return;
    }
    if (!draft.first_name.trim()) {
      setNotice("Indica el nombre del jugador.");
      return;
    }
    if (!authorizations.basic_publication) {
      setNotice("Marca si autorizas o no autorizas la publicacion de datos basicos.");
      return;
    }
    const preferredSeason = seasonDrafts.find((season) => String(season.season_year) === preferredSeasonPhotoYear);
    if (!preferredSeasonPhotoYear || (!files[`season_photo_${preferredSeasonPhotoYear}`] && !preferredSeason?.photo_url)) {
      setNotice("Sube al menos una foto de temporada y marcala con la estrella para usarla en la ficha.");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("data", JSON.stringify({
        submitted_name: name,
        player: {
          first_name: draft.first_name.trim(),
          last_name: draft.last_name.trim() || null,
          category: draft.category || null,
          birth_year: draft.birth_year ? Number(draft.birth_year) : null,
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
        contacts: {
          player_email: draft.player_email.trim().toLowerCase() || null,
          player_phone_e164: draft.player_phone_e164.trim() || null,
          tutor1_name: draft.tutor1_name.trim() || null,
          tutor1_email: draft.tutor1_email.trim().toLowerCase() || null,
          tutor1_phone_e164: draft.tutor1_phone_e164.trim() || null,
          tutor2_name: draft.tutor2_name.trim() || null,
          tutor2_email: draft.tutor2_email.trim().toLowerCase() || null,
          tutor2_phone_e164: draft.tutor2_phone_e164.trim() || null,
        },
        observations: draft.observations.trim() || null,
      }));
      const attachedFiles = Object.entries(files).filter((entry): entry is [string, File] => Boolean(entry[1]));
      // Leave room for the multipart envelope below Vercel's request limit.
      const uploadBytes = attachedFiles.reduce((total, [, file]) => total + file.size, new Blob([String(form.get("data"))]).size);
      if (uploadBytes > 4_000_000) throw new Error("Las fotos del envio ocupan demasiado. Reduce su tamaño para que el total sea inferior a 4 MB.");
      for (const [field, file] of attachedFiles) form.set(field, file);
      const response = await fetch(`/api/revision-jugador/${token}`, { method: "POST", body: form });
      const text = await response.text();
      let result: { ok?: boolean; error?: string } | null = null;
      try { result = JSON.parse(text) as { ok?: boolean; error?: string }; } catch { /* Handle empty and non-JSON server responses. */ }
      if (!response.ok || result?.ok !== true) {
        const fallback = response.status === 413
          ? "Las fotos superan el limite del envio. Reduce su tamaño y vuelve a intentarlo."
          : "No se ha confirmado el guardado de la revision. Contacta con CTRugby antes de repetir el envio.";
        throw new Error(result?.error || fallback);
      }
      setSent(true);
      const url = URL.createObjectURL(reviewedPdf.file);
      const link = document.createElement("a");
      link.href = url;
      link.download = reviewedPdf.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setNotice("Cambios guardados. La copia PDF se ha archivado en Drive y se ha descargado en este dispositivo.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la revision.");
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = async () => {
    setNotice("");
    const viewer = window.open("about:blank", "_blank");
    setPreviewingPdf(true);
    try {
      const payload = {
        submitted_name: name,
        player: {
          first_name: draft.first_name.trim(), last_name: draft.last_name.trim() || null,
          category: draft.category || null, birth_year: draft.birth_year ? Number(draft.birth_year) : null,
          dni: draft.dni.trim().toUpperCase() || null, instagram: draft.instagram.trim() || null,
          position_text: draft.position_text.trim() || null, height_cm: draft.height_cm ? Number(draft.height_cm) : null,
          weight_kg: draft.weight_kg ? Number(draft.weight_kg) : null, allergies: draft.allergies.trim() || null,
          medications: draft.medications.trim() || null,
        },
        seasons: seasonDrafts.map((season) => ({ season_year: season.season_year, competition_category: season.competition_category.trim() || null, playing_category: season.playing_category.trim() || null, club_id: season.club_id || null, club_name: season.club_name.trim() || null })),
        participations: participationDrafts.map((entry) => ({ year: entry.year.trim(), campus: entry.campus })).filter((entry) => entry.year || entry.campus),
        selections: selectionDrafts.map((entry) => ({ federation_id: entry.federation_id.trim() || null, scope: entry.scope.trim() || null, category: entry.category.trim() || null, format: entry.format.trim() || null, season_label: entry.season_label.trim() || null, club_text: entry.club_text.trim() || null })).filter((entry) => entry.federation_id || entry.scope || entry.category || entry.format || entry.season_label || entry.club_text),
        professional_club_records: professionalClubDrafts.map((entry) => ({ club_id: entry.club_id || null, club_name: entry.club_name.trim() || null, category: entry.category.trim() || null, season_label: entry.season_label.trim() || null, notes: entry.notes.trim() || null })).filter((entry) => entry.club_id || entry.club_name || entry.category || entry.season_label || entry.notes),
        authorizations: { basic_publication: authorizations.basic_publication || null, sensitive_internal_use: true, adult_self_declared: authorizations.adult_self_declared },
        contacts: {
          player_email: draft.player_email.trim().toLowerCase() || null, player_phone_e164: draft.player_phone_e164.trim() || null,
          tutor1_name: draft.tutor1_name.trim() || null, tutor1_email: draft.tutor1_email.trim().toLowerCase() || null, tutor1_phone_e164: draft.tutor1_phone_e164.trim() || null,
          tutor2_name: draft.tutor2_name.trim() || null, tutor2_email: draft.tutor2_email.trim().toLowerCase() || null, tutor2_phone_e164: draft.tutor2_phone_e164.trim() || null,
        },
        observations: draft.observations.trim() || null,
      };
      const response = await fetch(`/api/revision-jugador/${token}/pdf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("No se ha podido preparar la vista previa en PDF.");
      const file = await response.blob();
      setReviewedPdf({ file, filename: playerPdfFilename(response.headers.get("X-CTRugby-Player-Id") ?? "RUGBY") });
      setPublicPreview(true);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = playerPdfFilename(response.headers.get("X-CTRugby-Player-Id") ?? "RUGBY");
      link.click();
      if (viewer) viewer.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      viewer?.close();
      setNotice(error instanceof Error ? error.message : "No se ha podido preparar la vista previa en PDF.");
    } finally {
      setPreviewingPdf(false);
    }
  };

  return <main className="min-h-screen bg-neutral-100 px-4 py-6 text-neutral-950">
    <section className="mx-auto max-w-4xl overflow-hidden rounded-[8px] bg-white shadow-sm">
      <header className="grid gap-5 border-b border-neutral-200 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-red-700">Rugby · Revision de ficha</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-normal">{name}</h1>
          <p className="mt-2 text-sm font-semibold text-neutral-600">Descarga una copia PDF antes de modificar la ficha. Al enviar, los datos se actualizarán directamente.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid gap-2 text-center">
            <span className="group relative flex h-36 w-24 items-center justify-center overflow-visible rounded-[8px] bg-neutral-200 text-sm font-black text-neutral-400">
              {photoPreviewUrl || state?.cover_photo_url ? <>
                <img src={photoPreviewUrl ?? state?.cover_photo_url ?? ""} alt={`Foto de cabecera de ${name}`} className="h-full w-full rounded-[8px] object-contain transition-transform duration-200 group-hover:scale-105" />
                <span className="pointer-events-none absolute right-full top-1/2 z-50 mr-4 hidden w-48 -translate-y-1/2 rounded-[8px] border border-neutral-200 bg-white p-2 shadow-xl group-hover:block"><img src={photoPreviewUrl ?? state?.cover_photo_url ?? ""} alt="" className="max-h-72 w-full rounded-[6px] object-contain" /></span>
              </> : <PersonStanding size={70} strokeWidth={1.5} aria-hidden="true" />}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[.08em] text-neutral-500">Fotografia para la cabecera</span>
          </div>
          <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-[8px] border border-neutral-300 bg-white text-neutral-900 shadow-sm hover:border-red-600 hover:text-red-700" title="Cambiar foto" aria-label="Cambiar foto">
            <Camera size={19} aria-hidden="true" />
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => choosePlayerPhoto(event.target.files?.[0] ?? null)} />
          </label>
        </div>
      </header>
      {sent ? <div className="p-8">
        <h2 className="text-2xl font-black">Revision enviada</h2>
        <p className="mt-3 text-sm text-neutral-700">Gracias. Hemos guardado tus cambios e imagenes para que Rugby los revise e importe.</p>
      </div> : !state && !notice ? <p className="p-8 text-neutral-500">Cargando hoja...</p> : <div className="grid gap-6 p-6">
        {state?.saved_submission && <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-bold text-neutral-600">Se han recuperado los datos guardados en Drive de esta revision.</p>}
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-4">
          <div className="sm:col-span-4">
            <h2 className={sectionTitleClass}>Datos jugador</h2>
            <p className={helpClass}>Revisa los datos personales. Completa solo lo que falte o corrige lo que no sea correcto.</p>
          </div>
          <label className={`${labelClass} sm:col-span-2`}>Nombre<input className={fieldClass} value={draft.first_name} onChange={(event) => setValue("first_name", event.target.value)} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Apellidos<input className={fieldClass} value={draft.last_name} onChange={(event) => setValue("last_name", event.target.value)} /></label>
          <label className={labelClass}>Genero<select className={fieldClass} value={draft.category} onChange={(event) => setValue("category", event.target.value)}><option value="">Sin indicar</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>
          <label className={labelClass}>Año nacimiento<input type="number" min="1900" max="2035" className={fieldClass} value={draft.birth_year} onChange={(event) => setValue("birth_year", event.target.value)} /></label>
          <label className={labelClass}><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />DNI/NIE<input className={`${fieldClass} uppercase`} value={draft.dni} onChange={(event) => setValue("dni", event.target.value.toUpperCase())} /></label>
          <label className={labelClass}>Instagram<input className={fieldClass} value={draft.instagram} onChange={(event) => setValue("instagram", event.target.value)} placeholder="@usuario" /></label>
          <label className={labelClass}>Altura cm<input type="number" min="1" max="250" className={fieldClass} value={draft.height_cm} onChange={(event) => setValue("height_cm", event.target.value)} /></label>
          <label className={labelClass}>Peso kg<input type="number" min="1" max="250" className={fieldClass} value={draft.weight_kg} onChange={(event) => setValue("weight_kg", event.target.value)} /></label>
          <label className={labelClass}>Nº posiciones juego<input className={fieldClass} value={draft.position_text} onChange={(event) => setValue("position_text", event.target.value)} placeholder="Ej. 6, 7, 15" /></label>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4">
          <div>
            <h2 className={sectionTitleClass}><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Acceso privado</h2>
            <p className={helpClass}>Los campos marcados con un candado son privados. No se publicarán en la ficha pública.</p>
            <p className={helpClass}>Indica el mejor telefono y mail para comunicaciones. En menores, rellena al menos un tutor.</p>
          </div>
          <div className="grid gap-4">
          <label className={`${labelClass} sm:col-span-2`}><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Necesidades alimenticias (alergias)<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.allergies} onChange={(event) => setValue("allergies", event.target.value)} placeholder="Ej. alergias, intolerancias o dieta especial. Si no hay, indicar No." /></label>
          <label className={`${labelClass} sm:col-span-2`}><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Necesidades médicas (medicamentos)<textarea className={`${fieldClass} min-h-20 resize-y`} value={draft.medications} onChange={(event) => setValue("medications", event.target.value)} placeholder="Ej. medicacion, indicaciones medicas o condicion relevante. Si no hay, indicar No." /></label>
          </div>
          <div className="grid gap-2">
            <div className={`${labelClass} hidden px-3 sm:grid sm:grid-cols-[120px_1fr_1fr_1fr] sm:gap-3`}><span></span><span><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Nombre</span><span><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Tel.</span><span><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Mail</span></div>
            <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800"><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Jugador</p>
              <label className={`${labelClass} sm:sr-only`}>Nombre jugador</label><input readOnly aria-label="Nombre jugador" className={`${fieldClass} mt-0 bg-neutral-100`} value={name} />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" aria-label="Telefono jugador" className={`${fieldClass} mt-0`} value={draft.player_phone_e164} onChange={(event) => setValue("player_phone_e164", event.target.value)} placeholder="+34600111222" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail jugador" className={`${fieldClass} mt-0`} value={draft.player_email} onChange={(event) => setValue("player_email", event.target.value)} />
            </div>
            {isAdultByBirthYear && <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, adult_self_declared: !current.adult_self_declared }))} className={`justify-self-start rounded-[8px] border px-3 py-2 text-xs font-black ${authorizations.adult_self_declared ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-800 hover:border-red-600 hover:text-red-700"}`}>{authorizations.adult_self_declared ? "Soy mayor de edad marcado" : "Soy mayor de edad"}</button>}
            <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800"><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Tutor 1 <span className="block text-[10px] font-bold normal-case tracking-normal text-neutral-500">si es menor</span></p>
              <label className={`${labelClass} sm:sr-only`}>Nombre tutor 1</label><input aria-label="Nombre tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_name} onChange={(event) => setValue("tutor1_name", event.target.value)} placeholder="Nombre tutor 1" />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" aria-label="Telefono tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_phone_e164} onChange={(event) => setValue("tutor1_phone_e164", event.target.value)} placeholder="Tel. tutor 1" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail tutor 1" className={`${fieldClass} mt-0`} value={draft.tutor1_email} onChange={(event) => setValue("tutor1_email", event.target.value)} placeholder="Mail tutor 1" />
            </div>
            {showSecondTutor ? <div className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr_1fr_1fr]">
              <p className="text-xs font-black uppercase tracking-[.08em] text-neutral-800"><LockKeyhole size={12} className="mr-1 inline-block align-middle" aria-hidden="true" />Tutor 2</p>
              <label className={`${labelClass} sm:sr-only`}>Nombre tutor 2</label><input aria-label="Nombre tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_name} onChange={(event) => setValue("tutor2_name", event.target.value)} placeholder="Nombre tutor 2" />
              <label className={`${labelClass} sm:sr-only`}>Tel.</label><input type="tel" aria-label="Telefono tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_phone_e164} onChange={(event) => setValue("tutor2_phone_e164", event.target.value)} placeholder="Tel. tutor 2" />
              <label className={`${labelClass} sm:sr-only`}>Mail</label><input type="email" aria-label="Mail tutor 2" className={`${fieldClass} mt-0`} value={draft.tutor2_email} onChange={(event) => setValue("tutor2_email", event.target.value)} placeholder="Mail tutor 2" />
            </div> : <button type="button" onClick={() => setShowSecondTutor(true)} className="justify-self-start rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir tutor</button>}
          </div>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div>
              <h2 className={sectionTitleClass}>Temporadas</h2>
              <p className={helpClass}>Debe haber al menos una foto subida y marcada con estrella. Esa foto sera la que se mostrara en la ficha.</p>
            </div>
            <button type="button" onClick={addTrajectory} className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-800 hover:border-red-600 hover:text-red-700">+ Añadir trayectoria</button>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <datalist id="trajectory-professional-categories">{state?.professional_categories.map(category => <option key={category.id} value={category.label} />)}</datalist>{seasonDrafts.length ? <>
              {seasonDrafts.map((season) => {
                const seasonPhoto = seasonPhotoPreviewUrls[String(season.season_year)] ?? season.photo_url;
                return <div key={season.season_year} className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[90px_100px_160px_1fr_132px]">
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input readOnly aria-label="Temporada" className={`${fieldClass} mt-0 bg-neutral-100`} value={`${String(season.season_year - 1).slice(-2)}/${String(season.season_year).slice(-2)}`} />
                <label className={`${labelClass} sm:sr-only`}>Categoria</label><select aria-label="Categoria" className={`${fieldClass} mt-0 ${season.playing_category ? "" : "text-neutral-400"}`} value={season.playing_category} onChange={(event) => setSeasonValue(season.season_year, "playing_category", event.target.value)}><option value="">Sin indicar</option>{!seasonCategoryOptions.includes(season.playing_category) && season.playing_category && <option value={season.playing_category}>{season.playing_category}</option>}{seasonCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Categoría profesional</label><input aria-label="Categoría profesional" list="trajectory-professional-categories" maxLength={240} className={`${fieldClass} mt-0`} value={season.competition_category} onChange={(event) => setSeasonValue(season.season_year, "competition_category", event.target.value)} placeholder="Categoría profesional" />
                <label className={`${labelClass} sm:sr-only`}>Club</label><select aria-label="Club" className={`${fieldClass} mt-0`} value={season.club_id || (season.club_name ? `legacy:${season.club_name}` : "")} onChange={(event) => setSeasonClub(season.season_year, event.target.value)}><option value="">Sin indicar</option>{season.club_name && !season.club_id && <option value={`legacy:${season.club_name}`}>{season.club_name}</option>}{state?.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
                <div className="grid grid-cols-[40px_40px_40px] gap-2">
                  <span className="group relative flex h-10 w-10 items-center justify-center overflow-visible rounded-full border border-neutral-200 bg-white text-neutral-300">{seasonPhoto ? <>
                    <img src={seasonPhoto} alt={`Foto temporada ${season.season_year}`} className="h-full w-full rounded-full object-cover transition-transform duration-200 group-hover:scale-110" />
                    <span className="pointer-events-none absolute bottom-full right-0 z-50 mb-3 hidden h-36 w-36 rounded-full border border-neutral-200 bg-white p-1 shadow-xl group-hover:block"><img src={seasonPhoto} alt="" className="h-full w-full rounded-full object-cover" /></span>
                  </> : <UserRound size={24} strokeWidth={1.6} aria-hidden="true" />}</span>
                  <button type="button" onClick={() => togglePreferredSeasonPhoto(season.season_year)} className={`grid h-10 place-items-center rounded-[8px] border ${preferredSeasonPhotoYear === String(season.season_year) ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-500"} hover:border-red-600 hover:text-red-700`} title="Usar esta foto en la ficha" aria-label={`Usar foto de ${season.season_year} en la ficha`}>
                    <Star size={18} fill={preferredSeasonPhotoYear === String(season.season_year) ? "currentColor" : "none"} aria-hidden="true" />
                  </button>
                  <label className={`grid h-10 cursor-pointer place-items-center rounded-[8px] border ${files[`season_photo_${season.season_year}`] ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-700"} hover:border-red-600 hover:text-red-700`} title="Subir foto de temporada" aria-label={`Subir foto de temporada ${season.season_year}`}>
                    <Camera size={18} aria-hidden="true" />
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseSeasonPhoto(season.season_year, event.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>;
              })}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin temporadas registradas con datos.</p>}
          </div>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
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
              {participationDrafts.map((entry, index) => <div key={`${entry.year}-${index}`} className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr]">
                <label className={`${labelClass} sm:sr-only`}>Año</label><input aria-label="Año" inputMode="numeric" className={`${fieldClass} mt-0`} value={entry.year} onChange={(event) => setParticipationValue(index, "year", event.target.value.replace(/\D/g, "").slice(0, 4))} />
                <label className={`${labelClass} sm:sr-only`}>Tipo campus</label><select aria-label="Tipo campus" className={`${fieldClass} mt-0`} value={entry.campus} onChange={(event) => setParticipationValue(index, "campus", event.target.value)}><option value="">Sin indicar</option>{state?.campus_types.map((campus) => <option key={campus.id} value={campus.id}>{campus.siglas ? `${campus.siglas} · ${campus.label}` : campus.label}</option>)}</select>
              </div>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin participaciones registradas.</p>}
          </div>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
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
              {selectionDrafts.map((entry, index) => <div key={`${entry.scope}-${entry.season_label}-${index}`} className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[110px_1fr_120px_100px_1fr]">
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input aria-label="Temporada convocatoria" className={`${fieldClass} mt-0`} value={entry.season_label} onChange={(event) => setSelectionValue(index, "season_label", event.target.value)} placeholder="25/26" />
                <label className={`${labelClass} sm:sr-only`}>Selección</label><input aria-label="Selección" className={`${fieldClass} mt-0`} value={entry.scope} onChange={(event) => setSelectionValue(index, "scope", event.target.value)} placeholder="Catalunya / España" />
                <label className={`${labelClass} sm:sr-only`}>Categoría</label><select aria-label="Categoría selección" className={`${fieldClass} mt-0 ${entry.category ? "" : "text-neutral-400"}`} value={entry.category} onChange={(event) => setSelectionValue(index, "category", event.target.value)}><option value="">Sin indicar</option>{!seasonCategoryOptions.includes(entry.category) && entry.category && <option value={entry.category}>{entry.category}</option>}{seasonCategoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Formato</label><input aria-label="Formato selección" className={`${fieldClass} mt-0`} value={entry.format} onChange={(event) => setSelectionValue(index, "format", event.target.value)} placeholder="XV" />
                <label className={`${labelClass} sm:sr-only`}>Detalle</label><input aria-label="Detalle convocatoria" className={`${fieldClass} mt-0`} value={entry.club_text} onChange={(event) => setSelectionValue(index, "club_text", event.target.value)} />
              </div>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin convocatorias registradas.</p>}
          </div>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-white p-4 sm:grid-cols-2">
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
              {professionalClubDrafts.map((entry, index) => <div key={`${entry.id ?? entry.club_name}-${index}`} className="grid gap-3 rounded-[8px] border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[110px_1fr_160px_1fr]">
                <label className={`${labelClass} sm:sr-only`}>Temporada</label><input aria-label="Temporada club profesional" className={`${fieldClass} mt-0`} value={entry.season_label} onChange={(event) => setProfessionalClubValue(index, "season_label", event.target.value)} placeholder="25/26" />
                <label className={`${labelClass} sm:sr-only`}>Club</label><select aria-label="Club profesional" className={`${fieldClass} mt-0`} value={entry.club_id || (entry.club_name ? `legacy:${entry.club_name}` : "")} onChange={(event) => setProfessionalClub(index, event.target.value)}><option value="">Sin indicar</option>{entry.club_name && !entry.club_id && <option value={`legacy:${entry.club_name}`}>{entry.club_name}</option>}{state?.clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Categoría</label><select aria-label="Categoría club profesional" className={`${fieldClass} mt-0 ${entry.category ? "" : "text-neutral-400"}`} value={entry.category} onChange={(event) => setProfessionalClubValue(index, "category", event.target.value)}><option value="">Sin indicar</option>{entry.category && !state?.professional_categories.some((category) => category.label === entry.category) && <option value={entry.category}>{entry.category}</option>}{state?.professional_categories.map((category) => <option key={category.id} value={category.label}>{category.siglas ? `${category.siglas} · ${category.label}` : category.label}</option>)}</select>
                <label className={`${labelClass} sm:sr-only`}>Notas</label><input aria-label="Notas club profesional" className={`${fieldClass} mt-0`} value={entry.notes} onChange={(event) => setProfessionalClubValue(index, "notes", event.target.value)} />
              </div>)}
            </> : <p className="rounded-[8px] border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-500">Sin clubs profesionales registrados.</p>}
          </div>
        </section>
        <section className="grid gap-4 rounded-[8px] border border-neutral-200 bg-neutral-50 p-4">
          <div>
            <h2 className={sectionTitleClass}>Autorizacion de publicacion</h2>
            <p className={helpClass}>Esta autorizacion separa lo que puede verse publicamente de la informacion sensible que solo usara CTRugby.</p>
          </div>
          <p className={`${helpClass} rounded-[8px] border border-neutral-200 bg-white px-3 py-2`}>Datos publicables: nombre, año de nacimiento, foto de ficha, fotografía de cabecera, trayectoria deportiva, participaciones, convocatorias y clubs profesionales.</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className={labelClass}>Datos basicos publicables</p>
            <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, basic_publication: "authorized" }))} className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-black ${authorizations.basic_publication === "authorized" ? "border-green-600 bg-green-50 text-green-700" : "border-neutral-300 bg-white text-neutral-700 hover:border-green-600 hover:text-green-700"}`}><Check size={14} aria-hidden="true" />Sí autorizo</button>
            <button type="button" onClick={() => setAuthorizations((current) => ({ ...current, basic_publication: "denied" }))} className={`inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs font-black ${authorizations.basic_publication === "denied" ? "border-red-600 bg-red-50 text-red-700" : "border-neutral-300 bg-white text-neutral-700 hover:border-red-600 hover:text-red-700"}`}><X size={14} aria-hidden="true" />No autorizo</button>
          </div>
          <p className="flex items-center gap-2 rounded-[8px] border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-semibold text-neutral-700"><AlertTriangle size={15} className="shrink-0 text-yellow-600" aria-hidden="true" />DNI, contacto, necesidades alimenticias, necesidades medicas, medicamentos, informes tecnicos e imagenes originales no se publicaran. Solo uso interno de CTRugby.</p>
        </section>
        <label className={labelClass}>Observaciones<textarea className={`${fieldClass} min-h-28 resize-y`} value={draft.observations} onChange={(event) => setValue("observations", event.target.value)} placeholder="Anota aqui cualquier aclaracion que ayude a Rugby a validar los cambios." /></label>
        {notice && <p className="rounded-[8px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{notice}</p>}
        <div className="flex justify-end border-t border-neutral-200 pt-4">
          <button type="button" disabled={saving || previewingPdf} onClick={() => void previewPdf()} className="rounded-[8px] bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{previewingPdf ? "Preparando PDF…" : "Vista previa antes de enviar"}</button>
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
      {publicPreview && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Vista previa pública">
        <div className="mx-auto my-8 max-w-3xl rounded-[10px] bg-white shadow-2xl">
          <header className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
            <div><p className="text-xs font-black uppercase tracking-[.16em] text-red-700">Vista previa pública</p><h2 className="mt-1 text-2xl font-black">Así se verá la ficha</h2><p className="mt-2 text-sm text-neutral-600">Los datos privados no aparecen en esta vista.</p></div>
            <button type="button" onClick={() => setPublicPreview(false)} className="rounded-[8px] border border-neutral-300 px-3 py-2 text-xs font-black">Cerrar</button>
          </header>
          <article className="p-5">
            <div className="rounded-[8px] bg-neutral-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.15em] text-red-300">RUGBY · Ficha de jugador</p><h3 className="mt-2 text-3xl font-black">{name}</h3><p className="mt-2 text-sm text-neutral-300">{[draft.category === "M" ? "Masculino" : draft.category === "F" ? "Femenino" : "", draft.birth_year && `Nacido/a en ${draft.birth_year}`].filter(Boolean).join(" · ") || "Datos deportivos"}</p></div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2"><section><h4 className="text-sm font-black uppercase tracking-[.1em] text-neutral-700">Trayectoria</h4><ul className="mt-2 grid gap-2 text-sm">{seasonDrafts.length ? seasonDrafts.map((season) => <li key={season.season_year} className="rounded-[8px] bg-neutral-100 p-3"><b>{season.season_year - 1}/{String(season.season_year).slice(-2)}</b><span className="block text-neutral-600">{[season.club_name, season.playing_category, season.competition_category].filter(Boolean).join(" · ") || "Sin detalles"}</span></li>) : <li className="text-neutral-500">Sin trayectoria indicada.</li>}</ul></section><section><h4 className="text-sm font-black uppercase tracking-[.1em] text-neutral-700">Participaciones</h4><ul className="mt-2 grid gap-2 text-sm">{participationDrafts.length ? participationDrafts.map((entry, index) => <li key={`${entry.year}-${index}`} className="rounded-[8px] bg-neutral-100 p-3"><b>{entry.year || "Año pendiente"}</b><span className="block text-neutral-600">{state?.campus_types.find((campus) => campus.id === entry.campus)?.label || "Campus sin indicar"}</span></li>) : <li className="text-neutral-500">Sin participaciones indicadas.</li>}</ul></section></div>
            <section className="mt-5"><h4 className="text-sm font-black uppercase tracking-[.1em] text-neutral-700">Convocatorias y clubes profesionales</h4><p className="mt-2 rounded-[8px] bg-neutral-100 p-3 text-sm text-neutral-600">{selectionDrafts.length + professionalClubDrafts.length ? `${selectionDrafts.length} convocatoria(s) y ${professionalClubDrafts.length} club(es) profesional(es) incluidos.` : "Sin registros indicados."}</p></section>
            <p className="mt-5 rounded-[8px] border border-yellow-200 bg-yellow-50 p-3 text-xs font-semibold text-neutral-700">No se mostrarán DNI, contacto, necesidades alimenticias, necesidades médicas ni medicamentos.</p>
          </article>
          <footer className="flex flex-wrap justify-end gap-3 border-t border-neutral-200 p-5"><button type="button" onClick={() => setPublicPreview(false)} className="rounded-[8px] border border-neutral-300 px-4 py-2 text-sm font-black">Volver a editar</button><button type="button" disabled={saving || !reviewedPdf} title={reviewedPdf ? "Guardar cambios y descargar la copia PDF" : "Abre primero la vista previa del PDF"} onClick={() => void submit()} className="rounded-[8px] bg-red-700 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? "Guardando..." : reviewedPdf ? "Guardar cambios y descargar PDF" : "Abre la vista previa para guardar"}</button></footer>
        </div>
      </div>}
    </section>
  </main>;
}
