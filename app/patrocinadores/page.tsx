"use client";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";
import { prepareClientLogo } from "@/lib/prepare-client-logo";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
export type Sponsor = { id: string; sponsor_code: string; name: string; website: string | null; logo_url: string | null; active: boolean };
export type Assignment = { club_id: string; season_year: number; sponsor_id: string; relationship_type: string; placement: string | null; verification_status: string; notes: string | null; evidence: { url?: string; title?: string }[] };
export type Club = { id: string; name: string };
export type SponsorsData = { sponsors: Sponsor[]; assignments: Assignment[]; clubs: Club[] };
const safeUrl = (url?: string | null) => url && /^https?:\/\//i.test(url) ? url : null;
export function SponsorMark({ sponsor }: { sponsor?: Sponsor }) {
  const name = sponsor?.name || "Patrocinador";
  const logo = safeUrl(sponsor?.logo_url);
  return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white font-black text-neutral-500" title={name}>{logo ? <img src={logo} alt={`Logotipo de ${name}`} className="h-full w-full object-contain p-1" /> : <span aria-hidden="true">{name.slice(0, 2).toUpperCase()}</span>}</span>;
}
function SponsorLogoPicker({ sponsor, disabled, onFile }: { sponsor: Sponsor; disabled: boolean; onFile: (file?: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return <span className="relative inline-flex shrink-0"><button type="button" title={`Cambiar logotipo de ${sponsor.name}`} aria-label={`Cambiar logotipo de ${sponsor.name}`} disabled={disabled} onClick={() => input.current?.click()} className="rounded-lg disabled:opacity-50"><SponsorMark sponsor={sponsor} /><span className="absolute -bottom-1 -right-1 rounded-full border border-neutral-200 bg-white p-1 text-neutral-700"><Camera size={12} aria-hidden="true" /></span></button><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled={disabled} onChange={event => { onFile(event.target.files?.[0]); event.target.value = ""; }} /></span>;
}
function ClubMark({ club }: { club?: Club }) {
  if (!club) return <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 font-black text-neutral-500">?</span>;
  return <img src={`/club-shields/${club.id}.png`} alt={`Escudo de ${club.name}`} className="h-10 w-10 shrink-0 object-contain" onError={event => { event.currentTarget.style.display = "none"; }} />;
}
export default function SponsorsPage({ assignments = false }: { assignments?: boolean }) {
  const [data, setData] = useState<SponsorsData | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [club, setClub] = useState("");
  const [year, setYear] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [uploading, setUploading] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/patrocinadores", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se han podido cargar las tablas.");
      setData(body); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar."); });
    return () => controller.abort();
  }, [attempt]);
  async function saveLogo(sponsor: Sponsor, file?: File) {
    if (!file) return;
    setUploading(sponsor.id); setError("");
    try {
      const logo = await prepareClientLogo(file);
      const response = await fetch("/api/patrocinadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save-logo", id: sponsor.id, logo }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "No se ha podido guardar el logotipo.");
      setAttempt(value => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido guardar el logotipo."); }
    finally { setUploading(""); }
  }
  const title = assignments ? "Patrocinadores por club y temporada" : "Patrocinadores";
  const sponsors = new Map(data?.sponsors.map(row => [row.id, row]));
  const clubs = new Map(data?.clubs.map(row => [row.id, row]));
  const query = search.trim().toLocaleLowerCase("es");
  const sponsorRows = data?.sponsors.filter(row => `${row.sponsor_code} ${row.name} ${row.website ?? ""}`.toLocaleLowerCase("es").includes(query)) ?? [];
  const rows = data?.assignments.filter(row => (!club || row.club_id === club) && (!year || String(row.season_year) === year) && `${sponsors.get(row.sponsor_id)?.sponsor_code ?? ""} ${sponsors.get(row.sponsor_id)?.name ?? ""} ${clubs.get(row.club_id)?.name ?? row.club_id} ${row.relationship_type} ${row.notes ?? ""}`.toLocaleLowerCase("es").includes(query)) ?? [];
  const seasons = [...new Set(data?.assignments.map(row => row.season_year))].sort((a, b) => b - a);
  const season = (value: number) => `${value}/${String(value + 1).slice(-2)}`;
  const cell = "px-4 py-3 text-left align-top border-b border-neutral-200";
  return <main className="min-h-screen bg-neutral-100 p-4 text-neutral-900 sm:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">{title}</h1><ManagerMenu current={assignments ? "sponsorAssignments" : "sponsors"} /></header>
    <nav className="mb-5 flex flex-wrap gap-3" aria-label="Tablas de patrocinadores"><Link className="rounded-lg border bg-white px-4 py-2 font-bold" href="/patrocinadores" aria-current={!assignments ? "page" : undefined}>Patrocinadores</Link><Link className="rounded-lg border bg-white px-4 py-2 font-bold" href="/patrocinadores/club-temporada" aria-current={assignments ? "page" : undefined}>Clubs y temporadas</Link></nav>
    {error ? <div role="alert" className="rounded-lg border bg-white p-4">{error} <button className="underline" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Reintentar</button></div> : !data ? <p role="status">Cargando patrocinadores…</p> : <>
      <div className="mb-4 flex flex-wrap items-center gap-3"><label>Buscar <input className="rounded-lg border bg-white p-2" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o web" /></label>{assignments && <><label>Club <select className="rounded-lg border bg-white p-2" value={club} onChange={event => setClub(event.target.value)}><option value="">Todos</option>{data.clubs.filter(item => data.assignments.some(row => row.club_id === item.id)).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Temporada <select className="rounded-lg border bg-white p-2" value={year} onChange={event => setYear(event.target.value)}><option value="">Todas</option>{seasons.map(value => <option key={value} value={value}>{season(value)}</option>)}</select></label></>}<p role="status">{assignments ? rows.length : sponsorRows.length} registros</p></div>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><caption className="sr-only">{title}</caption><thead className="bg-neutral-200"><tr>{(assignments ? ["Club", "Temporada", "ID", "Patrocinador", "Tipo", "Ubicación", "Verificación", "Notas y fuentes"] : ["ID", "Patrocinador", "Web", "Estado", "Clubs / temporadas"]).map(label => <th scope="col" className={cell} key={label}>{label}</th>)}</tr></thead><tbody>{assignments ? rows.map(row => <tr key={`${row.club_id}-${row.season_year}-${row.sponsor_id}`}><td className={cell}><span className="flex min-w-44 items-center gap-3"><ClubMark club={clubs.get(row.club_id)} /><span>{clubs.get(row.club_id)?.name ?? row.club_id}</span></span></td><td className={cell}>{season(row.season_year)}</td><td className={cell}><code>{sponsors.get(row.sponsor_id)?.sponsor_code ?? "—"}</code></td><td className={cell}><span className="flex min-w-44 items-center gap-3"><SponsorMark sponsor={sponsors.get(row.sponsor_id)} /><span>{sponsors.get(row.sponsor_id)?.name ?? row.sponsor_id}</span></span></td><td className={cell}>{row.relationship_type}</td><td className={cell}>{row.placement || "—"}</td><td className={cell}>{row.verification_status.replaceAll("_", " ")}</td><td className={cell}>{row.notes}{Array.isArray(row.evidence) && row.evidence.map((source, index) => safeUrl(source.url) ? <a className="mt-1 block text-blue-700 underline" key={index} href={safeUrl(source.url)!} target="_blank" rel="noopener noreferrer">{source.title || `Fuente ${index + 1}`}</a> : null)}</td></tr>) : sponsorRows.map(row => <tr key={row.id}><td className={cell}><code>{row.sponsor_code}</code></td><td className={cell}><span className="flex min-w-44 items-center gap-3"><SponsorLogoPicker sponsor={row} disabled={Boolean(uploading)} onFile={file => void saveLogo(row, file)} /><span>{row.name}{uploading === row.id && <small className="ml-2 text-neutral-500">Guardando…</small>}</span></span></td><td className={cell}>{safeUrl(row.website) ? <a className="text-blue-700 underline" href={safeUrl(row.website)!} target="_blank" rel="noopener noreferrer">{row.website}</a> : "—"}</td><td className={cell}>{row.active ? "Activo" : "Inactivo"}</td><td className={cell}>{data.assignments.filter(item => item.sponsor_id === row.id).length}</td></tr>)}{(assignments ? rows.length : sponsorRows.length) === 0 && <tr><td className={cell} colSpan={assignments ? 8 : 5}>No hay registros para estos filtros.</td></tr>}</tbody></table></div>
    </>}
  </div></main>;
}
