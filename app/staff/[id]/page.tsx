"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { Pencil, Star } from "lucide-react";
import { useParams } from "@/lib/sport-navigation";
import { useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { PlayerNewsPanel } from "@/app/jugadores/[id]/player-news";
import { StaffMediaActions } from "./staff-media-actions";

type StaffMilestone = { id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null; featured?: boolean };
type StaffProfile = {
  associated_kind: string | null;
  associated_id: string | null;
  associated_label: string | null;
  associated_url: string | null;
  associated_shield_url: string | null;
  section: string | null;
  headline: string | null;
  location: string | null;
  profile_status: string | null;
  primary_role: string | null;
  specialties: string[];
  summary: string | null;
  ctrugby_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  links: { kind: string; url: string; label?: string | null }[];
  roles: { organization?: string | null; title?: string | null; location?: string | null; start_label?: string | null; end_label?: string | null; source_url?: string | null }[];
  credentials: { title: string; issuer?: string | null; date_label?: string | null }[];
  sources: { source_type: string; source_url: string; source_label?: string | null; captured_at?: string | null; notes?: string | null }[];
};
type AssociatedOption = { kind: "club" | "campus" | "federation"; id: string; name: string; shield_url: string | null };
type StaffRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  milestone_count: number;
  latest_year: number;
  seasons: number[];
  scopes: { scope: string; count: number }[];
  latest_milestone: StaffMilestone | null;
  milestones: StaffMilestone[];
  profile: StaffProfile;
};
type State = { admin: boolean; staff: StaffRow[]; staff_role_categories?: string[]; associated_options?: AssociatedOption[] };

function StaffPlayerLink({ links }: { links: StaffProfile["links"] }) {
  const playerLink = links.find((link) => link.kind === "player" && /^\/jugadores\/JUG\d{4}$/.test(link.url));
  return playerLink
    ? <Link href={playerLink.url} className="player-profile-participation-button mt-3 inline-flex">Ver ficha de jugador</Link>
    : <button type="button" disabled className="player-profile-participation-button mt-3 inline-flex" style={{ cursor: "not-allowed", background: "#e5e7eb", borderColor: "#d1d5db", color: "#6b7280", opacity: 0.6 }} title="Sin ficha de jugador vinculada">Ver ficha de jugador</button>;
}

