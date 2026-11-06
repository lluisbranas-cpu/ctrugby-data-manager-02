import Link from "@/app/components/sport-link";
import { ClubPageClose } from "@/app/components/club-page-close";
import { ManagerMenu } from "@/app/components/manager-menu";
import { readTemporaryClubGroups } from "@/lib/temporary-club-groups";
import styles from "./page.module.css";
import { LaietansRoster } from "./laietans-roster";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rugby Laietans (AT) · Rugby Hub" };

function ClubLogo({ id }: { id: string }) { return <img className={styles.clubLogo} src={`/club-shields/${id}.png`} alt="" width={36} height={36} />; }

const clubs: Record<string, string> = { ESP0010: "Rugby Alella", ESP0023: "Rugby Badalona", ESP0022: "Rugby Cabrera" };

export default async function LaietansPage() {
  const groups = (await readTemporaryClubGroups()).filter(group => group.name.trim().toLocaleLowerCase("es") === "rugby laietans").sort((a, b) => b.season.localeCompare(a.season) || a.category.localeCompare(b.category, "es", { numeric: true }));
  const members = [...new Set(groups.flatMap(group => group.club_ids))];
  return <main className={styles.page}><ClubPageClose />
    <header className={styles.top}><Link href="/clubs">← Clubs · Rugby Hub</Link><ManagerMenu current="clubs" /></header>
    <section className={styles.hero}><p className={styles.eyebrow}>AGRUPACIÓN TEMPORAL</p><h1>Rugby Laietans <span>(AT)</span></h1><p>Un espacio compartido para los equipos de los clubes adscritos.</p><nav aria-label="Navegación de Rugby Laietans"><a href="#jugadores">Jugadores</a><a href="#equipos">Equipos</a><a href="#clubes">Clubes adscritos</a></nav></section>
    <section id="equipos" className={styles.section}><p className={styles.eyebrow}>TEMPORADAS Y CATEGORÍAS</p><h2>Nuestros equipos</h2><div className={styles.grid}>{groups.map(group => <article key={group.id} className={styles.card}><p className={styles.eyebrow}>Temporada {group.season}</p><h3>{group.category}</h3><p>{group.name}</p><ul>{group.club_ids.map(id => <li key={id}><Link href={`/clubs/${id}/equipos`}><span className={styles.clubName}><ClubLogo id={id} />{clubs[id] ?? id}</span><span aria-hidden="true">↗</span></Link></li>)}</ul>{group.club_id && <Link className={styles.action} href={`/clubs/${group.club_id}`}>Ver agrupación →</Link>}</article>)}</div>{!groups.length && <p className={styles.empty}>Todavía no hay equipos registrados para esta agrupación.</p>}</section>
    <LaietansRoster clubs={members.map(id => ({ id, name: clubs[id] ?? id }))} />
    <section id="clubes" className={styles.section}><p className={styles.eyebrow}>LA AGRUPACIÓN</p><h2>Clubes adscritos</h2><div className={styles.members}>{members.map(id => <Link key={id} href={`/clubs/${id}/equipos`}><span className={styles.clubName}><ClubLogo id={id} />{clubs[id] ?? id}</span><span aria-hidden="true">↗</span></Link>)}</div></section>
    <footer className={styles.footer}><b>Rugby Laietans (AT)</b><span>Rugby Hub</span></footer>
  </main>;
}
