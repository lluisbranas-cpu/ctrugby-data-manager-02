"use client";
/* eslint-disable @next/next/no-img-element */

import { DeleteButton } from "@/app/components/delete-button";
import Image from "next/image";
import Link from "@/app/components/sport-link";
import { Check, Pencil, Save, Star, X } from "lucide-react";
import { useParams } from "@/lib/sport-navigation";
import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { PlayerNewsPanel } from "@/app/jugadores/[id]/player-news";
import { StaffMediaActions } from "./staff-media-actions";
import { countryFlagCode, countryFlagEmoji } from "@/app/lib/country-flag";
import { regionalFlagUrl } from "@/app/lib/regional-flag";
import { SearchablePicker } from "@/app/components/club-picker";
import { CountryPicker } from "@/app/components/country-picker";
import { StaffTitles } from "@/app/titulos/staff-titles";
import { StaffCredentialsEditor } from "./credentials-editor";

type StaffMilestone = { id: string; scope: string | null; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null; featured?: boolean };
type StaffProfile = {
  nickname: string | null;
  associated_kind: string | null;
  associated_id: string | null;
  associated_label: string | null;
  associated_url: string | null;
  associated_shield_url: string | null;
  custom_associated_shield_url: string | null;
  nationality_country: string | null;
  secondary_nationality_country: string | null;
  section: string | null;
  selected_roles: string[];
  headline: string | null;
  location: string | null;
  profile_status: string | null;
  primary_role: string | null;
  specialties: string[];
  summary: string | null;
  professional_trajectory: string | null;
  technical_staff_experience: string | null;
  ctrugby_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  links: { kind: string; url: string; label?: string | null }[];
  roles: { organization?: string | null; title?: string | null; location?: string | null; start_label?: string | null; end_label?: string | null; source_url?: string | null }[];
  credentials: { title: string; issuer?: string | null; date_label?: string | null }[];
  sources: { source_type: string; source_url: string; source_label?: string | null; captured_at?: string | null; notes?: string | null }[];
  campus_participations: { campus_id: string; year: number }[];
  motivational_phrases?: MotivationalPhrase[];
};
type MotivationalPhrase = { id: string; text: string };
type AssociatedOption = { kind: "club" | "campus" | "federation"; id: string; name: string; shield_url: string | null };
type StaffPrivateData = { staff_id: string; email: string | null; phone: string | null };
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
  private_data: StaffPrivateData | null;
};
type State = { admin: boolean; staff: StaffRow[]; staff_role_categories?: string[]; associated_options?: AssociatedOption[] };

function StaffPlayerLink({ links }: { links: StaffProfile["links"] }) {
  const playerLink = links.find((link) => link.kind === "player" && /^\/jugadores\/JUG\d{4}$/.test(link.url));
  return playerLink
    ? <Link href={playerLink.url} className="player-profile-participation-button mt-3 inline-flex">Ver ficha de jugador</Link>
    : <button type="button" disabled className="player-profile-participation-button mt-3 inline-flex" style={{ cursor: "not-allowed", background: "#e5e7eb", borderColor: "#d1d5db", color: "#6b7280", opacity: 0.6 }} title="Sin ficha de jugador vinculada">Ver ficha de jugador</button>;
}
function StaffCoverNationalities({ primary, secondary }: { primary: string | null; secondary: string | null }) {
  const countries = [primary, secondary].filter((country): country is string => Boolean(country));
  if (!countries.length) return null;
  return <div className="staff-cover-nationalities" aria-label={`Nacionalidad: ${countries.join(", ")}`}>{countries.map((country) => {
    const code = countryFlagCode(country);
    const src = code ? `https://flagcdn.com/w80/${code}.png` : regionalFlagUrl(country);
    return src ? <img key={country} src={src} alt={`Bandera de ${country}`} title={country} /> : null;
  })}</div>;
}

