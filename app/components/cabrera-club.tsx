"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { type CSSProperties, useMemo, useState } from "react";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import styles from "./cabrera-club.module.css";
import theme from "./cabrera-club-theme.module.css";
import { rugbyCabreraWebDefaults, type RugbyCabreraWebConfig } from "@/lib/web-page-config";

type Player = { nickname?: string | null; id: string; first_name: string; last_name: string | null; birth_year?: number | null; position_text: string | null; roster_category?: string; current_club?: boolean; season_year?: number | null; club_seasons?: { season_year: number; position_text: string | null; registration_number?: string | null }[] };
type Props = { players: Player[]; admin: boolean; onManagement: () => void; content?: RugbyCabreraWebConfig; onEditWebsite?: () => void; onEditDesign?: () => void };
const categories = ["Todos", "Sub 6", "Sub 8", "Sub 10", "Sub 12", "Sub 14", "Sub 16", "Sub 18"];
const groups = ["Delanteros", "Tres cuartos", "Posición por confirmar"];
const seasons = Array.from({ length: 10 }, (_, index) => 2018 + index);
function positionGroup(position: string | null) {
  if (!position) return groups[2];
  const codes = position.split(/[.,;/\s]+/).map(Number).filter(n => n > 0 && n <= 15);
  if (codes.length) return codes[0] <= 8 ? groups[0] : groups[1];
  return /pilar|talon|línea|linia|flanker|ocho|davant/i.test(position) ? groups[0] : /cent|ala|apertura|mel|zagu|arrier|obertura/i.test(position) ? groups[1] : groups[2];
}
function categoryForSeason(birthYear: number | null | undefined, season: number, fallback?: string) {
  const age = birthYear ? season - birthYear : null;
  const limit = age !== null && age >= 0 ? [6, 8, 10, 12, 14, 16, 18].find((value) => age < value) : undefined;
  return age === null || age < 0 ? (fallback === "Sub 19" ? "Sub 18" : fallback) || "Por confirmar" : limit ? `Sub ${limit}` : "Sénior";
}
function Portrait({ id, name, demo }: { id: string; name: string; demo?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <img loading="lazy" src={demo || failed ? "/clubs/cabrera/camiseta.png" : `/api/jugadores/foto/${id}?team=ESP0022`} alt={demo || failed ? "Camiseta de Rugby Cabrera" : name} onError={e => { if (!failed && !demo) setFailed(true); else e.currentTarget.onerror = null; }} className={demo || failed ? styles.jersey : styles.portrait} style={demo || failed ? undefined : { objectFit: "cover", objectPosition: "center", transform: "scale(1.35)", background: "#a2a9b7" }} />;
}
function ClubTenure({ player, season, number }: { player: Player; season: number | null; number: number }) {
  const years = [...new Set((player.club_seasons ?? []).map(entry => entry.season_year).filter(year => season === null || year <= season))].sort((a, b) => a - b);
  return <span className={theme.clubTenure} aria-label={`${years.length} temporadas en Rugby Cabrera`} title={`${years.length} temporadas en Rugby Cabrera`}><b>{String(number).padStart(3, "0")}</b><span className={theme.tenureShields} aria-hidden="true">{years.map(year => <img key={year} src="/clubs/cabrera/logo.png" alt="" title={`${year}/${String(year + 1).slice(-2)}`} width={18} height={20} />)}</span></span>;
}
export function CabreraClub({ players, admin, onManagement, content = rugbyCabreraWebDefaults, onEditWebsite, onEditDesign }: Props) {
  const [season, setSeason] = useState<number | null>(null);
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const registeredPlayers = useMemo(() => [...players].sort((a, b) => {
    const firstRegistration = (player: Player) => {
      const entry = [...(player.club_seasons ?? [])].filter(item => item.registration_number && Number.isFinite(Number(item.registration_number))).sort((x, y) => x.season_year - y.season_year)[0];
      return entry ? Number(entry.registration_number) : Number.POSITIVE_INFINITY;
    };
    const difference = firstRegistration(a) - firstRegistration(b);
    return (Number.isFinite(difference) && difference !== 0 ? difference : 0) || a.id.localeCompare(b.id, "es", { numeric: true });
  }), [players]);
  const registrationNumbers = new Map(registeredPlayers.map((player, index) => [player.id, index + 1]));
  const real = registeredPlayers.filter((player) => season === null || (player.club_seasons?.some((entry) => entry.season_year === season) ?? player.current_club !== false));
  const roster = useMemo(() => real.map((player) => {
    const seasonEntry = player.club_seasons?.find((entry) => entry.season_year === season);
    return { ...player, position_text: seasonEntry?.position_text ?? player.position_text, roster_category: categoryForSeason(player.birth_year, season ?? player.season_year ?? 2027, player.roster_category), demo: false };
  }), [real, season]);
  const filtered = roster.filter(p => (category === "Todos" || (p.roster_category || "Por confirmar") === category) && `${p.first_name} ${p.last_name || ""}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  return <main className={`${styles.page} ${theme.redCards} cabrera-public`} style={{ "--navy": content.brand.primary, "--red": content.brand.accent, "--surface": content.brand.secondary, "--heading-font": content.brand.headingFont, "--heading-size": `${content.brand.headingSize}px`, "--subtitle-font": content.brand.subtitleFont, "--subtitle-size": `${content.brand.subtitleSize}px`, "--body-font": content.brand.bodyFont, "--body-size": `${content.brand.bodySize}px`, background: `linear-gradient(135deg, ${content.brand.primary} 0%, #172754 47%, ${content.brand.accent} 100%)` } as CSSProperties}>
    <div className={styles.utility}><Link href="/clubs">← Clubs · Rugby Hub</Link>{admin ? <>{onEditWebsite && <button type="button" className={styles.editWebsite} onClick={onEditWebsite}>Editar web</button>}<span className={styles.adminControls}>{onEditDesign && <button type="button" onClick={onEditDesign}>Diseño y menús</button>}<button type="button" onClick={onManagement}>Gestionar club ↗</button></span></> : <span className={styles.adminControls}><Link href="/acceso?privado=1">Acceso administrador</Link><button type="button" onClick={onManagement}>Ficha del club ↗</button></span>}</div>
    <header className={styles.header}><a href="#inicio" className={styles.brand}><img src={content.brand.logo} alt={`Logotipo de ${content.brand.name}`}/><span>RUGBY<b>{content.brand.name.replace(/^rugby\s+/i, "")}</b></span></a><nav aria-label="Navegación del club">{content.menu.map(item => <a key={`${item.label}-${item.href}`} href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noreferrer" : undefined}>{item.label}</a>)}</nav><a className={styles.join} href="#club">Únete al equipo <span>↗</span></a></header>
    <section id="inicio" className={styles.hero} style={content.layouts.hero === "one" ? { gridTemplateColumns: "1fr" } : undefined}><div className={styles.heroText}><p className={styles.eyebrow}><span/> {content.hero.eyebrow}</p><h1 className="whitespace-pre-line">{content.hero.title}<br/><em>{content.hero.accent}</em></h1><p>{content.hero.description}</p><a className={styles.primary} href="#plantilla">{content.hero.cta} <span>↓</span></a><div className={styles.heroCaption}>{content.hero.caption}</div></div><div className={styles.heroArt}><div className={theme.methodSeal}><img src={content.brand.sealImage} alt="Sello del club" width={1254} height={1254} /></div><span className={styles.watermark} aria-hidden="true">CABRERA</span><img src={content.brand.jerseyImage} alt="Equipación de Rugby Cabrera"/><div className={styles.kitLabel}><span>NUESTROS COLORES</span><strong>El orgullo de pertenecer.</strong><i>Rojo en el corazón. Azul en el ADN.</i></div></div></section>
    <div className={styles.ribbon}><span>DE LA ESCUELA AL SÉNIOR</span><span>Un mismo escudo. La misma ilusión.</span><a href="#plantilla">Conoce la plantilla ↓</a></div>
    <section id="plantilla" className={styles.squad} style={{ background: `linear-gradient(120deg, ${content.brand.primary} 0%, #17305d 55%, ${content.brand.accent} 160%)`, color: "#fff" }}><div className={styles.sectionTitle} style={content.layouts.squad === "one" ? { display: "block" } : undefined}><div><p className={styles.eyebrow}>{content.squad.eyebrow}</p><h2>{content.squad.title}</h2></div><p className="whitespace-pre-line" style={{ color: "#e6ebf6" }}>{content.squad.description}</p></div>
      <div className={styles.seasonMenu}><span>Temporada</span><div className={styles.seasonTabs} role="group" aria-label="Año del equipo"><button aria-pressed={season === null} className={season === null ? styles.activeSeason : ""} onClick={() => { setSeason(null); setCategory("Todos"); }}>TODAS</button>{seasons.map((year) => <button key={year} aria-pressed={season === year} className={season === year ? styles.activeSeason : ""} onClick={() => { setSeason(year); setCategory("Todos"); }}>{year}</button>)}</div></div>
      <div className={`${styles.tabs} ${theme.categoryTabs}`} role="group" aria-label="Categoría del equipo">{categories.map(c => <button key={c} aria-pressed={category === c} className={category === c ? styles.active : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <div className={styles.toolbar}><label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Buscar jugador" placeholder="Buscar un jugador…" value={query} onChange={e => setQuery(e.target.value)}/></label><span aria-live="polite">{filtered.length} jugadores</span></div>
      <p className={styles.note} style={{ color: "#e6ebf6" }}>{season === null ? "Plantilla de todas las temporadas." : `Plantilla de la temporada ${season}/${String(season + 1).slice(-2)}.`} {content.squad.note}</p>
      {(season === null ? ["Jugadores por orden de registro"] : groups).map((group, index) => { const members = season === null ? filtered : filtered.filter(p => positionGroup(p.position_text) === group); return members.length > 0 && <section className={styles.positionGroup} key={group}><div className={styles.groupTitle} style={{ borderColor: "#ffffff66" }}><h3><small>0{index + 1}</small>{group}</h3><span style={{ color: "#e6ebf6" }}>{members.length} jugadores</span></div><div className={styles.grid}>{members.map(p => <article className={styles.card} key={p.id}><div className={styles.imageArea} style={{ background: "#a2a9b7" }}><span className={styles.categoryBadge}>{p.roster_category || "Por confirmar"}</span><Portrait id={p.id} name={`${p.first_name} ${p.last_name || ""}`} demo={p.demo}/>{p.demo && <span className={styles.exampleBadge}>PERFIL DE EJEMPLO</span>}</div><div className={styles.cardInfo}><p style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{rugbyPositionLabel(p.position_text) || "Posición por confirmar"}</span>{p.birth_year && <span>{p.birth_year}</span>}</p><h4><strong>{p.first_name}{p.nickname && <> &quot;{p.nickname}&quot;</>}</strong><br/>{p.last_name}</h4><div className={styles.cardBottom}>{p.demo ? <span>Jugador simulado</span> : <ClubTenure player={p} season={season} number={registrationNumbers.get(p.id) ?? 0} />}{!p.demo && <Link href={`/jugadores/${p.id}`} aria-label={`Ver ficha de ${p.first_name} ${p.last_name || ""}`}>↗</Link>}</div></div></article>)}</div></section>; })}
      {!filtered.length && <div className={styles.empty}><h3>No hay jugadores para esta búsqueda.</h3><p>Prueba otra categoría o cambia el nombre.</p><button onClick={() => { setCategory("Todos"); setQuery(""); }}>Restablecer filtros</button></div>}
    </section>
    <section id="club" className={styles.club} style={content.layouts.contact === "one" ? { flexDirection: "column" } : undefined}><div><p className={styles.eyebrow}>{content.contact.eyebrow}</p><h2 className="whitespace-pre-line">{content.contact.title}</h2><p>{content.contact.description}</p><a className={styles.primary} href="https://rugbycabrera.com/#contacto" target="_blank" rel="noreferrer">{content.contact.cta} ↗</a></div><div className={styles.contact}><strong>RUGBY CABRERA</strong><p className="whitespace-pre-line">{content.contact.address}</p><a href={`tel:${content.contact.phone.replace(/\s/g, "")}`}>{content.contact.phone}</a><a href="https://rugbycabrera.com/" target="_blank" rel="noreferrer">{content.contact.website} ↗</a></div></section>
    <footer className={styles.footer}><span>RUGBY CABRERA <b>·</b> MÉS QUE UN EQUIP</span><span>Datos: Rugby · <a href="https://rugbycabrera.com/" target="_blank" rel="noreferrer">Web oficial</a></span></footer>
  </main>;
}