function StaffSilhouette({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none">
    <circle cx="32" cy="24" r="12" fill="currentColor" opacity=".9" />
    <path d="M13 55c2.8-12 10-18 19-18s16.2 6 19 18" fill="currentColor" opacity=".9" />
  </svg>;
}
function SocialIconLink({ href, type, onOpen }: { href: string | null; type: "linkedin" | "instagram"; onOpen: () => void }) {
  const color = href ? type === "linkedin" ? "text-[#0a66c2]" : "" : "text-neutral-300";
  const label = type === "linkedin" ? "LinkedIn" : "Instagram";
  const icon = type === "linkedin"
    ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor"><path d="M6.94 8.98H3.72V20h3.22V8.98ZM5.33 4a1.86 1.86 0 1 0 0 3.72A1.86 1.86 0 0 0 5.33 4Zm14.95 9.68c0-3.14-1.68-4.6-3.92-4.6a3.37 3.37 0 0 0-3.05 1.68h-.04V8.98h-3.09V20h3.22v-5.45c0-1.44.27-2.83 2.05-2.83 1.75 0 1.78 1.64 1.78 2.92V20h3.22v-6.32h-.17Z" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke={href ? "url(#staff-instagram-gradient)" : "currentColor"} strokeWidth="1.9"><defs><linearGradient id="staff-instagram-gradient" x1="4" x2="20" y1="20" y2="4"><stop stopColor="#feda75" /><stop offset=".25" stopColor="#fa7e1e" /><stop offset=".5" stopColor="#d62976" /><stop offset=".75" stopColor="#962fbf" /><stop offset="1" stopColor="#4f5bd5" /></linearGradient></defs><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17.3" cy="6.7" r=".9" fill={href ? "#d62976" : "currentColor"} stroke="none" /></svg>;
  if (!href) return <span className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-neutral-50 ${color}`} title={`${label} pendiente`} aria-label={`${label} pendiente`}>{icon}</span>;
  return <button type="button" className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white ${color} hover:border-current`} title={`Abrir ${label}`} aria-label={`Abrir ${label}`} onClick={onOpen}>{icon}</button>;
}
function AssociatedShield({ profile, name }: { profile: StaffProfile; name: string }) {
  const content = profile.associated_shield_url
    ? <img src={profile.associated_shield_url} alt={`Escudo asociado de ${name}`} className="image-hover-preview-image" />
    : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-16 w-16 text-neutral-300" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 19 6v5c0 4.6-2.9 8.4-7 10-4.1-1.6-7-5.4-7-10V6Z" /></svg>;
  if (profile.associated_url) return <Link href={profile.associated_url} className="player-profile-cover-club staff-profile-cover-shield image-hover-preview" title={profile.associated_label ?? "Entidad asociada"}>{content}</Link>;
  return <span className="player-profile-cover-club staff-profile-cover-shield image-hover-preview" title={profile.associated_label ?? "Escudo asociado pendiente"}>{content}</span>;
}
const shortSeason = (label: string | null | undefined) => {
  const years = String(label ?? "").match(/20\d{2}/g) ?? [];
  const [start, end] = years;
  if (start && end) return `${start.slice(-2)}/${end.slice(-2)}`;
  if (start) return start.slice(-2);
  return label ?? "-";
};
const fallbackRoleCategories = ["Dirección técnica", "Entrenadores", "Árbitros y especialistas", "Especialistas clínic", "Jugadores formadores"];
const splitDisplayName = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: name, last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1) ?? "" };
};

