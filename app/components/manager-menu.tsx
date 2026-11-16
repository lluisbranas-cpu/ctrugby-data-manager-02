"use client";

import Link from "@/app/components/sport-link";
import { usePathname, useRouter } from "@/lib/sport-navigation";
import { Fragment, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

type Key = "players" | "federations" | "clubs" | "participations" | "staff" | "milestones" | "sponsorProfiles" | "callupGenerator" | "callupsApp";
type MenuKey = Key | "callupList" | "sponsors" | "sponsorAssignments" | "temporaryClubGroups" | "news" | "titles" | "featuredOrder" | "contact" | "selected" | "professionalClubs" | "professionalCategories" | "campus" | "selectionCallups" | "selectionTable" | "countries" | "staffRoles";
type IconName = "users" | "table" | "lock" | "building" | "shield" | "globe" | "staff" | "trophy" | "mail" | "star";
type CountPair = { ctrugby: number; total: number };
type Counts = Partial<Record<Key | "selected", CountPair>>;

const entries: Array<{ key: Key; label: string; icon: IconName; href: string }> = [
  { key: "players", label: "Jugadores", icon: "users", href: "/jugadores" },
  { key: "clubs", label: "Clubs", icon: "trophy", href: "/clubs" },
  { key: "staff", label: "Staff", icon: "staff", href: "/staff" },
  { key: "sponsorProfiles", label: "Fichas de patrocinadores", icon: "building", href: "/patrocinadores/fichas" },
  { key: "callupGenerator", label: "Generador de convocatorias", icon: "table", href: "/convocatorias/generador" },
];

function MenuIcon({ name }: { name: IconName | "home" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths = {
    table: <><rect {...common} x="3" y="4" width="18" height="16" rx="2" /><path {...common} d="M3 9h18M3 14h18M9 9v11M15 9v11" /></>,
    lock: <><rect {...common} x="5" y="10" width="14" height="11" rx="2" /><path {...common} d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    home: <path {...common} d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" />,
    users: <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3.5 20v-1.5a4.5 4.5 0 0 1 4.5-4.5h2a4.5 4.5 0 0 1 4.5 4.5V20M17 5.5a3 3 0 0 1 0 5.7M20.5 20v-1.5a4.5 4.5 0 0 0-3.2-4.3" /></>,
    building: <path {...common} d="M3 21h18M5 18V9l7-5 7 5v9M8 18v-6M12 18v-6M16 18v-6" />,
    shield: <path {...common} d="M12 3 19 6v5c0 4.6-2.9 8.4-7 10-4.1-1.6-7-5.4-7-10V6Z" />,
    globe: <><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12S9.6 18.5 12 21" /></>,
    staff: <><circle {...common} cx="9" cy="8" r="3" /><path {...common} d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20M17 8h4M19 6v4" /></>,
    trophy: <path {...common} d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v5M8 21h8M9 18h6" />,
    mail: <><path {...common} d="M4 6h16v12H4Z" /><path {...common} d="m4 7 8 6 8-6" /></>,
    star: <path {...common} d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function ManagerMenu({ current, leadingAction }: { current?: MenuKey; leadingAction?: import("react").ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState<Counts>({});
  const [access, setAccess] = useState({ authenticated: false, admin: false, guest: false });
  const menuRef = useRef<HTMLDetailsElement>(null);
  const countsRequest = useRef(false);
  const [countsError, setCountsError] = useState(false);
  const [leavingAdmin, setLeavingAdmin] = useState(false);
  const [exitError, setExitError] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  async function leaveAdmin() {
    setLeavingAdmin(true); setExitError("");
    try {
      const response = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "public-mode" }) });
      if (!response.ok) throw new Error("No se ha podido salir de administración. Vuelve a intentarlo.");
      window.location.replace("/");
    } catch (cause) { setExitError(cause instanceof Error ? cause.message : "No se ha podido salir."); setLeavingAdmin(false); }
  }

  const closeMenu = () => { if (menuRef.current) menuRef.current.open = false; };
  const renderCount = (count?: CountPair) => !count ? "" : <em className="manager-menu-count" title="Rugby / Total"><strong>{count.ctrugby}</strong><span>/</span><small>{count.total}</small></em>;
  const renderSingleCount = (count?: CountPair) => !count ? "" : <em className="manager-menu-count" title="Total"><strong>{count.total}</strong></em>;
  const loadCounts = useCallback(async () => {
    if (countsRequest.current) return;
    countsRequest.current = true;
    try {
      const response = await fetch("/api/menu", { cache: "no-store", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("No se han podido cargar los contadores.");
      const data = await response.json();
      if (!data?.counts?.catalog_players) throw new Error("Contadores no disponibles.");
      setCounts({ players: data.counts.catalog_players, federations: data.counts.catalog_federations, clubs: data.counts.catalog_clubs, participations: data.counts.catalog_participants, staff: data.counts.catalog_staff, milestones: data.counts.catalog_milestones, selected: data.counts.catalog_selected });
      setCountsError(false);
    } catch { setCountsError(true); } finally { countsRequest.current = false; }
  }, []);

  useEffect(() => {
    void fetch("/api/acceso/estado", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setAccess({ authenticated: Boolean(data?.authenticated), admin: Boolean(data?.admin), guest: Boolean(data?.guest) })).catch(() => setAccess({ authenticated: false, admin: false, guest: false }));
  }, [pathname]);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => { if (menuRef.current?.open && event.target instanceof Node && !menuRef.current.contains(event.target)) closeMenu(); };
    const dismissOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeMenu(); };
    document.addEventListener("mousedown", dismiss); document.addEventListener("keydown", dismissOnEscape);
    return () => { document.removeEventListener("mousedown", dismiss); document.removeEventListener("keydown", dismissOnEscape); };
  }, []);

  const item = (key: MenuKey | undefined, href: string, icon: IconName, label: string, count?: ReactNode) => <Link onClick={closeMenu} className={`manager-menu-entry ${current === key ? "active" : ""}`} href={href}><MenuIcon name={icon} /><b>{label}</b>{count}</Link>;
  const group = (id: string, label: string, children: ReactNode) => <section className="manager-menu-group"><button type="button" className="manager-menu-group-toggle" aria-expanded={!collapsedGroups[id]} onClick={() => setCollapsedGroups(groups => ({ ...groups, [id]: !groups[id] }))}><span aria-hidden="true">{collapsedGroups[id] ? "▶" : "▼"}</span>{label}</button>{!collapsedGroups[id] && children}</section>;
  return <div className="manager-header-actions">
    {leadingAction}
    <button type="button" className="manager-history-button" onClick={() => router.back()} aria-label="Volver atrás" title="Atrás">‹</button>
    <button type="button" className="manager-history-button" onClick={() => router.forward()} aria-label="Ir adelante" title="Adelante">›</button>
    <Link className={`manager-access-link ${access.admin ? "admin" : access.authenticated ? "private" : ""}`} href={access.admin ? "/jugadores" : "/login"}><span aria-hidden="true">{access.admin ? "●" : "🔒"}</span><b>{access.admin ? "Administrador" : access.authenticated ? "Privado" : access.guest ? "Público" : "Acceder"}</b></Link>
    {access.admin && <button type="button" className="manager-history-button manager-exit-admin" disabled={leavingAdmin} onClick={() => void leaveAdmin()} title="Salir de administrador">{leavingAdmin ? "…" : "×"}</button>}
    {exitError && <span role="alert" className="text-xs text-red-700">{exitError}</span>}
    <details ref={menuRef} className="manager-menu" onToggle={(event) => { if (event.currentTarget.open) void loadCounts(); }}>
      <summary aria-label="Abrir o cerrar menú"><span className="manager-menu-bars">☰</span><span>Menú</span></summary>
      <nav aria-label="Navegación principal" style={{ maxHeight: "calc(100dvh - 84px)", overflowY: "auto", overscrollBehavior: "contain" }}>
        <button type="button" className="manager-menu-close" onClick={closeMenu} aria-label="Ocultar menú">×</button>
        {countsError && <p role="status">No se han podido actualizar los contadores. <button type="button" onClick={() => void loadCounts()}>Reintentar</button></p>}
        <Link onClick={closeMenu} className="manager-menu-home" href="/jugadores"><MenuIcon name="home" /><b>Inicio</b></Link>
        {item("players", "/jugadores", "users", "Jugadores", renderCount(counts.players))}
        {item("selected", "/jugadores/destacados", "star", "Destacados", renderSingleCount(counts.selected))}
        {group("management", "GESTIÓN", <>{entries.slice(1).filter((entry) => entry.key !== "sponsorProfiles" && entry.key !== "callupGenerator").map((entry) => <Fragment key={entry.key}>{item(entry.key, entry.href, entry.icon, entry.label, renderCount(counts[entry.key]))}</Fragment>)}{item("news", "/noticias", "table", "Noticias, convocatorias y participaciones")}{item("titles", "/titulos", "trophy", "Títulos deportivos")}</>)}
        {group("match_callups", "CONVOCATORIA PARTIDOS", <>{item("callupGenerator", "/convocatorias/generador", "table", "Generador de convocatorias")}{item(undefined, "/convocatorias/categorias", "table", "Categorías deportivas FCR")}{item(undefined, "/convocatorias/competiciones", "table", "Fases y competiciones FCR")}{item(undefined, "/convocatorias/estructura", "table", "Tablas FCR")}</>)}
        {group("sponsorship", "PATROCINIOS", <>{item("sponsorProfiles", "/patrocinadores/fichas", "building", "Fichas de patrocinadores")}{access.admin && <>{item("sponsors", "/patrocinadores", "table", "Patrocinadores")}{item("sponsorAssignments", "/patrocinadores/club-temporada", "table", "Patrocinadores por club y temporada")}</>}</>)}
        {group("federations", "FEDERACIONES", <>{item("federations", "/confederaciones", "shield", "Tabla Confed. Regionales")}{item("federations", "/Federaciones_Nacionales", "globe", "Federaciones Nacionales", renderCount(counts.federations))}</>)}
        {access.admin && group("admin", "ADMIN", <>
          {item("staffRoles", "/staff/roles", "table", "Roles Rugby del staff")}
          {item(undefined, "/clientes", "users", "Clientes y tipos de cliente")}
          {item(undefined, "/administradores", "lock", "Administradores")}
          {item(undefined, "/usuarios", "lock", "Usuarios privados y públicos")}
          {item("selectionTable", "/hitos/selecciones", "table", "Tabla de selecciones")}
          {item("countries", "/paises", "globe", "Tabla de Países y banderas")}
          {item("professionalCategories", "/categorias", "table", "Tabla de categorías")}
          {item("temporaryClubGroups", "/agrupaciones-temporales", "table", "Agrupaciones temporales de clubs")}
          {item("milestones", "/hitos", "table", "Hitos staff")}
          {item("campus", "/campus", "table", "Tabla campus")}
          {item("featuredOrder", "/destacados/orden", "table", "Tabla de orden de destacados")}
        </>)}
        {item("contact", "/contacto", "mail", "Contacto")}
      </nav>
    </details>
  </div>;
}
