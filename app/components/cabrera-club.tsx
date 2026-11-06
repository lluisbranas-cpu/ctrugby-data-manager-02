"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { useMemo, useState } from "react";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import styles from "./cabrera-club.module.css";
import theme from "./cabrera-club-theme.module.css";

type Player = { nickname?: string | null; id: string; first_name: string; last_name: string | null; birth_year?: number | null; position_text: string | null; roster_category?: string; current_club?: boolean; season_year?: number | null; club_seasons?: { season_year: number; position_text: string | null; registration_number?: string | null }[] };
type Props = { players: Player[]; admin: boolean; onManagement: () => void };
const categories = ["Todos", "Sub 6", "Sub 8", "Sub 10", "Sub 12", "Sub 14", "Sub 16", "Sub 18"];
const groups = ["Delanteros", "Tres cuartos", "Posición por confirmar"];
const seasons = Array.from({ length: 10 }, (_, index) => 2018 + index);
const examples = [
  ["Sub 6", "Àlex", "Soler", null], ["Sub 8", "Martina", "Vidal", null],
  ["Sub 10", "Nil", "Roca", null], ["Sub 12", "Júlia", "Serra", null],
  ["Sub 14", "Pol", "Ferrer", "1"], ["Sub 14", "Ona", "Puig", "10"],
  ["Sub 16", "Biel", "Costa", "5"], ["Sub 16", "Mar", "Font", "14"],
  ["Sub 18", "Arnau", "Vila", "8"], ["Sénior", "Pau", "Soler", "12"],
].map(([category, first, last, position], i) => ({ id: `demo-${i}`, first_name: first!, last_name: last, birth_year: undefined, nickname: null, roster_category: category!, position_text: position, demo: true }));
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
export function CabreraClub({ players, admin, onManagement }: Props) {
  const [season, setSeason] = useState<number | null>(null);
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const [demos, setDemos] = useState(false);
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
  const roster = useMemo(() => [...real.map((player) => {
    const seasonEntry = player.club_seasons?.find((entry) => entry.season_year === season);
    return { ...player, position_text: seasonEntry?.position_text ?? player.position_text, roster_category: categoryForSeason(player.birth_year, season ?? player.season_year ?? 2027, player.roster_category), demo: false };
  }), ...(demos ? examples : [])], [real, season, demos]);
  const filtered = roster.filter(p => (category === "Todos" || (p.roster_category || "Por confirmar") === category) && `${p.first_name} ${p.last_name || ""}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  return <main className={`${styles.page} ${theme.redCards} cabrera-public`} style={{ background: "linear-gradient(135deg, #101d42 0%, #172754 47%, #e42636 100%)" }}>
    <div className={styles.utility}><Link href="/clubs">← Clubs · Rugby Hub</Link><button onClick={onManagement}>{admin ? "Gestionar club" : "Ficha del club"} ↗</button></div>
    <header className={styles.header}><a href="#inicio" className={styles.brand}><img src="/clubs/cabrera/logo.png" alt=""/><span>RUGBY<b>CABRERA</b></span></a><nav aria-label="Navegación del club"><a href="#plantilla">Nuestros equipos</a><a href="#club">El club</a><a href="https://rugbycabrera.com/" target="_blank" rel="noreferrer">Web oficial ↗</a></nav><a className={styles.join} href="#club">Únete al equipo <span>↗</span></a></header>
    <section id="inicio" className={styles.hero}><div className={styles.heroText}><p className={styles.eyebrow}><span/> CABRERA DE MAR · RUGBY DE CANTERA</p><h1>Un club.<br/>Una familia.<br/><em>Todo por jugar.</em></h1><p>Del primer pase a la próxima conquista. Conoce a quienes dan vida a nuestros colores, dentro y fuera del campo.</p><a className={styles.primary} href="#plantilla">Descubre nuestros equipos <span>↓</span></a><div className={styles.heroCaption}>PASIÓN · RESPETO · EQUIPO</div></div><div className={styles.heroArt}><div className={theme.methodSeal}><img src="/ctrugby-method-seal.png" alt="CTRugby Method — By Mario Copetti" width={1254} height={1254} /></div><span className={styles.watermark} aria-hidden="true">CABRERA</span><img src="/clubs/cabrera/camiseta.png" alt="Equipación roja y azul de Rugby Cabrera"/><div className={styles.kitLabel}><span>NUESTROS COLORES</span><strong>El orgullo de pertenecer.</strong><i>Rojo en el corazón. Azul en el ADN.</i></div></div></section>
    <div className={styles.ribbon}><span>DE LA ESCUELA AL SÉNIOR</span><span>Un mismo escudo. La misma ilusión.</span><a href="#plantilla">Conoce la plantilla ↓</a></div>
    <section id="plantilla" className={styles.squad} style={{ background: "linear-gradient(120deg, #101d42 0%, #17305d 55%, #e42636 160%)", color: "#fff" }}><div className={styles.sectionTitle}><div><p className={styles.eyebrow}>LAS PERSONAS HACEN EL CLUB</p><h2>Nuestros equipos<span>.</span></h2></div><p style={{ color: "#e6ebf6" }}>Talento que crece. Valores que se quedan.<br/>Encuentra a cada jugador por su categoría.</p></div>
      <div className={styles.seasonMenu}><span>Temporada</span><div className={styles.seasonTabs} role="group" aria-label="Año del equipo"><button aria-pressed={season === null} className={season === null ? styles.activeSeason : ""} onClick={() => { setSeason(null); setCategory("Todos"); }}>TODAS</button>{seasons.map((year) => <button key={year} aria-pressed={season === year} className={season === year ? styles.activeSeason : ""} onClick={() => { setSeason(year); setCategory("Todos"); }}>{year}</button>)}</div></div>
      <div className={`${styles.tabs} ${theme.categoryTabs}`} role="group" aria-label="Categoría del equipo">{categories.map(c => <button key={c} aria-pressed={category === c} className={category === c ? styles.active : ""} onClick={() => setCategory(c)}>{c}</button>)}</div>
      <div className={styles.toolbar}><label className={styles.search}><span aria-hidden="true">⌕</span><input aria-label="Buscar jugador" placeholder="Buscar un jugador…" value={query} onChange={e => setQuery(e.target.value)}/></label><label className={styles.demoToggle}><input type="checkbox" checked={demos} onChange={e => setDemos(e.target.checked)}/> Mostrar perfiles de ejemplo</label><span aria-live="polite">{filtered.length} jugadores</span></div>
      <p className={styles.note} style={{ color: "#e6ebf6" }}>{season === null ? "Plantilla de todas las temporadas." : `Plantilla de la temporada ${season}/${String(season + 1).slice(-2)}.`} Datos vinculados a Rugby; las categorías se calculan de forma orientativa según el año de nacimiento. Los perfiles de ejemplo son ficticios y muestran solo la camiseta.</p>
      {(season === null ? ["Jugadores por orden de registro"] : groups).map((group, index) => { const members = season === null ? filtered : filtered.filter(p => positionGroup(p.position_text) === group); return members.length > 0 && <section className={styles.positionGroup} key={group}><div className={styles.groupTitle} style={{ borderColor: "#ffffff66" }}><h3><small>0{index + 1}</small>{group}</h3><span style={{ color: "#e6ebf6" }}>{members.length} jugadores</span></div><div className={styles.grid}>{members.map(p => <article className={styles.card} key={p.id}><div className={styles.imageArea} style={{ background: "#a2a9b7" }}><span className={styles.categoryBadge}>{p.roster_category || "Por confirmar"}</span><Portrait id={p.id} name={`${p.first_name} ${p.last_name || ""}`} demo={p.demo}/>{p.demo && <span className={styles.exampleBadge}>PERFIL DE EJEMPLO</span>}</div><div className={styles.cardInfo}><p style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span>{rugbyPositionLabel(p.position_text) || "Posición por confirmar"}</span>{p.birth_year && <span>{p.birth_year}</span>}</p><h4><strong>{p.first_name}{p.nickname && <> &quot;{p.nickname}&quot;</>}</strong><br/>{p.last_name}</h4><div className={styles.cardBottom}>{p.demo ? <span>Jugador simulado</span> : <ClubTenure player={p} season={season} number={registrationNumbers.get(p.id) ?? 0} />}{!p.demo && <Link href={`/jugadores/${p.id}`} aria-label={`Ver ficha de ${p.first_name} ${p.last_name || ""}`}>↗</Link>}</div></div></article>)}</div></section>; })}
      {!filtered.length && <div className={styles.empty}><h3>No hay jugadores para esta búsqueda.</h3><p>Prueba otra categoría o cambia el nombre.</p><button onClick={() => { setCategory("Todos"); setQuery(""); }}>Restablecer filtros</button></div>}
    </section>
    <section id="club" className={styles.club}><div><p className={styles.eyebrow}>TU SITIO ESTÁ EN EL CAMPO</p><h2>El próximo pase<br/>puede ser el tuyo.</h2><p>Escuela, cantera y sénior. Ven a conocer Rugby Cabrera y forma parte del equipo.</p><a className={styles.primary} href="https://rugbycabrera.com/#contacto" target="_blank" rel="noreferrer">Contacta con el club ↗</a></div><div className={styles.contact}><strong>RUGBY CABRERA</strong><p>Av. de la Zona Esportiva<br/>08349 Cabrera de Mar, Barcelona</p><a href="tel:+34677456571">+34 677 45 65 71</a><a href="https://rugbycabrera.com/" target="_blank" rel="noreferrer">rugbycabrera.com ↗</a></div></section>
    <footer className={styles.footer}><span>RUGBY CABRERA <b>·</b> MÉS QUE UN EQUIP</span><span>Datos: Rugby · <a href="https://rugbycabrera.com/" target="_blank" rel="noreferrer">Web oficial</a></span></footer>
  </main>;
}