export default function StaffProfilePage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "").toUpperCase();
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [socialPreview, setSocialPreview] = useState<{ type: "linkedin" | "instagram"; href: string } | null>(null);
  const [editingRoleCategories, setEditingRoleCategories] = useState(false);
  const [roleCategoriesDraft, setRoleCategoriesDraft] = useState<string[]>([]);
  const [editingRoleIndex, setEditingRoleIndex] = useState<number | null>(null);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ first_name: "", last_name: "", section: "", associated_key: "", headline: "", location: "", profile_status: "", primary_role: "", summary: "", linkedin_url: "", instagram_url: "" });
  const [mediaVersion, setMediaVersion] = useState(0);
  const [missingAvatar, setMissingAvatar] = useState(false);
  const [missingCover, setMissingCover] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/staff", { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
      .then((data) => { if (!controller.signal.aborted) setState(data); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se ha podido cargar la ficha de staff."); });
    return () => controller.abort();
  }, []);

  const person = useMemo(() => state?.staff.find((row) => row.id === id) ?? null, [id, state?.staff]);
  const isAdmin = Boolean(state?.admin);
  const linkedPlayer = person?.profile.links.find(link => link.kind === "player" && /^\/jugadores\/JUG\d{4}$/.test(link.url))?.url.split("/").pop();
  const featuredMilestones = person?.milestones.filter((milestone) => milestone.featured) ?? [];
  const visibleMilestones = showAllMilestones || !featuredMilestones.length ? person?.milestones ?? [] : featuredMilestones;
  const roleCategories = state?.staff_role_categories?.length ? state.staff_role_categories : fallbackRoleCategories;
  const associatedOptions = state?.associated_options ?? [];
  const heroName = person ? (person.last_name ? { first: person.first_name, last: person.last_name } : splitDisplayName(person.display_name)) : { first: "", last: "" };
  const mediaQuery = mediaVersion ? `?v=${mediaVersion}` : "";
  const refreshMedia = () => { setMissingAvatar(false); setMissingCover(false); setMediaVersion(Date.now()); };
  useEffect(() => {
    if (!person) return;
    let cancelled = false;
    void fetch(`/api/staff/portada/${person.id}?meta=1&v=${mediaVersion}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ exists?: boolean }> : { exists: false })
      .then((cover) => { if (!cancelled) setMissingCover(!cover.exists); })
      .catch(() => { if (!cancelled) setMissingCover(true); });
    return () => { cancelled = true; };
  }, [mediaVersion, person]);
  const startProfileEdit = () => {
    if (!person) return;
    const nameParts = person.last_name ? { first: person.first_name, last: person.last_name } : splitDisplayName(person.display_name);
    setProfileDraft({
      first_name: nameParts.first,
      last_name: nameParts.last,
      section: person.profile.section ?? "",
      associated_key: person.profile.associated_kind && person.profile.associated_id ? `${person.profile.associated_kind}:${person.profile.associated_id}` : "",
      headline: person.profile.headline ?? "",
      location: person.profile.location ?? "",
      profile_status: person.profile.profile_status ?? "draft",
      primary_role: person.profile.primary_role ?? "",
      summary: person.profile.summary ?? "",
      linkedin_url: person.profile.linkedin_url ?? "",
      instagram_url: person.profile.instagram_url ?? "",
    });
    setNotice("");
    setEditingProfile(true);
  };
  const saveProfile = async () => {
    if (!person) return;
    if (!profileDraft.first_name.trim()) { setNotice("Indica el nombre del miembro del staff."); return; }
    if (profileDraft.instagram_url.trim() && !/^(@[^\s@]+|https?:\/\/\S+)$/i.test(profileDraft.instagram_url.trim())) { setNotice("Instagram debe ser @usuario o una URL."); return; }
    setSaving("profile");
    setNotice("");
    try {
      const [associated_kind, associated_id] = profileDraft.associated_key ? profileDraft.associated_key.split(":") : ["", ""];
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-profile", id: person.id, ...profileDraft, associated_kind, associated_id }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se han podido guardar los datos personales.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setEditingProfile(false);
      setNotice("Datos personales guardados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se han podido guardar los datos personales.");
    } finally {
      setSaving("");
    }
  };
  const setProfileValue = (field: keyof typeof profileDraft, value: string) => setProfileDraft((draft) => ({ ...draft, [field]: value }));
  const startRoleCategoriesEdit = () => {
    setRoleCategoriesDraft(roleCategories);
    setEditingRoleIndex(null);
    setNotice("");
    setEditingRoleCategories(true);
  };
  const saveRoleCategories = async () => {
    const categories = roleCategoriesDraft.map((item) => item.trim()).filter(Boolean);
    if (!categories.length) { setNotice("Añade al menos un rol Rugby."); return; }
    setSaving("role-categories");
    setNotice("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-role-categories", id: "staff-role-categories", categories }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar la tabla de roles.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setEditingRoleCategories(false);
      setEditingRoleIndex(null);
      setNotice("Tabla de rol Rugby guardada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la tabla de roles.");
    } finally {
      setSaving("");
    }
  };
  const toggleFeaturedMilestone = async (milestone: StaffMilestone) => {
    if (!person) return;
    setSaving(`featured-${milestone.id}`);
    setNotice("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-featured-milestone", staff_id: person.id, milestone_id: milestone.id, featured: !milestone.featured }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido actualizar el destacado.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido actualizar el destacado.");
    } finally {
      setSaving("");
    }
  };
  const updateRoleDraft = (index: number, value: string) => setRoleCategoriesDraft((items) => items.map((item, itemIndex) => itemIndex === index ? value : item));
  const removeRoleDraft = (index: number) => setRoleCategoriesDraft((items) => items.filter((_, itemIndex) => itemIndex !== index));
  const addRoleDraft = () => {
    setRoleCategoriesDraft((items) => [...items, "Nuevo rol"]);
    setEditingRoleIndex(roleCategoriesDraft.length);
  };
  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="staff"/></header>
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
      <Link href="/staff" className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:text-red-700">Volver a staff</Link>
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      {!state && !notice && <p className="p-5 text-neutral-500">Cargando ficha...</p>}
      {state && !person && <section className="rounded-2xl bg-white p-8 text-neutral-600 shadow-sm">No se ha encontrado este miembro del staff.</section>}
      {person && <div>
        <section className="player-profile-cover staff-profile-cover">
          <div className="player-profile-cover-copy">
            <p><span className="ctrugby-marker"/><b>Rugby</b><i/>STAFF</p>
            <h1><span>{heroName.first}</span>{heroName.last && <strong>{heroName.last}</strong>}<em>{person.profile.section ?? "Equipo tecnico"}</em></h1>
            <small>{person.id}</small>
            <StaffPlayerLink links={person.profile.links} />
          </div>
          {isAdmin && <StaffMediaActions id={person.id} name={person.display_name} onUpdated={refreshMedia} avatar={false} />}
          <AssociatedShield profile={person.profile} name={person.display_name} />
          {!missingCover && <span className="player-profile-cover-photo"><img src={`/api/staff/portada/${person.id}${mediaQuery}`} alt={`Foto de portada de ${person.display_name}`} onError={() => setMissingCover(true)} /></span>}
          <span className="player-profile-stripes" aria-hidden="true"><b/><b/><b/></span>
        </section>

        <section className="staff-profile-sections">
          <article className="staff-profile-summary rounded-2xl bg-white shadow-sm">
            <h2>Resumen</h2>
            <p>{person.profile.summary ?? "Resumen pendiente de completar."}</p>
          </article>

          <article className="club-record-card player-profile-callups"><PlayerNewsPanel key={linkedPlayer ?? person.id} playerId={linkedPlayer ?? ""} admin={isAdmin} subjectLabel="Noticias del staff" /></article>

          <article className="player-profile-data rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-transparent text-neutral-400 shadow-sm">
                  <StaffSilhouette className="h-8 w-8" />
                  {!missingAvatar && <img src={`/api/staff/foto/${person.id}${mediaQuery}`} alt={`Foto de ${person.display_name}`} className="absolute inset-0 h-full w-full object-cover" onError={() => setMissingAvatar(true)} />}
                </span>
                <h2>Datos personales</h2>
              </div>
              {isAdmin && <div className="flex items-center gap-2">
                <StaffMediaActions id={person.id} name={person.display_name} onUpdated={refreshMedia} cover={false} />
                {!editingProfile && <button type="button" className="player-profile-participation-button player-profile-data-edit" aria-label="Editar datos personales" title="Editar datos personales" onClick={startProfileEdit}><Pencil size={15} aria-hidden="true" /></button>}
              </div>}
            </div>
            {editingProfile ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">Nombre<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.first_name} onChange={(event) => setProfileValue("first_name", event.target.value)} /></label>
              <label className="text-sm font-semibold">Apellidos<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.last_name} onChange={(event) => setProfileValue("last_name", event.target.value)} /></label>
              <label className="text-sm font-semibold">Rol Rugby<select className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" value={profileDraft.section} onChange={(event) => setProfileValue("section", event.target.value)}><option value="">Sin categoria</option>{roleCategories.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
              <label className="text-sm font-semibold">Escudo asociado<select className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-normal" value={profileDraft.associated_key} onChange={(event) => setProfileValue("associated_key", event.target.value)}><option value="">Sin escudo asociado</option><optgroup label="Clubes">{associatedOptions.filter((option) => option.kind === "club").map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.name}</option>)}</optgroup><optgroup label="Campus / academias">{associatedOptions.filter((option) => option.kind === "campus").map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.name}</option>)}</optgroup><optgroup label="Federaciones">{associatedOptions.filter((option) => option.kind === "federation").map((option) => <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>{option.name}</option>)}</optgroup></select></label>
              <label className="text-sm font-semibold sm:col-span-2">Titular<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.headline} onChange={(event) => setProfileValue("headline", event.target.value)} /></label>
              <label className="text-sm font-semibold sm:col-span-2">Rol principal<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.primary_role} onChange={(event) => setProfileValue("primary_role", event.target.value)} /></label>
              <label className="text-sm font-semibold">LinkedIn<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.linkedin_url} onChange={(event) => setProfileValue("linkedin_url", event.target.value)} placeholder="https://www.linkedin.com/in/..." /></label>
              <label className="text-sm font-semibold">Instagram<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.instagram_url} onChange={(event) => setProfileValue("instagram_url", event.target.value)} placeholder="@usuario o URL" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Resumen<textarea className="mt-1 min-h-24 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.summary} onChange={(event) => setProfileValue("summary", event.target.value)} /></label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" className="player-profile-participation-button" disabled={saving === "profile"} onClick={() => void saveProfile()}>{saving === "profile" ? "Guardando..." : "Guardar"}</button>
                <button type="button" className="player-profile-participation-button" disabled={saving === "profile"} onClick={() => setEditingProfile(false)}>Cancelar</button>
              </div>
            </div> : <dl className="staff-profile-data-line">
              <div className="staff-profile-data-name"><dt>Nombre</dt><dd>{person.display_name}</dd></div>
              <div className="staff-profile-data-role"><dt className="flex items-center gap-2">Rol Rugby{isAdmin && <button type="button" className="staff-role-table-edit" aria-label="Editar tabla de rol Rugby" title="Editar tabla de rol Rugby" onClick={startRoleCategoriesEdit}><Pencil size={13} aria-hidden="true" /></button>}</dt><dd>{person.profile.section ?? "Pendiente"}</dd></div>
              <div className="staff-profile-data-associated"><dt>Escudo asociado</dt><dd>{person.profile.associated_label ?? "Pendiente"}</dd></div>
              <div className="staff-profile-data-socials" aria-label="Redes sociales">
                <SocialIconLink href={person.profile.linkedin_url} type="linkedin" onOpen={() => person.profile.linkedin_url && setSocialPreview({ type: "linkedin", href: person.profile.linkedin_url })} />
                <SocialIconLink href={person.profile.instagram_url} type="instagram" onOpen={() => person.profile.instagram_url && setSocialPreview({ type: "instagram", href: person.profile.instagram_url })} />
              </div>
            </dl>}
            {editingRoleCategories && <div className="mt-4 grid gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-center justify-between gap-3"><b className="text-sm">Tabla de rol Rugby</b><button type="button" className="player-profile-participation-button" onClick={addRoleDraft}>+ Añadir rol</button></div>
              <ul className="grid gap-2">{roleCategoriesDraft.map((role, index) => <li key={`${role}-${index}`} className="grid grid-cols-[minmax(0,1fr)_32px_32px] items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
                {editingRoleIndex === index ? <input className="h-9 rounded-lg border border-neutral-300 px-3 text-sm" value={role} autoFocus onChange={(event) => updateRoleDraft(index, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") setEditingRoleIndex(null); }} /> : <span className="truncate text-sm font-bold text-neutral-800">{role || "Rol sin nombre"}</span>}
                <button type="button" className="staff-role-table-edit" aria-label={`Editar rol ${role || index + 1}`} title="Editar rol" onClick={() => setEditingRoleIndex(editingRoleIndex === index ? null : index)}><Pencil size={13} aria-hidden="true" /></button>
                <DeleteButton type="button" className="staff-role-table-delete" aria-label={`Borrar rol ${role || index + 1}`} title="Borrar rol" onClick={() => removeRoleDraft(index)} />
              </li>)}</ul>
              <div className="flex gap-2">
                <button type="button" className="player-profile-participation-button" disabled={saving === "role-categories"} onClick={() => void saveRoleCategories()}>{saving === "role-categories" ? "Guardando..." : "Guardar roles"}</button>
                <button type="button" className="player-profile-participation-button" disabled={saving === "role-categories"} onClick={() => setEditingRoleCategories(false)}>Cancelar</button>
              </div>
            </div>}
          </article>

          <article className="player-profile-history rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2>Palmarés</h2>{person.milestones.length > featuredMilestones.length && <button type="button" className="player-profile-participation-button" onClick={() => setShowAllMilestones((value) => !value)}>{showAllMilestones ? "Ver destacados" : "Ver todos"}</button>}</div>
            <ul>{visibleMilestones.map((milestone) => <li key={milestone.id}><b>{shortSeason(milestone.season_label)}</b>{isAdmin && <button type="button" disabled={saving === `featured-${milestone.id}`} className={milestone.featured ? "staff-feature-star is-featured" : "staff-feature-star"} aria-label={milestone.featured ? "Quitar destacado" : "Marcar destacado"} title={milestone.featured ? "Quitar destacado" : "Marcar destacado"} onClick={() => void toggleFeaturedMilestone(milestone)}><Star size={16} fill={milestone.featured ? "currentColor" : "none"} /></button>}<span><strong>{milestone.category ?? "Sin categoria"}</strong><small>{[milestone.scope, milestone.position_text, milestone.club_text].filter(Boolean).join(" · ") || milestone.id}</small></span><Link href={`/hitos?hito=${encodeURIComponent(milestone.id)}`}>Abrir</Link></li>)}</ul>
            {!person.milestones.length && <p className="text-sm text-neutral-500">Sin hitos vinculados todavía.</p>}
          </article>

          <article className="player-profile-history rounded-2xl bg-white shadow-sm">
            <h2>Trayectoria profesional</h2>
            {person.profile.roles.length ? <ul>{person.profile.roles.map((role, index) => <li key={`${role.organization}-${index}`}><b>{role.start_label ?? "-"}</b><span><strong>{role.title ?? "Titulo pendiente"}</strong><small>{[role.organization, role.location, role.end_label ? `Hasta ${role.end_label}` : null].filter(Boolean).join(" · ") || "Clubes pendiente"}</small></span></li>)}</ul> : <p className="text-sm text-neutral-500">Sin trayectoria profesional registrada.</p>}
          </article>

          <article className="player-profile-history rounded-2xl bg-white shadow-sm">
            <h2>Proyectos actuales</h2>
            <p className="text-sm text-neutral-500">Pendiente de cargar proyectos actuales.</p>
          </article>

          <article className="player-profile-history rounded-2xl bg-white shadow-sm">
            <h2>Frases motivacionales</h2>
            <p className="text-sm text-neutral-500">Pendiente de cargar frases motivacionales.</p>
          </article>
        </section>
        {person.profile.credentials.length > 0 && <article className="player-profile-history mt-4 rounded-2xl bg-white shadow-sm"><h2>Formación y acreditaciones</h2><ul>{person.profile.credentials.map((credential, index) => <li key={index}><span><strong>{credential.title}</strong><small>{credential.issuer}</small></span></li>)}</ul></article>}
        
        {socialPreview && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={`Perfil ${socialPreview.type === "linkedin" ? "LinkedIn" : "Instagram"}`}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.16em] text-neutral-500">{socialPreview.type === "linkedin" ? "LinkedIn" : "Instagram"}</p>
            <h2 className="mt-2 text-xl font-black text-neutral-950">{person.display_name}</h2>
            <p className="mt-3 break-all rounded-xl bg-neutral-50 p-3 text-sm font-semibold text-neutral-700">{socialPreview.href}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="player-profile-participation-button" onClick={() => setSocialPreview(null)}>Volver</button>
              <a href={socialPreview.href} target="_blank" rel="noreferrer" className="player-profile-participation-button">Abrir perfil</a>
            </div>
          </div>
        </div>}
      </div>}
    </div>
  </main>;
}
