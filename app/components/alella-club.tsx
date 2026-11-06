"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { useState } from "react";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import styles from "./alella-club.module.css";

export type AlellaPlayer = { id: string; first_name: string; last_name: string | null; nickname?: string | null; birth_year?: number | null; position_text: string | null; season_year?: number | null; club_seasons?: { season_year: number; position_text: string | null }[] };
function categoryFor(player: AlellaPlayer, year: number) {
  if (!player.birth_year || year < player.birth_year) return "Por confirmar";
  const limit = [6, 8, 10, 12, 14, 16, 18].find(age => year - player.birth_year! < age);
  return limit ? `Sub ${limit}` : "Sénior";
}
function Portrait({ player }: { player: AlellaPlayer }) {
  const [failed, setFailed] = useState(false);
  return <img className={failed ? styles.shield : styles.portrait} src={failed ? "/club-shields/ESP0010.png" : `/api/jugadores/foto/${player.id}?team=ESP0010&background=transparent`} alt={failed ? "Escudo de Club Rugby Alella" : `${player.first_name} ${player.last_name ?? ""}`} loading="lazy" onError={() => setFailed(true)} />;
}
export function AlellaClub({ players }: { players: AlellaPlayer[] }) {
  const [season, setSeason] = useState("Todas");
  const [category, setCategory] = useState("Todos");
  const [query, setQuery] = useState("");
  const years = [...new Set(players.flatMap(p => p.club_seasons?.map(s => s.season_year) ?? (p.season_year ? [p.season_year] : [])))].sort((a, b) => b - a);
  const roster = players.filter(p => season === "Todas" || p.club_seasons?.some(s => s.season_year === Number(season))).map(p => ({ ...p, rosterCategory: categoryFor(p, season === "Todas" ? p.season_year ?? new Date().getFullYear() : Number(season)), position_text: p.club_seasons?.find(s => s.season_year === Number(season))?.position_text ?? p.position_text }));
  const categories = [...new Set(roster.map(p => p.rosterCategory))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const filtered = roster.filter(p => (category === "Todos" || p.rosterCategory === category) && normalized(`${p.first_name} ${p.last_name ?? ""} ${p.nickname ?? ""}`).includes(normalized(query.trim()))).sort((a,b) => `${a.last_name ?? ""} ${a.first_name}`.localeCompare(`${b.last_name ?? ""} ${b.first_name}`, "es"));
  return <main className={styles.page}>
    <div className={styles.utility}><Link href="/clubs">← Clubs · Rugby Hub</Link><Link href="/clubs/ESP0010">Ficha del club ↗</Link></div>
    <header className={styles.header}><Link href="/clubs/ESP0010/equipos" className={styles.brand}><img src="/club-shields/ESP0010.png" alt="Escudo de Club Rugby Alella"/><span>Club Rugby<strong> Alella</strong><small>ELS NOSTRES EQUIPS</small></span></Link><nav aria-label="Navegación de Rugby Alella"><a href="#equipos">Equipos</a><a href="#club">El club</a><a href="https://www.clubrugbyalella.com/" target="_blank" rel="noopener noreferrer">Web oficial ↗</a></nav></header>
    <section className={styles.hero}><div><p className={styles.eyebrow}>CLUB RUGBY ALELLA · RUGBY</p><h1>El nostre club.<br/><em>El teu club.</em></h1><p>Conoce a los jugadores que forman parte de la historia de Rugby Alella. Encuentra sus equipos y sigue su trayectoria.</p><a className={styles.button} href="#equipos">Descubre nuestros equipos ↓</a></div><div className={styles.heroShield}><img src="/club-shields/ESP0010.png" alt="Club Rugby Alella"/><span>ALELLA</span></div></section>
    <div className={styles.ribbon}><span>RUGBY · EQUIP · ALELLA</span><span>Verd i groc. Una mateixa passió.</span></div>
    <section id="equipos" className={styles.squad}><p className={styles.eyebrow}>LAS PERSONAS HACEN EL CLUB</p><h2>Nuestros equipos<span>.</span></h2><p className={styles.intro}>Jugadores con temporadas registradas en Club Rugby Alella en Rugby. La vista de todas las temporadas incluye jugadores históricos.</p><div className={styles.filters}><label>Temporada<select value={season} onChange={e => { setSeason(e.target.value); setCategory("Todos"); }}><option>Todas</option>{years.map(year => <option key={year} value={year}>{year}/{String(year + 1).slice(-2)}</option>)}</select></label><label>Categoría<select value={category} onChange={e => setCategory(e.target.value)}><option>Todos</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label><label className={styles.search}>Buscar jugador<input type="search" placeholder="Nombre o apellidos…" value={query} onChange={e => setQuery(e.target.value)}/></label><strong aria-live="polite">{filtered.length} jugadores</strong></div><p className={styles.note}>Categorías orientativas calculadas según el año de nacimiento y la temporada registrada.</p><div className={styles.grid}>{filtered.map(p => <article className={styles.card} key={p.id}><div className={styles.photo}><Portrait player={p}/><span>{p.rosterCategory}</span></div><div className={styles.cardBody}><p>{rugbyPositionLabel(p.position_text) || "Posición por confirmar"}</p><h3>{p.first_name}{p.nickname && <> «{p.nickname}»</>}<br/><strong>{p.last_name}</strong></h3><Link href={`/jugadores/${p.id}`} aria-label={`Ver ficha de ${p.first_name} ${p.last_name ?? ""}`}>Ver ficha <span>↗</span></Link></div></article>)}</div>{!filtered.length && <div className={styles.empty}><h3>No hay jugadores registrados para esta selección.</h3><button onClick={() => { setSeason("Todas"); setCategory("Todos"); setQuery(""); }}>Restablecer filtros</button></div>}</section>
    <section id="club" className={styles.club}><div><p className={styles.eyebrow}>CLUB RUGBY ALELLA</p><h2>El siguiente pase<br/>empieza contigo.</h2><p>Descubre la actualidad, los equipos y cómo contactar con el club en su web oficial.</p><a className={styles.button} href="https://www.clubrugbyalella.com/" target="_blank" rel="noopener noreferrer">Conoce el club ↗</a></div><img src="/club-shields/ESP0010.png" alt="Escudo de Club Rugby Alella"/></section><footer className={styles.footer}><b>CLUB RUGBY ALELLA</b><span>Datos de jugadores · Rugby</span></footer>
  </main>;
}
