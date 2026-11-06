"use client";
import { parseBirthInput, formatBirthInput, formatBirthEditInput } from "@/lib/birth-date";
import { normalizePhone, formatSpanishPhone } from "@/lib/phone-number";
import { trajectoryProfessionalClubs } from "@/app/lib/trajectory-professional-clubs";
/* eslint-disable @next/next/no-img-element */

import { currentClubSeason } from "@/lib/current-club";
import { summarizeProfessionalClubs } from "@/app/lib/professional-club-summary";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { PlayerClubPermissions } from "@/app/components/player-club-permissions";
import { Check, ChevronDown, LockKeyhole, Pencil, Save, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useSearchParams } from "@/lib/sport-navigation";
import { EntityPagination } from "@/app/components/entity-pagination";
import { ManagerMenu } from "@/app/components/manager-menu";
import { PlayerCoverActions } from "@/app/components/player-cover-actions";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import { PlayerAssessments } from "@/app/player-assessments";
import { PlayerTrajectory } from "./player-trajectory";
import { PlayerActivityLink } from "@/app/components/player-activity-link";
import { PlayerNewsPanel } from "./player-news";
import { PlayerResearchButton } from "./player-research-button";
import { PlayerProfilePdfButton, PlayerProfilePrintButton } from "./player-profile-pdf-button";

import { PlayerEventSizesCard } from "./player-event-sizes";
import type { PlayerEventSizes } from "@/lib/player-event-sizes";
import { PrivateDataTable } from "./private-data-table";
import { PlayerBillingCard } from "./player-billing";
import type { PlayerBilling } from "@/lib/player-billing";

type Season = { season_year: number; club_id: string | null; club_name: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null; playing_category?: string | null; competition_category?: string | null };
type Selection = { federation_id: string; scope: string; category: string | null; format?: string | null; season_label: string; club_text: string | null; position_text: string | null };
type ProfessionalClubRecord = { id: string; club_name: string; club_id: string | null; category: string; category_id?: string | null; season_label: string | null };
type ParticipationEntry = { year: string; campus: string; registration_number?: string };
type CampusReference = { id: string; label: string; siglas: string | null };
type ClubPalette = [string, string, string];
type PlayerContacts = { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null };
type ContactKind = "player" | "tutor1" | "tutor2";
type State = { event_sizes?: PlayerEventSizes | null; billing?: PlayerBilling | null; private_consents?: { food: boolean; medical: boolean; technical: boolean } | null; career?: { retired: boolean; staff_id: string | null; summary?: string; source_url?: string }; staff_options?: { id: string; name: string }[]; admin: boolean; private_access?: boolean; player: { nickname?: string | null; id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null; birth_date?: string | null; instagram: string | null; dni: string | null; allergies: string | null; medications: string | null; published: boolean; version: number }; current_season: Season | null; seasons: Season[]; clubs: { id: string; name: string }[]; professional_categories?: string[]; professional_category_references?: {id: string; label: string; type?: string}[]; contacts: PlayerContacts | null; participation: { participation_count: number; participation_years: string[]; participation_campus?: Record<string, string>; participation_registration_numbers?: Record<string, string>; participation_pending_year?: boolean }; campuses?: CampusReference[]; selections: Selection[]; professional_club_records: ProfessionalClubRecord[] };
type List = { players: { id: string; first_name: string; last_name: string | null }[] };
const emptyContacts: PlayerContacts = { player_email: "", player_phone_e164: "", tutor1_name: "", tutor1_email: "", tutor1_phone_e164: "", tutor2_name: "", tutor2_email: "", tutor2_phone_e164: "" };
const categoryShieldUrl = (id?: string | null) => id ? `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo` : null;


function ProfessionalClubBadge({ record }: { record: ProfessionalClubRecord }) {
  const clubShield = record.club_id ? clubShieldUrl(record.club_id) : null;
  const professionalCategoryShield = categoryShieldUrl(record.category_id);
  return <span className="player-profile-pro-club-badge">
    <span className="player-profile-pro-club-shields">
      {professionalCategoryShield && <img src={professionalCategoryShield} alt={`Escudo de ${record.category}`} />}
      {clubShield && <img src={clubShield} alt={`Escudo de ${record.club_name}`} />}
      {!professionalCategoryShield && !clubShield && <i aria-hidden="true">?</i>}
    </span>
    <b>{record.club_name || "Club no indicado"}</b>
    <small>{[record.category, record.season_label].filter(Boolean).join(" · ")}</small>
  </span>;
}
function HangingRugbyBoots() {
  return <img src="/rugby-boots-retired.png" alt="" className="h-full w-full object-contain" />;
}

