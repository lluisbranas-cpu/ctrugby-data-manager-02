"use client";

import Link from "@/app/components/sport-link";
import { usePathname, useRouter } from "@/lib/sport-navigation";
import { useEffect, useState } from "react";

export function AppNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<{ authenticated: boolean; admin: boolean; guest: boolean }>({ authenticated: false, admin: false, guest: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hidden = /^\/jugadores\/JUG\d{4}\/(noticias|participaciones|convocatorias)$/.test(pathname) || pathname.startsWith("/revision-jugador/") || ["/acceso", "/login", "/invitado", "/invitado/confirmar", "/restablecer"].includes(pathname);
  useEffect(() => { if (hidden) return; void fetch("/api/acceso/estado", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setAccess({ authenticated: Boolean(data.authenticated), admin: Boolean(data.admin), guest: Boolean(data.guest) }); }).catch(() => setAccess({ authenticated: false, admin: false, guest: false })); }, [hidden, pathname]);
  if (hidden) return null;
  const logout = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: access.admin ? "public-mode" : "logout" }) });
      if (!response.ok) throw new Error("No se ha podido cerrar la sesión. Vuelve a intentarlo.");
      window.location.replace(access.admin ? "/" : "/acceso");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido salir."); setBusy(false); }
  };
  return <nav className="app-navigation" aria-label="Navegación rápida">
    <button type="button" onClick={() => router.back()} aria-label="Volver a la pantalla anterior"><span aria-hidden="true">←</span></button>
    <Link href="/" aria-label="Ir al selector de deportes" title="Inicio"><span aria-hidden="true">⌂</span></Link>
    {access.admin ? <><Link className="app-navigation-admin" href="/catalogos" aria-label="Administración activa" title="Administración activa"><span aria-hidden="true">●</span><b>Admin</b></Link><button type="button" className="app-navigation-logout" onClick={() => void logout()} disabled={busy} aria-label="Salir de administración y pasar a modo público" title="Pasar a modo público">X</button></> : <><Link className={access.authenticated ? "app-navigation-private" : undefined} href="/login" aria-label={access.authenticated ? "Acceso privado activo" : "Abrir acceso privado"} title={access.authenticated ? "Acceso privado activo" : "Acceso privado"}><span aria-hidden="true">{access.authenticated ? "●" : "🔒"}</span></Link>{(access.authenticated || access.guest) && <><span className="text-xs font-bold">{access.guest ? "Público" : "Privado"}</span><button type="button" className="app-navigation-logout" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">X</button></>}</>}
    {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
  </nav>;
}