function StaffSilhouette({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 64 64" aria-hidden="true" className={className} fill="none">
    <circle cx="32" cy="24" r="12" fill="currentColor" opacity=".9" />
    <path d="M13 55c2.8-12 10-18 19-18s16.2 6 19 18" fill="currentColor" opacity=".9" />
  </svg>;
}
function SocialIconLink({ href, type, onOpen }: { href: string | null; type: "linkedin" | "instagram" | "facebook"; onOpen: () => void }) {
  const color = href ? type === "linkedin" ? "text-[#0a66c2]" : type === "facebook" ? "text-[#1877f2]" : "" : "text-neutral-300";
  const label = type === "linkedin" ? "LinkedIn" : type === "facebook" ? "Facebook" : "Instagram";
  const icon = type === "linkedin"
    ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor"><path d="M6.94 8.98H3.72V20h3.22V8.98ZM5.33 4a1.86 1.86 0 1 0 0 3.72A1.86 1.86 0 0 0 5.33 4Zm14.95 9.68c0-3.14-1.68-4.6-3.92-4.6a3.37 3.37 0 0 0-3.05 1.68h-.04V8.98h-3.09V20h3.22v-5.45c0-1.44.27-2.83 2.05-2.83 1.75 0 1.78 1.64 1.78 2.92V20h3.22v-6.32h-.17Z" /></svg>
    : type === "facebook" ? <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="currentColor"><path d="M13.7 21v-8h2.7l.4-3h-3.1V8.1c0-.87.25-1.46 1.5-1.46H16.8V3.96c-.28-.04-1.22-.12-2.32-.12-2.3 0-3.87 1.4-3.87 3.98V10H8v3h2.61v8h3.09Z" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px]" fill="none" stroke={href ? "url(#staff-instagram-gradient)" : "currentColor"} strokeWidth="1.9"><defs><linearGradient id="staff-instagram-gradient" x1="4" x2="20" y1="20" y2="4"><stop stopColor="#feda75" /><stop offset=".25" stopColor="#fa7e1e" /><stop offset=".5" stopColor="#d62976" /><stop offset=".75" stopColor="#962fbf" /><stop offset="1" stopColor="#4f5bd5" /></linearGradient></defs><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /><circle cx="17.3" cy="6.7" r=".9" fill={href ? "#d62976" : "currentColor"} stroke="none" /></svg>;
  if (!href) return <span className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-neutral-50 ${color}`} title={`${label} pendiente`} aria-label={`${label} pendiente`}>{icon}</span>;
  return <button type="button" className={`inline-grid h-8 w-8 place-items-center rounded-full border border-neutral-200 bg-white ${color} hover:border-current`} title={`Abrir ${label}`} aria-label={`Abrir ${label}`} onClick={onOpen}>{icon}</button>;
}
function AssociatedShield({ profile, name }: { profile: StaffProfile; name: string }) {
  const [customMissing, setCustomMissing] = useState(false);
  const shieldUrl = !customMissing && profile.custom_associated_shield_url ? profile.custom_associated_shield_url : profile.associated_shield_url;
  const content = shieldUrl
    ? <img src={shieldUrl} alt={`Escudo asociado de ${name}`} className="image-hover-preview-image" onError={() => setCustomMissing(true)} />
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

function summaryInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function richClipboardToMarkdown(html: string) {
  const source = new DOMParser().parseFromString(html, "text/html");
  const inline = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    const text = Array.from(node.childNodes).map(inline).join("");
    if (["STRONG", "B"].includes(node.tagName)) return text.trim() ? `**${text.trim()}**` : "";
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      return /^https?:\/\//i.test(href) && text.trim() ? `[${text.trim()}](${href})` : text;
    }
    if (node.tagName === "BR") return "\n";
    return text;
  };
  const block = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";
    if (["UL", "OL"].includes(node.tagName)) return Array.from(node.children).filter((child) => child.tagName === "LI").map((item, index) => `${node.tagName === "OL" ? `${index + 1}.` : "-"} ${inline(item).trim()}`).join("\n") + "\n\n";
    if (node.tagName === "BLOCKQUOTE") return inline(node).trim().split("\n").map((line) => `> ${line}`).join("\n") + "\n\n";
    const text = inline(node).trim();
    return ["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6"].includes(node.tagName) ? (text ? `${text}\n\n` : "") : text;
  };
  return Array.from(source.body.childNodes).map(block).join("").replace(/\n{3,}/g, "\n\n").trim();
}

function insertSummaryPaste(event: ClipboardEvent<HTMLTextAreaElement>, value: string, onChange: (value: string) => void) {
  const html = event.clipboardData.getData("text/html");
  if (!html) return;
  const pasted = richClipboardToMarkdown(html);
  if (!pasted) return;
  event.preventDefault();
  const { selectionStart, selectionEnd } = event.currentTarget;
  onChange(`${value.slice(0, selectionStart)}${pasted}${value.slice(selectionEnd)}`);
}

function StaffSummary({ summary }: { summary: string | null }) {
  if (!summary?.trim()) return <p>Resumen pendiente de completar.</p>;
  const normalizedSummary = summary.replace(/\r\n?/g, "\n").trim();
  const blocks = normalizedSummary.split(/(\n[\t ]*\n)/);
  return <div className="staff-summary-markdown">{blocks.map((block, index) => {
    if (/^\n[\t ]*\n$/.test(block)) return <span key={index} className="staff-summary-break" aria-hidden="true" />;
    const lines = block.split("\n");
    if (lines.every((line) => /^(?:[-*•]|\d+\.)\s+/.test(line))) return <ul key={index}>{lines.map((line, item) => <li key={item}>{summaryInline(line.replace(/^(?:[-*•]|\d+\.)\s+/, ""))}</li>)}</ul>;
    if (lines.every((line) => /^>\s?/.test(line))) return <blockquote key={index}>{lines.map((line, item) => <Fragment key={item}>{summaryInline(line.replace(/^>\s?/, ""))}{item < lines.length - 1 && <br />}</Fragment>)}</blockquote>;
    return <p key={index}>{lines.map((line, item) => <Fragment key={item}>{summaryInline(line)}{item < lines.length - 1 && <br />}</Fragment>)}</p>;
  })}</div>;
}

type EditableTextField = "summary" | "professional_trajectory" | "technical_staff_experience";
function markdownToEditorHtml(markdown: string | null) {
  const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (text: string) => escape(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const blocks = String(markdown ?? "").replace(/\r\n?/g, "\n").trim().split(/\n\s*\n/).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.every((line) => /^[-*•]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
    return `<p>${lines.map(inline).join("<br>")}</p>`;
  }).join("") || "<p><br></p>";
}
function StaffTextBlock({ title, field, value, admin, onSave }: { title: string; field: EditableTextField; value: string | null; admin: boolean; onSave: (field: EditableTextField, value: string) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(() => markdownToEditorHtml(value));
  const editor = useRef<HTMLDivElement>(null);
  const format = (command: "bold" | "insertUnorderedList") => { editor.current?.focus(); document.execCommand(command); setDraftHtml(editor.current?.innerHTML ?? ""); };
  const addLink = () => {
    const url = window.prompt("URL del enlace (https://…)");
    if (!url || !/^https?:\/\/\S+$/i.test(url)) return;
    editor.current?.focus(); document.execCommand("createLink", false, url); setDraftHtml(editor.current?.innerHTML ?? "");
  };
  const begin = () => { setDraftHtml(markdownToEditorHtml(value)); setEditing(true); };
  return <article className="staff-profile-summary rounded-2xl bg-white shadow-sm"><h2 className="flex items-center justify-between gap-2"><span>{title}</span>{admin && !editing && <button type="button" className="staff-role-table-edit" title={`Editar ${title.toLowerCase()}`} aria-label={`Editar ${title.toLowerCase()}`} onClick={begin}><Pencil size={13}/></button>}</h2>{editing ? <div className="staff-text-editor"><div className="staff-text-editor-tools" aria-label="Herramientas de formato"><button type="button" title="Negrita" aria-label="Negrita" onMouseDown={(event) => event.preventDefault()} onClick={() => format("bold")}>B</button><button type="button" title="Añadir viñeta" aria-label="Añadir viñeta" onMouseDown={(event) => event.preventDefault()} onClick={() => format("insertUnorderedList")}>•</button><button type="button" title="Añadir enlace" aria-label="Añadir enlace" onMouseDown={(event) => event.preventDefault()} onClick={addLink}>↗</button><span/><button type="button" title="Guardar" aria-label="Guardar" className="staff-text-editor-save" onClick={() => void onSave(field, richClipboardToMarkdown(editor.current?.innerHTML ?? draftHtml)).then((saved) => { if (saved) setEditing(false); })}>💾</button><button type="button" title="Cancelar" aria-label="Cancelar" onClick={() => { setDraftHtml(markdownToEditorHtml(value)); setEditing(false); }}>×</button></div><div ref={editor} className="staff-text-editor-content" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: draftHtml }} role="textbox" aria-multiline="true" aria-label={`Editor de ${title.toLowerCase()}`} /></div> : <StaffSummary summary={value} />}</article>;
}

type ParticipationDraft = { campus_id: string; year: string };
function StaffParticipationsBlock({ participations, campuses, admin, saving, onSave }: { participations: StaffProfile["campus_participations"]; campuses: AssociatedOption[]; admin: boolean; saving: boolean; onSave: (items: { campus_id: string; year: number }[]) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ParticipationDraft[]>([]);
  const campusName = (id: string) => campuses.find((campus) => campus.id === id)?.name ?? id;
  const begin = () => {
    setDraft(participations.map((item) => ({ campus_id: item.campus_id, year: String(item.year) })));
    setEditing(true);
  };
  const updateRow = (index: number, patch: Partial<ParticipationDraft>) => setDraft((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const addRow = () => setDraft((items) => [...items, { campus_id: campuses[0]?.id ?? "", year: "" }]);
  return <article className="staff-profile-summary rounded-2xl bg-white shadow-sm">
    <h2 className="flex items-center justify-between gap-2"><span>Participaciones</span>{admin && !editing && <button type="button" className="staff-role-table-edit" title="Editar participaciones" aria-label="Editar participaciones" onClick={begin}><Pencil size={13} /></button>}</h2>
    {editing ? <>
      {campuses.length === 0 && <p className="mt-3 text-sm text-amber-800">No hay campus configurados para registrar participaciones.</p>}
      <div className="mt-3 grid gap-2">{draft.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[minmax(0,1fr)_120px_36px]">
        <label className="text-xs font-bold text-neutral-600">Campus<select className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-normal text-neutral-900" value={item.campus_id} onChange={(event) => updateRow(index, { campus_id: event.target.value })}><option value="">Selecciona un campus</option>{campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
        <label className="text-xs font-bold text-neutral-600">Año<input type="number" min={1900} max={2100} className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-normal text-neutral-900" value={item.year} onChange={(event) => updateRow(index, { year: event.target.value })} /></label>
        <button type="button" className="staff-role-table-delete self-end" aria-label={`Quitar participación ${index + 1}`} title="Quitar participación" onClick={() => setDraft((items) => items.filter((_, itemIndex) => itemIndex !== index))}><X size={15} aria-hidden="true" /></button>
      </div>)}</div>
      {admin && campuses.length > 0 && <button type="button" className="player-profile-participation-button mt-3" onClick={addRow}>+ Añadir participación</button>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => void onSave(draft.map((item) => ({ campus_id: item.campus_id, year: Number(item.year) }))).then((saved) => { if (saved) setEditing(false); })}>{saving ? "Guardando..." : <><Save size={15} aria-hidden="true" /> Guardar</>}</button>
        <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => setEditing(false)}><X size={15} aria-hidden="true" /> Cancelar</button>
      </div>
    </> : participations.length ? <ul className="mt-3 grid gap-2">{[...participations].sort((a, b) => b.year - a.year || campusName(a.campus_id).localeCompare(campusName(b.campus_id), "es")).map((item) => <li key={`${item.campus_id}:${item.year}`} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-100 px-3 py-2"><span className="font-semibold text-neutral-800">{campusName(item.campus_id)}</span><span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-black text-neutral-700">{item.year}</span></li>)}</ul> : <p className="mt-2 text-neutral-500">Sin participaciones registradas.</p>}
  </article>;
}

export default function StaffProfilePage() {
  const params = useParams<{ id: string }>();
  const id = String(params.id ?? "").toUpperCase();
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPrivateData, setEditingPrivateData] = useState(false);
  const [socialPreview, setSocialPreview] = useState<{ type: "linkedin" | "instagram" | "facebook"; href: string } | null>(null);
  const [phraseDraft, setPhraseDraft] = useState<MotivationalPhrase | { id: null; text: string } | null>(null);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ first_name: "", last_name: "", nickname: "", nationality_country: "", secondary_nationality_country: "", associated_key: "", headline: "", location: "", profile_status: "", primary_role: "", summary: "", professional_trajectory: "", technical_staff_experience: "", linkedin_url: "", instagram_url: "", facebook_url: "" });
  const [selectedRolesDraft, setSelectedRolesDraft] = useState<string[]>([]);
  const [profileDirty, setProfileDirty] = useState(false);
  const [privateDraft, setPrivateDraft] = useState({ email: "", phone: "" });
  const [privateLink, setPrivateLink] = useState("");
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
  const associatedPickerOptions = useMemo(() => associatedOptions.map((option) => ({ id: `${option.kind}:${option.id}`, name: `${option.kind === "club" ? "Club" : option.kind === "campus" ? "Campus" : "Federación"} · ${option.name}` })), [associatedOptions]);
  const heroName = person ? (person.last_name ? { first: person.first_name, last: person.last_name } : splitDisplayName(person.display_name)) : { first: "", last: "" };
  const mediaQuery = mediaVersion ? `?v=${mediaVersion}` : "";
  const refreshMedia = () => { setMissingAvatar(false); setMissingCover(false); setMediaVersion(Date.now()); };
  useEffect(() => {
    if (!isAdmin || !person) return;
    let cancelled = false;
    void fetch(`/api/staff/enlace-privado/${person.id}`, { method: "POST" }).then(async (response) => {
      const data = await response.json() as { url?: string };
      if (response.ok && !cancelled) setPrivateLink(data.url ?? "");
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAdmin, person?.id]);
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
      nickname: person.profile.nickname ?? "",
      nationality_country: person.profile.nationality_country ?? "",
      secondary_nationality_country: person.profile.secondary_nationality_country ?? "",
      associated_key: person.profile.associated_kind && person.profile.associated_id ? `${person.profile.associated_kind}:${person.profile.associated_id}` : "",
      headline: person.profile.headline ?? "",
      location: person.profile.location ?? "",
      profile_status: person.profile.profile_status ?? "draft",
      primary_role: person.profile.primary_role ?? "",
      summary: person.profile.summary ?? "",
      professional_trajectory: person.profile.professional_trajectory ?? "",
      technical_staff_experience: person.profile.technical_staff_experience ?? "",
      linkedin_url: person.profile.linkedin_url ?? "",
      instagram_url: person.profile.instagram_url ?? "",
      facebook_url: person.profile.facebook_url ?? "",
    });
    setSelectedRolesDraft(person.profile.selected_roles);
    setProfileDirty(false);
    setNotice("");
    setEditingProfile(true);
  };
  const saveProfile = async () => {
    if (!person) return;
    if (!profileDraft.first_name.trim()) { setNotice("Indica el nombre del miembro del staff."); return; }
    if (profileDraft.instagram_url.trim() && !/^(@[^\s@]+|https?:\/\/\S+)$/i.test(profileDraft.instagram_url.trim())) { setNotice("Instagram debe ser @usuario o una URL."); return; }
    if (profileDraft.facebook_url.trim() && !/^(@?[^\s@]+|https?:\/\/\S+)$/i.test(profileDraft.facebook_url.trim())) { setNotice("Facebook debe ser un usuario o una URL."); return; }
    const rolesChanged = JSON.stringify([...selectedRolesDraft].sort()) !== JSON.stringify([...person.profile.selected_roles].sort());
    if (!profileDirty && !rolesChanged) { setEditingProfile(false); return; }
    setSaving("profile");
    setNotice("");
    try {
      if (profileDirty) {
        const [associated_kind, associated_id] = profileDraft.associated_key ? profileDraft.associated_key.split(":") : ["", ""];
        const response = await fetch("/api/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update-profile", id: person.id, ...profileDraft, associated_kind, associated_id }),
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se han podido guardar los datos personales.");
      }
      if (rolesChanged) {
        const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-role-assignments", id: person.id, roles: selectedRolesDraft }) });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se han podido guardar los roles Rugby.");
      }
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setEditingProfile(false);
      setProfileDirty(false);
      setNotice("Datos personales guardados.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se han podido guardar los datos personales.");
    } finally {
      setSaving("");
    }
  };
  const setProfileValue = (field: keyof typeof profileDraft, value: string) => { setProfileDirty(true); setProfileDraft((draft) => ({ ...draft, [field]: value })); };
  const saveTextBlock = async (field: EditableTextField, value: string) => {
    if (!person) return false;
    setSaving(`text-${field}`); setNotice("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-text-block", id: person.id, field, value }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar el bloque.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setNotice("Bloque guardado.");
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar el bloque."); return false; }
    finally { setSaving(""); }
  };
  const persistMotivationalPhrases = async (phrases: MotivationalPhrase[], successMessage: string) => {
    if (!person) return false;
    setSaving("motivational-phrases"); setNotice("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-motivational-phrases", id: person.id, phrases }) });
      const data = await response.json() as { error?: string; phrases?: MotivationalPhrase[] };
      if (!response.ok || !data.phrases) throw new Error(data.error ?? "No se han podido guardar las frases.");
      setState((current) => current ? { ...current, staff: current.staff.map((row) => row.id === person.id ? { ...row, profile: { ...row.profile, motivational_phrases: data.phrases } } : row) } : current);
      setPhraseDraft(null);
      setNotice(successMessage);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se han podido guardar las frases.");
      return false;
    } finally {
      setSaving("");
    }
  };
  const saveMotivationalPhrase = async () => {
    if (!person || !phraseDraft) return;
    const text = phraseDraft.text.trim();
    if (!text) { setNotice("Escribe el texto de la frase."); return; }
    if (text.length > 500) { setNotice("La frase no puede superar los 500 caracteres."); return; }
    const current = person.profile.motivational_phrases ?? [];
    const phrases = phraseDraft.id === null
      ? [{ id: crypto.randomUUID(), text }, ...current]
      : current.map((phrase) => phrase.id === phraseDraft.id ? { ...phrase, text } : phrase);
    await persistMotivationalPhrases(phrases, phraseDraft.id === null ? "Frase añadida." : "Frase actualizada.");
  };
  const deleteMotivationalPhrase = async (phraseId: string) => {
    if (!person) return;
    const phrases = (person.profile.motivational_phrases ?? []).filter((phrase) => phrase.id !== phraseId);
    await persistMotivationalPhrases(phrases, "Frase eliminada.");
  };
  const startPrivateDataEdit = () => {
    if (!person) return;
    setPrivateDraft({ email: person.private_data?.email ?? "", phone: person.private_data?.phone ?? "" });
    setNotice("");
    setEditingPrivateData(true);
  };
  const savePrivateData = async () => {
    if (!person) return;
    setSaving("private"); setNotice("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-private", id: person.id, ...privateDraft }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se han podido guardar los datos privados.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setEditingPrivateData(false);
      setNotice("Datos privados guardados.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido guardar los datos privados."); }
    finally { setSaving(""); }
  };
  const saveCampusParticipations = async (participations: { campus_id: string; year: number }[]) => {
    if (!person) return false;
    if (participations.some((item) => !item.campus_id || !Number.isInteger(item.year) || item.year < 1900 || item.year > 2100)) { setNotice("Cada participación debe tener un campus y un año válidos."); return false; }
    if (new Set(participations.map((item) => `${item.campus_id}:${item.year}`)).size !== participations.length) { setNotice("No se puede repetir el mismo campus y año."); return false; }
    setSaving("campus-participations");
    setNotice("");
    try {
      const response = await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update-campus-participations", id: person.id, participations }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se han podido guardar las participaciones.");
      const fresh = await fetch("/api/staff", { cache: "no-store" });
      setState(await fresh.json() as State);
      setNotice("Participaciones guardadas.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se han podido guardar las participaciones.");
      return false;
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
            <StaffPlayerLink links={person.profile.links} />
            <StaffCoverNationalities primary={person.profile.nationality_country} secondary={person.profile.secondary_nationality_country} />
          </div>
          {isAdmin && <StaffMediaActions id={person.id} name={person.display_name} onUpdated={refreshMedia} avatar={false} />}
          <AssociatedShield key={mediaVersion} profile={person.profile} name={person.display_name} />
          {!missingCover && <span className="player-profile-cover-photo"><img src={`/api/staff/portada/${person.id}${mediaQuery}`} alt={`Foto de portada de ${person.display_name}`} onError={() => setMissingCover(true)} /></span>}
          <span className="player-profile-stripes" aria-hidden="true"><b/><b/><b/></span>
        </section>

        <section className="staff-profile-sections">
          <StaffTextBlock title="Resumen" field="summary" value={person.profile.summary} admin={isAdmin} onSave={saveTextBlock} />
          {(person.profile.professional_trajectory || isAdmin) && <StaffTextBlock title="Trayectoria deportiva" field="professional_trajectory" value={person.profile.professional_trajectory} admin={isAdmin} onSave={saveTextBlock} />}
          {(person.profile.technical_staff_experience || isAdmin) && <StaffTextBlock title="Experiencia técnica / staff" field="technical_staff_experience" value={person.profile.technical_staff_experience} admin={isAdmin} onSave={saveTextBlock} />}

          <article className="club-record-card player-profile-callups staff-profile-news"><PlayerNewsPanel key={linkedPlayer ?? person.id} playerId={linkedPlayer ?? person.id} admin={isAdmin} subjectLabel="Noticias del staff" profileUrl={linkedPlayer ? undefined : "/staff/" + encodeURIComponent(person.id)} /><StaffTitles key={person.id} staffId={person.id} /></article>

          <StaffParticipationsBlock participations={person.profile.campus_participations} campuses={associatedOptions.filter((option) => option.kind === "campus")} admin={isAdmin} saving={saving === "campus-participations"} onSave={saveCampusParticipations} />

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
              <label className="text-sm font-semibold">ID staff<input className="mt-1 block w-full rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 font-mono font-normal text-neutral-600" value={person.id} readOnly aria-readonly="true" /></label>
              <label className="text-sm font-semibold">Nombre<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.first_name} onChange={(event) => setProfileValue("first_name", event.target.value)} /></label>
              <label className="text-sm font-semibold">Apellidos<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.last_name} onChange={(event) => setProfileValue("last_name", event.target.value)} /></label>
              <label className="text-sm font-semibold">Apodo<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.nickname} onChange={(event) => setProfileValue("nickname", event.target.value)} /></label>
              <CountryPicker value={profileDraft.nationality_country} onChange={(value) => setProfileValue("nationality_country", value)} className="mt-0 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" />
              <CountryPicker label="Doble nacionalidad" value={profileDraft.secondary_nationality_country} onChange={(value) => setProfileValue("secondary_nationality_country", value)} className="mt-0 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" />
              <fieldset className="rounded-xl border border-neutral-200 p-3 sm:col-span-2"><legend className="px-1 text-sm font-bold text-neutral-800">Rol Rugby</legend><table className="w-full border-collapse text-left text-sm"><thead><tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500"><th className="px-2 py-2">Rol</th><th className="px-2 py-2 text-right">Selección</th></tr></thead><tbody>{roleCategories.map((role) => { const selected = selectedRolesDraft.includes(role); return <tr key={role} className="border-b border-neutral-100"><th scope="row" className="px-2 py-2 font-semibold text-neutral-800">{role}</th><td className="px-2 py-2 text-right"><button type="button" className={`inline-flex min-w-32 items-center justify-center gap-2 rounded-lg border px-3 py-1.5 font-bold ${selected ? "border-green-200 bg-green-50 text-green-700" : "border-neutral-200 bg-white text-neutral-500"}`} aria-pressed={selected} aria-label={`${selected ? "Quitar" : "Añadir"} rol ${role}`} onClick={() => setSelectedRolesDraft((current) => selected ? current.filter((item) => item !== role) : [...current, role])}>{selected ? <><Check size={16} aria-hidden="true" /> Seleccionado</> : <><X size={16} aria-hidden="true" /> No seleccionado</>}</button></td></tr>; })}</tbody></table></fieldset>
              <div className="flex items-end gap-2 sm:col-span-2"><div className="min-w-0 flex-1"><SearchablePicker label="Escudo asociado" options={associatedPickerOptions} value={profileDraft.associated_key} onChange={(value) => setProfileValue("associated_key", value)} inputClass="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" placeholder="Buscar club, campus o federación…" emptyLabel="Sin escudo asociado" /></div><div className="staff-associated-shield-upload"><span>Subir escudo</span><StaffMediaActions id={person.id} name={person.display_name} onUpdated={refreshMedia} avatar={false} cover={false} shield /></div></div>
              <label className="text-sm font-semibold">LinkedIn<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.linkedin_url} onChange={(event) => setProfileValue("linkedin_url", event.target.value)} placeholder="https://www.linkedin.com/in/..." /></label>
              <label className="text-sm font-semibold">Instagram<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.instagram_url} onChange={(event) => setProfileValue("instagram_url", event.target.value)} placeholder="@usuario o URL" /></label>
              <label className="text-sm font-semibold">Facebook<input className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={profileDraft.facebook_url} onChange={(event) => setProfileValue("facebook_url", event.target.value)} placeholder="@usuario o URL" /></label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" className="player-profile-participation-button" disabled={saving === "profile"} onClick={() => void saveProfile()}>{saving === "profile" ? "Guardando..." : "Guardar"}</button>
                <button type="button" className="player-profile-participation-button" disabled={saving === "profile"} onClick={() => setEditingProfile(false)}>Cancelar</button>
              </div>
            </div> : <dl className="staff-profile-data-line">
              <div className="staff-profile-data-name"><dt>Nombre</dt><dd>{person.display_name}{person.profile.nickname && ` · ${person.profile.nickname}`}</dd></div>
              <div className="staff-profile-data-country"><dt>Nacionalidad</dt><dd>{countryFlagEmoji(person.profile.nationality_country) && <span aria-hidden="true">{countryFlagEmoji(person.profile.nationality_country)}</span>}{person.profile.nationality_country ?? "Pendiente"}</dd></div>
              {person.profile.secondary_nationality_country && <div className="staff-profile-data-country"><dt>Doble nacionalidad</dt><dd>{countryFlagEmoji(person.profile.secondary_nationality_country) && <span aria-hidden="true">{countryFlagEmoji(person.profile.secondary_nationality_country)}</span>}{person.profile.secondary_nationality_country}</dd></div>}
              <div><dt>Rol Rugby</dt><dd>{person.profile.selected_roles.length ? person.profile.selected_roles.join(" · ") : "Sin roles asignados"}</dd></div>
              <div className="staff-profile-associated-row"><div className="staff-profile-data-associated"><dt>Escudo asociado</dt><dd><span className="staff-profile-associated-name">{person.profile.associated_label ?? "Pendiente"}</span></dd></div><div className="staff-profile-data-socials" aria-label="Redes sociales"><dt>Redes sociales</dt><dd><SocialIconLink href={person.profile.linkedin_url} type="linkedin" onOpen={() => person.profile.linkedin_url && setSocialPreview({ type: "linkedin", href: person.profile.linkedin_url })} /><SocialIconLink href={person.profile.instagram_url} type="instagram" onOpen={() => person.profile.instagram_url && setSocialPreview({ type: "instagram", href: person.profile.instagram_url })} /><SocialIconLink href={person.profile.facebook_url} type="facebook" onOpen={() => person.profile.facebook_url && setSocialPreview({ type: "facebook", href: person.profile.facebook_url })} /></dd></div></div>
            </dl>}
            <section className="staff-personal-motivational">
              <div className="flex items-center justify-between gap-3"><h3>Frases motivacionales</h3>{isAdmin && !phraseDraft && <button type="button" className="player-profile-participation-button" onClick={() => { setPhraseDraft({ id: null, text: "" }); setNotice(""); }}>+ Añadir frase</button>}</div>
              {phraseDraft?.id === null && <div className="mt-3 grid gap-2 rounded-xl border border-neutral-200 bg-white p-3">
                <label className="text-sm font-semibold">Nueva frase<textarea autoFocus maxLength={500} className="mt-1 block min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={phraseDraft.text} onChange={(event) => setPhraseDraft({ ...phraseDraft, text: event.target.value })} /></label>
                <div className="flex gap-2"><button type="button" className="player-profile-participation-button" disabled={saving === "motivational-phrases"} onClick={() => void saveMotivationalPhrase()}>{saving === "motivational-phrases" ? "Guardando..." : <><Save size={15} aria-hidden="true" /> Guardar</>}</button><button type="button" className="player-profile-participation-button" disabled={saving === "motivational-phrases"} onClick={() => setPhraseDraft(null)}><X size={15} aria-hidden="true" /> Cancelar</button></div>
              </div>}
              {(person.profile.motivational_phrases ?? []).length === 0 && !phraseDraft && <p>Aún no hay frases motivacionales registradas.</p>}
              {(person.profile.motivational_phrases ?? []).length > 0 && <ul className="mt-3 grid gap-2">{person.profile.motivational_phrases!.map((phrase) => <li key={phrase.id} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white p-3">
                {phraseDraft?.id === phrase.id ? <div className="grid w-full gap-2">
                  <label className="text-sm font-semibold">Editar frase<textarea autoFocus maxLength={500} className="mt-1 block min-h-20 w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={phraseDraft.text} onChange={(event) => setPhraseDraft({ ...phraseDraft, text: event.target.value })} /></label>
                  <div className="flex gap-2"><button type="button" className="player-profile-participation-button" disabled={saving === "motivational-phrases"} onClick={() => void saveMotivationalPhrase()}>{saving === "motivational-phrases" ? "Guardando..." : <><Save size={15} aria-hidden="true" /> Guardar</>}</button><button type="button" className="player-profile-participation-button" disabled={saving === "motivational-phrases"} onClick={() => setPhraseDraft(null)}><X size={15} aria-hidden="true" /> Cancelar</button></div>
                </div> : <><Star size={16} className="mt-1 shrink-0 text-red-600" aria-hidden="true" /><p className="min-w-0 flex-1 text-sm font-medium leading-6 text-neutral-800">{phrase.text}</p>{isAdmin && <div className="flex shrink-0 gap-1"><button type="button" className="staff-role-table-edit" aria-label="Editar frase motivacional" title="Editar frase" onClick={() => { setPhraseDraft({ ...phrase }); setNotice(""); }}><Pencil size={13} aria-hidden="true" /></button><DeleteButton type="button" className="staff-role-table-delete" aria-label="Eliminar frase motivacional" title="Eliminar frase" disabled={saving === "motivational-phrases"} onClick={() => void deleteMotivationalPhrase(phrase.id)} /></div>}</>}
              </li>)}</ul>}
            </section>
          </article>
          {isAdmin && <article className="player-profile-data staff-private-data rounded-2xl bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2>Datos privados de staff</h2>{!editingPrivateData && <button type="button" className="player-profile-participation-button player-profile-data-edit" aria-label="Editar datos privados de staff" title="Editar datos privados de staff" onClick={startPrivateDataEdit}><Pencil size={15} aria-hidden="true" /></button>}</div>
            <label className="mt-3 block text-xs font-black uppercase tracking-[.1em] text-neutral-700">URL pública de producción<input readOnly className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs font-normal normal-case tracking-normal text-neutral-700" value={`https://app.ctrugby.net/rugby/likid/staff/${encodeURIComponent(person.id)}`} onFocus={(event) => event.currentTarget.select()} aria-label="URL pública de producción del staff" /></label>
            <label className="mt-3 block text-xs font-black uppercase tracking-[.1em] text-neutral-700">URL privada de edición<input readOnly className="mt-2 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs font-normal normal-case tracking-normal text-neutral-700" value={privateLink} placeholder="Generando enlace privado…" onFocus={(event) => event.currentTarget.select()} /></label>
            {editingPrivateData ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Correo electrónico<input type="email" autoComplete="email" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={privateDraft.email} onChange={(event) => setPrivateDraft((draft) => ({ ...draft, email: event.target.value }))} /></label><label className="text-sm font-semibold">Teléfono<input type="tel" autoComplete="tel" placeholder="+34 XXX XXX XXX" className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 font-normal" value={privateDraft.phone} onChange={(event) => setPrivateDraft((draft) => ({ ...draft, phone: event.target.value }))} /></label><div className="flex gap-2 sm:col-span-2"><button type="button" className="player-profile-participation-button" disabled={saving === "private"} onClick={() => void savePrivateData()}>{saving === "private" ? "Guardando..." : "Guardar"}</button><button type="button" className="player-profile-participation-button" disabled={saving === "private"} onClick={() => setEditingPrivateData(false)}>Cancelar</button></div></div> : <dl className="staff-profile-data-line"><div><dt>Correo electrónico</dt><dd>{person.private_data?.email ?? "—"}</dd></div><div><dt>Teléfono</dt><dd>{person.private_data?.phone ?? "—"}</dd></div></dl>}
          </article>}
        </section>
        <StaffCredentialsEditor key={person.id} staffId={person.id} initialCredentials={person.profile.credentials} admin={isAdmin} />
        
        {socialPreview && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label={`Perfil ${socialPreview.type === "linkedin" ? "LinkedIn" : socialPreview.type === "facebook" ? "Facebook" : "Instagram"}`}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-xs font-black uppercase tracking-[.16em] text-neutral-500">{socialPreview.type === "linkedin" ? "LinkedIn" : socialPreview.type === "facebook" ? "Facebook" : "Instagram"}</p>
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