export default function PlayerProfilePage() {
  const { id: rawId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const pdfMode = searchParams.get("pdf") === "1";
  const [loadedState, setState] = useState<State | null>(null);
  const state = loadedState && loadedState.player.id === id ? loadedState : null;
  const [entries, setEntries] = useState<{ id: string; name: string }[]>([]);
  const [failed, setFailed] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);
  const [missingCoverId, setMissingCoverId] = useState<string | null>(null);
  const [showParticipationDetail, setShowParticipationDetail] = useState(false);
  const [editingParticipation, setEditingParticipation] = useState(false);
  const [participationDraft, setParticipationDraft] = useState<ParticipationEntry[]>([]);
  const [participationCountDraft, setParticipationCountDraft] = useState("");
  const [participationPendingYearDraft, setParticipationPendingYearDraft] = useState(false);
  const [savingParticipation, setSavingParticipation] = useState(false);
  const [participationError, setParticipationError] = useState("");
  const [editingPlayerData, setEditingPlayerData] = useState(false);
  const [editingPrivateData, setEditingPrivateData] = useState(false);
  const [privateVisible, setPrivateVisible] = useState(true);
  const [playerDataMessage, setPlayerDataMessage] = useState("");
  const [playerDataDraft, setPlayerDataDraft] = useState({ nickname: "", first_name: "", last_name: "", club_id: "", club_query: "", staff_id: "", position_text: "", height_cm: "", weight_kg: "", category: "", birth_year: "", instagram: "", dni: "", allergies: "", medications: "" });
  const [savingPlayerData, setSavingPlayerData] = useState(false);
  const [playerDataError, setPlayerDataError] = useState("");
  const [editingContacts, setEditingContacts] = useState<"player" | "tutor2" | null>(null);
  const [contactsDraft, setContactsDraft] = useState<PlayerContacts>(emptyContacts);
  const [savingContacts, setSavingContacts] = useState(false);
  const [savingTechnicalConsent, setSavingTechnicalConsent] = useState(false);
  const [contactsMessage, setContactsMessage] = useState("");
  const [reviewLink, setReviewLink] = useState({ playerId: "", url: "" });
  const [reviewLinkMessage, setReviewLinkMessage] = useState("");
  const [clubPalette, setClubPalette] = useState<ClubPalette>(["#e8243c", "#f0abb3", "#dce8f0"]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/jugadores/${id}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => { if (!controller.signal.aborted) { setState(data); setFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    void fetch("/api/jugadores?navigation=1", { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data: List) => setEntries((data.players ?? []).map((player) => ({ id: player.id, name: [player.first_name, player.last_name].filter(Boolean).join(" ") }))))
      .catch(() => { if (!controller.signal.aborted) setEntries([]); });
    return () => controller.abort();
  }, [id]);

  const player = state?.player;
  const name = player ? [player.first_name, player.last_name].filter(Boolean).join(" ") : "";
  const current = state?.current_season;
  const clubSeason = currentClubSeason(state?.seasons ?? []);
  const sortedClubs = useMemo(() => [...(state?.clubs ?? [])].sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })), [state?.clubs]);
  useEffect(() => {
    if (!current?.club_id) return;
    void fetch(`/api/clubs/paleta/${current.club_id}`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ palette?: ClubPalette }>; })
      .then((data) => { if (data.palette) setClubPalette(data.palette); })
      .catch(() => undefined);
  }, [current?.club_id]);
  const seasonLabel = (year: number | null | undefined) => year ? `${String(year - 1).slice(-2)}/${String(year).slice(-2)}` : "—";
  const retiredLabel = player?.category === "F" ? "Retirada" : "Retirado";
  const displayCategory = state?.career?.retired ? retiredLabel : current?.playing_category || "—";
  const lastSeasonYear = Math.max(0, ...(state?.seasons ?? []).map((season) => season.season_year));
  const displaySeason = state?.career?.retired ? (lastSeasonYear ? String(lastSeasonYear) : "—") : seasonLabel(current?.season_year);
  const coverStyle = {
    ...(!state?.career?.retired && current?.club_id ? { backgroundImage: `linear-gradient(90deg,#fff 0%,#ffffffee 44%,#ffffffa8 72%,#ffffff40 100%),url(/api/clubs/portada/${current.club_id})` } : {}),
    "--player-stripe-1": clubPalette[0],
    "--player-stripe-2": clubPalette[1],
    "--player-stripe-3": clubPalette[2],
  } as CSSProperties;
  const federationCallups = state?.selections.reduce<Record<string, { id: string; scope: string; count: number }>>((groups, selection) => {
    const existing = groups[selection.federation_id];
    groups[selection.federation_id] = existing ? { ...existing, count: existing.count + 1 } : { id: selection.federation_id, scope: selection.scope, count: 1 };
    return groups;
  }, {}) ?? {};
  const orderedCallups = Object.values(federationCallups).sort((left, right) => Number(right.id.startsWith("FN")) - Number(left.id.startsWith("FN")));
  const refreshCover = () => { setMissingCoverId(null); setCoverVersion(Date.now()); };
  const participationEntries = state?.participation.participation_years.map((year) => ({ year, campus: state.participation.participation_campus?.[year] || "CAM001", registration_number: state.participation.participation_registration_numbers?.[year] ?? "" })) ?? [];
  const campusSiglas = useMemo(() => new Map((state?.campuses ?? []).map((campus) => [campus.id, campus.siglas || campus.id])), [state?.campuses]);
  const participationCampusLabel = (campus: string) => campusSiglas.get(campus) ?? campus;
  const hasPendingParticipationYear = Boolean(state?.participation.participation_pending_year) || ((state?.participation.participation_count ?? 0) > participationEntries.length);
  const participationHref = state?.admin ? "/noticias?tipo=participacion&jugador=" + encodeURIComponent(id) : "/jugadores/" + encodeURIComponent(id) + "/participaciones";
  const participationCampuses = Object.entries(participationEntries.reduce<Record<string, number>>((counts, entry) => ({ ...counts, [entry.campus]: (counts[entry.campus] ?? 0) + 1 }), {})).map(([campus, count]) => ({ campus, count }));
  const startParticipationEdit = () => { setParticipationDraft(participationEntries.map((entry) => ({ ...entry }))); setParticipationCountDraft(String(state?.participation.participation_count ?? participationEntries.length)); setParticipationPendingYearDraft(hasPendingParticipationYear); setParticipationError(""); setShowParticipationDetail(true); setEditingParticipation(true); };
  const saveParticipation = async () => {
    const participation_count = Number(participationCountDraft);
    if (!id || participationDraft.some((entry) => !entry.campus.trim())) { setParticipationError("Indica el nombre del campus en todas las participaciones."); return; }
    if (!Number.isInteger(participation_count) || participation_count < participationDraft.length || participation_count > 99) { setParticipationError("Indica un número de participaciones válido."); return; }
    if (participation_count > participationDraft.length && !participationPendingYearDraft) { setParticipationError("Marca \"Pendiente identificar año\" para guardar participaciones sin año."); return; }
    setSavingParticipation(true);
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participations: { entries: participationDraft, participation_count, participation_pending_year: participationPendingYearDraft } }) });
      const result = await response.json() as { participation?: State["participation"]; error?: string };
      if (!response.ok || !result.participation) throw new Error(result.error || "No se ha podido guardar el campus.");
      setState((current) => current ? { ...current, participation: result.participation! } : current);
      setEditingParticipation(false);
    } catch (cause) { setParticipationError(cause instanceof Error ? cause.message : "No se ha podido guardar el campus."); }
    finally { setSavingParticipation(false); }
  };
  const startPlayerDataEdit = () => {
    setPlayerDataMessage("");
    setPlayerDataDraft({ nickname: player?.nickname ?? "", first_name: player?.first_name ?? "", last_name: player?.last_name ?? "", club_id: clubSeason?.club_id ?? "", club_query: state?.career?.retired ? (player?.category === "F" ? "Retirada" : "Retirado") : clubSeason?.club_name ?? clubSeason?.legacy_club_name ?? "", staff_id: state?.career?.staff_id ?? "", position_text: current?.position_text ?? "", height_cm: current?.height_cm ? String(current.height_cm) : "", weight_kg: current?.weight_kg ? String(current.weight_kg) : "", category: player?.category ?? "", birth_year: formatBirthEditInput(player?.birth_date,player?.birth_year), instagram: player?.instagram ?? "", dni: player?.dni ?? "", allergies: player?.allergies ?? "", medications: player?.medications ?? "" });
    setPlayerDataError(""); setEditingPlayerData(true);
  };
  const startPrivateDataEdit = () => {
    setPlayerDataDraft({ nickname: player?.nickname ?? "", first_name: player?.first_name ?? "", last_name: player?.last_name ?? "", club_id: clubSeason?.club_id ?? "", club_query: state?.career?.retired ? (player?.category === "F" ? "Retirada" : "Retirado") : clubSeason?.club_name ?? clubSeason?.legacy_club_name ?? "", staff_id: state?.career?.staff_id ?? "", position_text: current?.position_text ?? "", height_cm: current?.height_cm ? String(current.height_cm) : "", weight_kg: current?.weight_kg ? String(current.weight_kg) : "", category: player?.category ?? "", birth_year: formatBirthEditInput(player?.birth_date,player?.birth_year), instagram: player?.instagram ?? "", dni: player?.dni ?? "", allergies: player?.allergies ?? "", medications: player?.medications ?? "" });
    setContactsDraft({ ...emptyContacts, ...(state?.contacts ?? {}), player_phone_e164: formatSpanishPhone(state?.contacts?.player_phone_e164), tutor1_phone_e164: formatSpanishPhone(state?.contacts?.tutor1_phone_e164), tutor2_phone_e164: formatSpanishPhone(state?.contacts?.tutor2_phone_e164) });
    setContactsMessage(""); setPlayerDataError(""); setEditingPrivateData(true);
  };
  const setPlayerClubQuery = (value: string) => {
    const selected = sortedClubs.find((club) => club.name.localeCompare(value, "es", { sensitivity: "base" }) === 0);
    setPlayerDataDraft((draft) => ({ ...draft, club_query: value, club_id: selected?.id ?? "" }));
  };
  const savePrivatePlayerData = async () => {
    if (!id) return;
    setSavingPlayerData(true); setPlayerDataError("");
    try {
      const response = await fetch("/api/jugadores/" + id, {method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({privatePlayerData:{dni:playerDataDraft.dni,instagram:playerDataDraft.instagram,allergies:playerDataDraft.allergies,medications:playerDataDraft.medications,player_email:contactsDraft.player_email,player_phone_e164:contactsDraft.player_phone_e164}})});
      const result = await response.json() as {private_player_data?: Partial<State["player"]>; contacts?:PlayerContacts; error?:string};
      if (!response.ok || !result.private_player_data || !result.contacts) throw new Error(result.error || "No se han podido guardar los datos privados.");
      setState(current => current ? {...current, player:{...current.player,...result.private_player_data},contacts:result.contacts!} : current);
      setContactsDraft({...emptyContacts,...result.contacts});
      setEditingPrivateData(false); setEditingContacts(null);
    } catch (error) {setPlayerDataError(error instanceof Error ? error.message : "No se han podido guardar los datos privados.");}
    finally {setSavingPlayerData(false);}
  };
  const savePlayerData = async () => {
    if (!id) return;
    const height_cm = playerDataDraft.height_cm ? Number(playerDataDraft.height_cm) : null;
    const weight_kg = playerDataDraft.weight_kg ? Number(playerDataDraft.weight_kg) : null;
    const birth = parseBirthInput(playerDataDraft.birth_year);
    const birth_year = birth?.birth_year ?? null;
    if (!playerDataDraft.first_name.trim()) { setPlayerDataError("Indica el nombre del jugador."); return; }
    if ((height_cm !== null && (!Number.isFinite(height_cm) || height_cm <= 0)) || (weight_kg !== null && (!Number.isFinite(weight_kg) || weight_kg <= 0))) { setPlayerDataError("Indica una altura y un peso válidos."); return; }
    if (!birth) { setPlayerDataError("Indica nacimiento como AAAA o DD/MM/AAAA."); return; }
    if (playerDataDraft.instagram.trim() && !/^@[^@\s]+$/.test(playerDataDraft.instagram.trim())) { setPlayerDataError("Instagram debe empezar por @ y no contener espacios."); return; }
    if (playerDataDraft.club_query.trim() && !/^retirad[oa]$/i.test(playerDataDraft.club_query.trim()) && !playerDataDraft.club_id) { setPlayerDataError("Selecciona un club del listado o deja el campo vacío."); return; }
    setSavingPlayerData(true);
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerData: { retired: /^retirad[oa]$/i.test(playerDataDraft.club_query.trim()), staff_id: playerDataDraft.staff_id || null, nickname: playerDataDraft.nickname.trim() || null, first_name: playerDataDraft.first_name.trim(), last_name: playerDataDraft.last_name.trim() || null, club_id: playerDataDraft.club_id || null, position_text: playerDataDraft.position_text || null, height_cm, weight_kg, category: playerDataDraft.category || null, birth_year, birth_date: birth.birth_date, instagram: playerDataDraft.instagram.trim() || null, dni: playerDataDraft.dni.trim() || null, allergies: playerDataDraft.allergies.trim() || null, medications: playerDataDraft.medications.trim() || null } }) });
      const result = await response.json() as { career?: State["career"]; player?: State["player"]; current_season?: Season | null; seasons?: Season[]; error?: string };
      if (!response.ok || !result.player || !result.seasons) throw new Error(result.error || "No se han podido guardar los datos.");
      setState((value) => value ? { ...value, career: result.career ?? value.career, player: result.player!, current_season: result.current_season ?? null, seasons: result.seasons! } : value);
      setEditingPlayerData(false);
      setEditingPrivateData(false);
      setPlayerDataMessage("Datos guardados.");
    } catch (cause) { setPlayerDataError(cause instanceof Error ? cause.message : "No se han podido guardar los datos."); }
    finally { setSavingPlayerData(false); }
  };
  const contactValue = (value: string | null | undefined) => value ?? "";
  const startContactsEdit = (kind: "player" | "tutor2") => { setContactsDraft({ ...emptyContacts, ...(state?.contacts ?? {}), player_phone_e164: formatSpanishPhone(state?.contacts?.player_phone_e164), tutor1_phone_e164: formatSpanishPhone(state?.contacts?.tutor1_phone_e164), tutor2_phone_e164: formatSpanishPhone(state?.contacts?.tutor2_phone_e164) }); setContactsMessage(""); setEditingContacts(kind); };
  const setContactDraft = (field: keyof PlayerContacts, value: string) => setContactsDraft((draft) => ({ ...draft, [field]: value }));
  const togglePrivateConsent = async (kind: "food" | "medical" | "technical") => {
    if (!id || !state) return;
    setSavingTechnicalConsent(true);
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ privateConsent: { kind, value: !state.private_consents?.[kind] } }) });
      const result = await response.json() as { private_consents?: State["private_consents"]; error?: string };
      if (!response.ok || !result.private_consents) throw new Error(result.error || "No se ha podido guardar la autorización.");
      setState(current => current ? { ...current, private_consents: result.private_consents } : current);
    } finally { setSavingTechnicalConsent(false); }
  };
    const saveContacts = async (provisionAccess?: ContactKind) => {
    const emailValues = [contactsDraft.player_email, contactsDraft.tutor1_email, contactsDraft.tutor2_email].map(contactValue).filter(Boolean);
    const phoneValues = [contactsDraft.player_phone_e164, contactsDraft.tutor1_phone_e164, contactsDraft.tutor2_phone_e164].map(contactValue).filter(Boolean);
    if (emailValues.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { setContactsMessage("Revisa el formato de los correos."); return; }
    if (phoneValues.some((phone) => !/^\+[1-9][0-9]{7,14}$/.test(normalizePhone(phone) ?? ""))) { setContactsMessage("Introduce nueve cifras para España o un teléfono con prefijo internacional."); return; }
    setSavingContacts(true); setContactsMessage("");
    try {
      const response = await fetch(`/api/jugadores/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playerContacts: contactsDraft, provisionAccess }) });
      const result = await response.json() as { contacts?: PlayerContacts; access?: { email: string }; error?: string };
      if (!response.ok || !result.contacts) throw new Error(result.error || "No se han podido guardar los contactos.");
      setState((value) => value ? { ...value, contacts: result.contacts! } : value);
      setContactsDraft({ ...emptyContacts, ...result.contacts });
      setContactsMessage(result.access ? `Acceso privado enviado a ${result.access.email}.` : "Contactos privados guardados.");
      if (!provisionAccess) setEditingContacts(null);
    } catch (cause) { setContactsMessage(cause instanceof Error ? cause.message : "No se han podido guardar los contactos."); }
    finally { setSavingContacts(false); }
  };
  useEffect(() => {
    if (!state?.admin || state.player.id !== id) return;
    let cancelled = false;
    void fetch("/api/revision-jugador/crear", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ player_id: id }),
    }).then(async (response) => {
      const result = await response.json() as { short_url?: string; error?: string };
      if (!response.ok || !result.short_url) throw new Error(result.error || "No se ha podido cargar la URL de edición.");
      if (!cancelled) { setReviewLink({ playerId: id, url: result.short_url }); setReviewLinkMessage(""); }
    }).catch((cause) => { if (!cancelled) { setReviewLink({ playerId: id, url: "" }); setReviewLinkMessage(cause instanceof Error ? cause.message : "No se ha podido cargar la URL de edición."); } });
    return () => { cancelled = true; };
  }, [id, state?.admin, state?.player.id]);

  return <main className="directory-app min-h-screen">
    <header className="catalog-topbar">
      <Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} /><span><strong>RUGBY - HUB</strong></span></Link>
      <ManagerMenu current="players" />
    </header>
    <div className="mx-auto max-w-7xl px-5 py-5 sm:px-8">
      {failed ? <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">No se ha podido cargar esta ficha.</p> : !player ? <p className="p-5 text-neutral-500">Cargando ficha de jugador…</p> : <>
        <EntityPagination entries={entries} currentId={player.id} hrefPrefix="/jugadores" leading={pdfMode ? <PlayerProfilePrintButton playerId={player.id} /> : <PlayerProfilePdfButton playerId={player.id} />} />
        {state.admin && !pdfMode && <PlayerResearchButton key={player.id} playerId={player.id} name={[player.first_name, player.last_name].filter(Boolean).join(" ")} birthYear={player.birth_year} club={state.current_season?.club_name ?? state.current_season?.legacy_club_name ?? null} />}
        <section className="player-profile-cover" style={coverStyle}>
          <i className="player-profile-stripes" aria-hidden="true"><b /><b /><b /></i>
          <div className="player-profile-cover-copy">
            <p><i className="ctrugby-marker" /><b>Rugby</b><i aria-hidden="true" />FICHA DE {player.category === "F" ? "JUGADORA" : "JUGADOR"}</p>
            <h1><span>{player.first_name.toUpperCase()}{player.nickname && <> &quot;{player.nickname}&quot;</>}</span>{player.last_name && <strong>{player.last_name.toUpperCase()}</strong>}{state.admin && <em>{player.id}</em>}</h1>
            {state.career?.staff_id && <Link href={"/staff/" + state.career.staff_id} className="player-profile-participation-button mt-3 inline-flex">Ver ficha staff</Link>}
              <div className="player-profile-cover-facts">
              <span aria-label="Categoría"><small>CATEGORÍA</small><b>{displayCategory}</b></span>
              <span className="player-profile-season"><small>TEMPORADA</small><b>{displaySeason}</b>{rugbyPositionLabel(current?.position_text) && <strong>{rugbyPositionLabel(current?.position_text)}</strong>}</span>
            </div>
          </div>
          {state.admin && <datalist id="player-profile-clubs"><option value="Retirado" /><option value="Retirada" />{sortedClubs.map((club) => <option key={club.id} value={club.name} />)}</datalist>}
          {state.career?.retired && <span className="player-profile-cover-club" role="img" aria-label="Jugador retirado: botas de rugby colgadas"><HangingRugbyBoots /></span>}
          {!state.career?.retired && current?.club_id && clubShieldUrl(current.club_id) && <Link href={`/clubs/${current.club_id}`} className="player-profile-cover-club image-hover-preview" title={current.club_name ?? "Club actual"}><img src={clubShieldUrl(current.club_id)!} alt={`Escudo de ${current.club_name ?? "su club"}`} className="image-hover-preview-image" /></Link>}
          <div className="player-profile-cover-photo" aria-live="polite">
            {missingCoverId !== player.id ? <img src={`/api/jugadores/portada/${player.id}?v=${coverVersion}`} alt={`Foto de cabecera de ${name}`} onError={() => setMissingCoverId(player.id)} /> : <span>Foto de cabecera pendiente.</span>}
          </div>
          {state.admin && <PlayerCoverActions id={player.id} name={name} onUpdated={refreshCover} />}
        </section>
        {state.admin && !pdfMode && <section className="mt-5 rounded-[8px] border border-red-100 bg-white p-4 shadow-sm">
          <label className="block text-sm font-black uppercase tracking-[.12em] text-neutral-800">URL de edición
            <input readOnly aria-label="URL de edición" className="mt-3 w-full rounded-[8px] border border-neutral-300 px-3 py-2 text-sm font-semibold normal-case tracking-normal text-neutral-700" value={reviewLink.playerId === id ? reviewLink.url : ""} placeholder="Cargando URL privada…" onFocus={(event) => event.currentTarget.select()} />
          </label>
          <small className="mt-2 block text-neutral-500">Enlace privado de este jugador para incluir en los mensajes de administración.</small>
          {reviewLinkMessage && <small role="alert" className="mt-2 block font-bold text-red-700">{reviewLinkMessage}</small>}
        </section>}
        <section className="player-profile-grid">
          <article className="club-record-card player-profile-data"><div className="flex items-center justify-between gap-3"><h2>{player.category === "F" ? "DATOS DE LA JUGADORA" : "DATOS DEL JUGADOR"}</h2>{state.admin && !editingPlayerData && <button type="button" className="player-profile-participation-button player-profile-data-edit" aria-label="Editar datos del jugador" title="Editar datos" onClick={startPlayerDataEdit}><Pencil size={15} aria-hidden="true" /></button>}</div>{editingPlayerData ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nombre<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.first_name} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, first_name: event.target.value }))} /></label><label className="text-sm font-semibold">Apellidos<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.last_name} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, last_name: event.target.value }))} /></label><label className="text-sm font-semibold">Apodo<input maxLength={80} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.nickname} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, nickname: event.target.value }))} /></label><label className="text-sm font-semibold">Género<select className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" value={playerDataDraft.category} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, category: event.target.value }))}><option value="">Sin género</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label><label className="text-sm font-semibold">Fecha o año de nacimiento<input type="text" inputMode="numeric" placeholder="AAAA o DD/MM/AAAA" maxLength={10} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.birth_year} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, birth_year: event.target.value }))} /></label><label className="text-sm font-semibold">Altura (cm)<input type="number" min="1" max="250" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.height_cm} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, height_cm: event.target.value }))} /></label><label className="text-sm font-semibold">Peso (kg)<input type="number" min="1" max="250" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.weight_kg} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, weight_kg: event.target.value }))} /></label><label className="text-sm font-semibold">Club actual<input list="player-profile-clubs" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.club_query} onChange={(event) => setPlayerClubQuery(event.target.value)} placeholder="Buscar club, Retirado o Retirada..." /></label><label className="text-sm font-semibold">Ficha de staff<select value={playerDataDraft.staff_id} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, staff_id: event.target.value }))} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal"><option value="">Sin ficha vinculada</option>{state.staff_options?.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.id}</option>)}</select></label><label className="text-sm font-semibold">Posición (indicar posiciones)<input list="player-profile-positions" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.position_text} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, position_text: event.target.value }))} placeholder="Ej. 6 · 7 · 15" /></label><datalist id="player-profile-positions"><option value="Pilar" /><option value="Talonador" /><option value="Segunda línea" /><option value="Flanker" /><option value="Ocho" /><option value="Medio melé" /><option value="Apertura" /><option value="Centro" /><option value="Ala" /><option value="Zaguero" /><option value="Chutador" /></datalist><div className="flex gap-2 sm:col-span-2"><button type="button" className="player-profile-participation-button" disabled={savingPlayerData} aria-label="Guardar datos del jugador" title="Guardar datos" onClick={() => void savePlayerData()}>{savingPlayerData ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={savingPlayerData} onClick={() => setEditingPlayerData(false)}><X size={16} aria-hidden="true" /></button></div>{playerDataError && <small className="player-profile-participation-error sm:col-span-2" role="alert">{playerDataError}</small>}</div> : <dl>
            {player.nickname && <div className="player-profile-data-nickname"><dt>Apodo</dt><dd>{player.nickname}</dd></div>}<div><dt>Género</dt><dd>{player.category === "M" ? "Masculino" : player.category === "F" ? "Femenino" : "—"}</dd></div>
            <div><dt>Fecha o año de nacimiento</dt><dd>{formatBirthInput(player.birth_date,player.birth_year) || "—"}</dd></div>
            <div><dt>Altura</dt><dd>{current?.height_cm ? `${current.height_cm} cm` : "—"}</dd></div>
            <div><dt>Peso</dt><dd>{current?.weight_kg ? `${current.weight_kg} kg` : "—"}</dd></div>
            <div className="player-profile-data-club"><dt>Club actual</dt><dd>{state.career?.retired ? (player.category === "F" ? "Retirada" : "Retirado") : clubSeason?.club_id ? <Link href={`/clubs/${clubSeason.club_id}`}>{clubSeason.club_name}</Link> : clubSeason?.club_name ?? clubSeason?.legacy_club_name ?? "—"}</dd></div>
            <div className="player-profile-data-position"><dt>Posición</dt><dd>{rugbyPositionLabel(current?.position_text) ?? "—"}</dd></div>
          </dl>}{playerDataMessage && <p role="status" className="text-sm text-green-700">{playerDataMessage}</p>}{state.private_access && !state.admin && <PlayerClubPermissions playerId={player.id} />}</article>
          <article className="club-record-card player-profile-callups">
            <p>CONVOCATORIAS</p>
            <div className="player-profile-callups-pills">{orderedCallups.map((federation) => <PlayerActivityLink key={federation.id} playerId={player.id} kind="convocatorias" federation={federation.id} className={`player-profile-callup-pill ${federation.id.startsWith("FN") ? "national" : "regional"}`} aria-label={`${federation.count} convocatoria${federation.count === 1 ? "" : "s"} ${federation.scope}`} title={federation.scope}><img src={federationShieldUrl(federation.id) ?? ""} alt="" /><b>{federation.count}</b></PlayerActivityLink>)}</div>
            {!state.selections.length && <small>Sin convocatorias registradas</small>}
            <PlayerNewsPanel key={player.id} playerId={player.id} admin={state.admin} />
            <p>CAMPUS &amp; EXPERIENCES</p>
            <div className="player-profile-callups-pills">{participationCampuses.map(({ campus, count }) => <Link key={campus} href={participationHref} className="player-profile-callup-pill" aria-label={`${count} participación${count === 1 ? "" : "es"} en ${participationCampusLabel(campus)}`}><img src={`/api/hitos/profesionales/categorias/${encodeURIComponent(campus)}/escudo`} alt={`Logo ${participationCampusLabel(campus)}`} /><b>{count}</b></Link>)}</div>

            <div className="player-profile-participation-actions"><Link href={participationHref} className="player-profile-participation-button">Ver detalle</Link>{state.admin && <button type="button" className="player-profile-participation-button" onClick={startParticipationEdit} aria-label="Editar" title="Editar"><Pencil size={15} aria-hidden="true" /></button>}</div>
            {showParticipationDetail && <div className="player-profile-participation-expanded"><b>{editingParticipation ? "EDITAR PARTICIPACIONES" : "DETALLE DE PARTICIPACIONES"}</b>{participationEntries.length ? <ul>{(editingParticipation ? participationDraft : participationEntries).map(({ year, campus, registration_number }, index) => <li key={year}>{editingParticipation ? <input aria-label={`Fecha o año de participación ${year}`} value={year} placeholder="YYYY o DD/MM/YY" onChange={(event) => setParticipationDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, year: event.target.value } : entry))} /> : <strong>{year}</strong>}{editingParticipation ? <><select aria-label={`Campus ${year}`} value={campus} onChange={(event) => setParticipationDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, campus: event.target.value } : entry))}>{!state.campuses?.some((item) => item.id === campus) && <option value={campus}>{participationCampusLabel(campus)}</option>}{state.campuses?.map((item) => <option key={item.id} value={item.id}>{item.siglas || item.label}</option>)}</select><input aria-label={`Registro de campus ${year}`} value={registration_number ?? ""} placeholder="Registro" onChange={(event) => setParticipationDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, registration_number: event.target.value.toUpperCase() } : entry))} /></> : <span>{[registration_number, participationCampusLabel(campus)].filter(Boolean).join(" · ")}</span>}</li>)}</ul> : <span>{hasPendingParticipationYear ? "Pendiente identificar año." : "Sin detalle registrado."}</span>}{editingParticipation && <><div className="player-profile-participation-manual"><label>Número de participaciones<input type="number" min={participationDraft.length} max="99" value={participationCountDraft} onChange={(event) => setParticipationCountDraft(event.target.value)} /></label><label><input type="checkbox" checked={participationPendingYearDraft} onChange={(event) => setParticipationPendingYearDraft(event.target.checked)} /> Pendiente identificar año</label></div><div className="player-profile-participation-edit-actions"><button type="button" className="player-profile-participation-button" disabled={savingParticipation} onClick={() => void saveParticipation()}>{savingParticipation ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={savingParticipation} onClick={() => setEditingParticipation(false)}><X size={16} aria-hidden="true" /></button></div>{participationError && <small className="player-profile-participation-error" role="alert">{participationError}</small>}</>}</div>}
            {trajectoryProfessionalClubs(state.seasons, state.clubs, state.professional_category_references).length > 0 && <div className="player-profile-pro-clubs"><b>CLUBS PROFESIONALES</b><div>{summarizeProfessionalClubs(trajectoryProfessionalClubs(state.seasons, state.clubs, state.professional_category_references)).map((record) => <ProfessionalClubBadge key={record.id} record={record} />)}</div></div>}
          </article>
        </section>
        {(state.admin || state.private_access) && <>
          <section className="club-record-card player-profile-private-access player-profile-private-wide"><div className="flex items-center justify-between gap-3"><h3><LockKeyhole size={12} className="mr-1 inline-block" aria-hidden="true" />ACCESO PRIVADO</h3><button type="button" className="player-private-toggle" onClick={() => setPrivateVisible((visible) => !visible)} aria-expanded={privateVisible} aria-label={privateVisible ? "Ocultar datos privados" : "Mostrar datos privados"}><ChevronDown size={16} aria-hidden="true" /></button></div><p className="text-xs font-semibold leading-5 text-neutral-600">Pulsa la X para autorizar compartir esa categoría con su club. La autorización se mostrará con ✓ verde.</p></section>
          <div hidden={!privateVisible}>
          <section className="club-record-card player-profile-private-access player-profile-private-wide"><div className="flex items-center justify-between gap-3"><h3><LockKeyhole size={12} className="mr-1 inline-block" aria-hidden="true" />DATOS PRIVADOS JUGADOR</h3>{state.admin && !editingPrivateData && <button type="button" className="player-profile-participation-button" onClick={startPrivateDataEdit} aria-label="Editar datos privados del jugador" title="Editar datos privados del jugador"><Pencil size={15} aria-hidden="true" /></button>}</div>{editingPrivateData ? <div className="grid gap-3"><label className="text-sm font-semibold">DNI/NIE jugador<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal uppercase" value={playerDataDraft.dni} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, dni: event.target.value.toUpperCase() }))} /></label><label className="text-sm font-semibold">Instagram<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.instagram} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, instagram: event.target.value }))} placeholder="@usuario" /></label><label className="text-sm font-semibold">Mail jugador<input type="email" autoComplete="email" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={contactValue(contactsDraft.player_email)} onChange={event => setContactDraft("player_email",event.target.value)} /></label><label className="text-sm font-semibold">Teléfono jugador<input type="tel" onBlur={() => setContactDraft("player_phone_e164", formatSpanishPhone(contactsDraft.player_phone_e164))} autoComplete="tel" placeholder="+34 XXX XXX XXX" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={contactValue(contactsDraft.player_phone_e164)} onChange={event => setContactDraft("player_phone_e164",event.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Necesidades alimenticias (Alergias)<textarea className="mt-1 block min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.allergies} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, allergies: event.target.value }))} /></label><label className="text-sm font-semibold sm:col-span-2">Necesidades médicas (medicamentos)<textarea className="mt-1 block min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={playerDataDraft.medications} onChange={(event) => setPlayerDataDraft((draft) => ({ ...draft, medications: event.target.value }))} /></label><div className="player-profile-private-actions"><button type="button" className="player-profile-participation-button" aria-label="Guardar necesidades privadas" title="Guardar necesidades privadas" disabled={savingPlayerData} onClick={() => void savePrivatePlayerData()}>{savingPlayerData ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={savingPlayerData} onClick={() => { setEditingPrivateData(false); setEditingContacts(null); setPlayerDataError(""); }}><X size={16} aria-hidden="true" /></button></div></div> : <PrivateDataTable fields={[{ label: <span className="player-consent-heading"><button type="button" className={state.private_consents?.food ? "player-consent-toggle approved" : "player-consent-toggle denied"} aria-label="Autorizar compartir necesidades alimenticias" disabled={savingTechnicalConsent} onClick={() => void togglePrivateConsent("food")}>{state.private_consents?.food ? <Check size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />}</button>Necesidades alimenticias</span>, value: <>{player.allergies ?? "—"}</>, width: "50%" }, { label: <span className="player-consent-heading"><button type="button" className={state.private_consents?.medical ? "player-consent-toggle approved" : "player-consent-toggle denied"} aria-label="Autorizar compartir necesidades médicas" disabled={savingTechnicalConsent} onClick={() => void togglePrivateConsent("medical")}>{state.private_consents?.medical ? <Check size={17} aria-hidden="true" /> : <X size={17} aria-hidden="true" />}</button>Necesidades médicas</span>, value: <>{player.medications ?? "—"}</>, width: "50%" }]} />}{state.admin && !editingPrivateData && <>{editingContacts === "player" ? <div className="player-profile-private-grid"><label>Mail jugador<input type="email" value={contactValue(contactsDraft.player_email)} onChange={(event) => setContactDraft("player_email", event.target.value)} /></label><label>Teléfono jugador<input type="tel" onBlur={() => setContactDraft("player_phone_e164", formatSpanishPhone(contactsDraft.player_phone_e164))} value={contactValue(contactsDraft.player_phone_e164)} onChange={(event) => setContactDraft("player_phone_e164", event.target.value)} /></label><div className="player-profile-private-actions"><button type="button" className="player-profile-participation-button" disabled={savingContacts} onClick={() => void saveContacts()}>{savingContacts ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={savingContacts} onClick={() => setEditingContacts(null)}><X size={16} aria-hidden="true" /></button></div></div> : <PrivateDataTable fields={[{ label: "DNI/NIE jugador", value: <>{player.dni || "—"}</>, width: "22%" }, { label: "Instagram", value: <>{player.instagram || "—"}</>, width: "23%" }, { label: "Mail jugador", value: <>{state.contacts?.player_email || "—"}</>, width: "32%" }, { label: "Teléfono jugador", value: <>{formatSpanishPhone(state.contacts?.player_phone_e164) || "—"}</>, width: "23%" }]} />}{contactsMessage && editingContacts === "player" && <small role="status">{contactsMessage}</small>}</>}{editingPrivateData && playerDataError && <p role="alert" className="player-profile-participation-error">{playerDataError}</p>}</section>
          <PlayerEventSizesCard key={player.id} playerId={player.id} initial={state.event_sizes} canEdit={state.admin} />
          {state.admin && <PlayerAssessments playerId={player.id} printMode={pdfMode} technicalConsent={Boolean(state.private_consents?.technical)} onToggleTechnicalConsent={() => void togglePrivateConsent("technical")} />}
          {state.admin && <PlayerBillingCard key={player.id} playerId={player.id} initial={state.billing} contacts={state.contacts ?? emptyContacts} onContactsSaved={(contacts) => setState(previous => previous ? { ...previous, contacts } : previous)} />}
          {state.admin && <section className="club-record-card player-profile-private-access player-profile-private-wide"><div className="flex items-center justify-between gap-3"><h3><LockKeyhole size={12} className="mr-1 inline-block" aria-hidden="true" />DATOS SEGUNDO TUTOR</h3>{state.admin && editingContacts !== "tutor2" && <button type="button" className="player-profile-participation-button" onClick={() => startContactsEdit("tutor2")} aria-label="Editar contactos" title="Editar contactos"><Pencil size={15} aria-hidden="true" /></button>}</div>{state.admin && <>{editingContacts === "tutor2" ? <div className="player-profile-private-grid"><label>Nombre y apellidos<input  value={contactValue(contactsDraft.tutor2_name)} onChange={(event) => setContactDraft("tutor2_name", event.target.value)} /></label><label>Mail segundo tutor<input type="email" value={contactValue(contactsDraft.tutor2_email)} onChange={(event) => setContactDraft("tutor2_email", event.target.value)} /></label><label>Teléfono segundo tutor<input type="tel" onBlur={() => setContactDraft("tutor2_phone_e164", formatSpanishPhone(contactsDraft.tutor2_phone_e164))} value={contactValue(contactsDraft.tutor2_phone_e164)} onChange={(event) => setContactDraft("tutor2_phone_e164", event.target.value)} /></label><div className="player-profile-private-actions"><button type="button" className="player-profile-participation-button" disabled={savingContacts} onClick={() => void saveContacts()}>{savingContacts ? "Guardando…" : <Save size={16} aria-hidden="true" />}</button><button type="button" className="player-edit-cancel" aria-label="Cancelar edición" title="Cancelar" disabled={savingContacts} onClick={() => setEditingContacts(null)}><X size={16} aria-hidden="true" /></button></div></div> : <PrivateDataTable fields={[{ label: "Nombre y apellidos", value: <>{state.contacts?.tutor2_name || "—"}</>, width: "42%" },{ label: "Mail segundo tutor", value: <>{state.contacts?.tutor2_email || "—"}</>, width: "35%" },{ label: "Teléfono segundo tutor", value: <>{formatSpanishPhone(state.contacts?.tutor2_phone_e164) || "—"}</>, width: "23%" }]} />}{contactsMessage && editingContacts === "tutor2" && <small role="status">{contactsMessage}</small>}</>}</section>}
          </div>
        </>}
        <section className="player-profile-lower">
          {state.career?.summary && <article className="club-record-card"><h2>Perfil deportivo</h2><p className="mt-3 text-sm leading-relaxed text-neutral-700">{state.career.summary}</p>{state.career.source_url && <a href={state.career.source_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-red-700">Ver perfil de referencia</a>}</article>}
          <PlayerTrajectory key={player.id} id={player.id} seasons={state.seasons} birthYear={player.birth_year} admin={state.admin} clubs={state.clubs} professionalCategories={state.professional_categories} published={player.published} version={player.version} onSaved={(seasons) => setState((previous) => previous ? { ...previous, seasons, current_season: seasons[0] ?? null } : previous)} />
        </section>
        {state.selections.length > 0 && <section className="player-milestones club-record-card"><header><b><span className="trajectory-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h10v4a5 5 0 0 1-10 0V3Z" /><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6" /></svg></span> HITOS DEPORTIVOS</b><strong>{state.selections.length}</strong>{state.admin && <button type="button">+ Añadir jugador</button>}</header><ul>{state.selections.map((milestone, index) => <li key={`${milestone.federation_id}-${milestone.season_label}-${index}`}><b>{milestone.season_label}</b><img src={federationShieldUrl(milestone.federation_id) ?? ""} alt="" /><strong>{[milestone.federation_id ? "Convocatoria selección" : null, milestone.scope, milestone.category, milestone.format].filter(Boolean).join(" · ")}</strong><span>{milestone.club_text ?? "—"}</span>{state.admin && <button type="button" aria-label="Editar jugador" title="Editar jugador">Editar jugador</button>}</li>)}</ul></section>}
      </>}
    </div>
  </main>;
}



