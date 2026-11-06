"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { useEffect, useState } from "react";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import styles from "./page.module.css";

type Player = { id: string; first_name: string; last_name: string | null; position_text: string | null; birth_year?: number | null; roster_category?: string; clubs: string[] };
type Club = { id: string; name: string };
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export function LaietansRoster({ clubs }: { clubs: Club[] }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [club, setClub] = useState("");
  const [category, setCategory] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const results = await Promise.allSettled(clubs.map(async item => {
        const response = await fetch(`/api/clubs/${item.id}?view=teams`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(item.id);
        const data = await response.json();
        if (!Array.isArray(data.players)) throw new Error(item.id);
        return { club: item.id, players: data.players as Omit<Player, "clubs">[] };
      }));
      if (controller.signal.aborted) return;
      const merged = new Map<string, Player>();
      const errors: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "rejected") { errors.push(clubs[index].name); return; }
        for (const player of result.value.players) {
          const existing = merged.get(player.id);
          if (existing) { if (!existing.clubs.includes(result.value.club)) existing.clubs.push(result.value.club); }
          else merged.set(player.id, { ...player, clubs: [result.value.club] });
        }
      });
      setPlayers([...merged.values()].sort((a, b) => `${a.last_name ?? ""} ${a.first_name}`.localeCompare(`${b.last_name ?? ""} ${b.first_name}`, "es")));
      setFailed(errors);
      setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [clubs, attempt]);
  function playerCategory(player: Player) {
    if (player.roster_category) return player.roster_category;
    if (!player.birth_year) return "Por confirmar";
    const age = new Date().getFullYear() - player.birth_year;
    if (age < 0) return "Por confirmar";
    const limit = [6, 8, 10, 12, 14, 16, 19].find(value => age < value);
    return limit ? `Sub ${limit}` : "Sénior";
  }
  const categories = [...new Set(players.map(playerCategory))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const visible = players.filter(player => (!club || player.clubs.includes(club)) && (!category || playerCategory(player) === category) && normalize(`${player.first_name} ${player.last_name ?? ""}`).includes(normalize(query.trim())));
  return <section id="jugadores" className={styles.section}>
    <p className={styles.eyebrow}>LOS CLUBES, UNA MISMA PLANTILLA</p><h2>Jugadores de Rugby Laietans</h2>
    <p>Todos los jugadores disponibles en las páginas de los clubes asociados, incluidos sus registros históricos. Cada jugador aparece una sola vez.</p>
    <div className={styles.filters}>
      <label>Buscar jugador<input value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre o apellidos…" /></label>
      <label>Club<select value={club} onChange={event => setClub(event.target.value)}><option value="">Todos los clubes</option>{clubs.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Categoría<select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas las categorías</option>{categories.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    {loading ? <p role="status">Cargando jugadores de los clubes asociados…</p> : <p role="status">{visible.length} de {players.length} jugadores</p>}
    {failed.length > 0 && <p role="alert" className={styles.empty}>No se han podido cargar: {failed.join(", ")}. <button type="button" onClick={() => { setLoading(true); setAttempt(value => value + 1); }}>Reintentar</button></p>}
    <div className={styles.playerGrid}>{visible.map(player => <article key={player.id} className={styles.playerCard}>
      <div className={styles.playerBadges}>{player.clubs.map(id => <img key={id} src={`/club-shields/${id}.png`} alt={clubs.find(item => item.id === id)?.name ?? id} width={42} height={42} />)}<span>{playerCategory(player)}</span></div>
      <h3>{player.first_name} {player.last_name}</h3><p>{rugbyPositionLabel(player.position_text) || "Posición por confirmar"}</p>
      <p>{player.clubs.map(id => clubs.find(item => item.id === id)?.name ?? id).join(" · ")}</p>
      <Link href={`/jugadores/${player.id}`}>Ver ficha →</Link>
    </article>)}</div>
    {!loading && !visible.length && <p className={styles.empty}>{failed.length === clubs.length && clubs.length ? "No hay datos disponibles. Reintenta la carga." : "No hay jugadores para estos filtros."}</p>}
    <p className={styles.rosterNote}>Las categorías por edad son orientativas y están pendientes de validación por los clubes.</p>
  </section>;
}
