"use client";
import Link from "@/app/components/sport-link";
import { useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type Account = { user_id: string; name: string; email: string; phone_e164: string | null; access_kind: "private" | "public"; active: boolean; access_count: number; last_access_at: string | null };
export default function UsersPage() {
  const [users,setUsers] = useState<Account[]>([]);
  const [loaded,setLoaded] = useState(false);
  const [error,setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/usuarios", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se han podido cargar los usuarios.");
      setUsers(data.users ?? []); setLoaded(true);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "No se han podido cargar los usuarios."); });
    return () => controller.abort();
  },[]);
  return <main className="directory-app min-h-screen"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu /></header><section className="mx-auto max-w-6xl p-6"><h1 className="text-3xl font-black">Usuarios privados y públicos</h1><p className="mt-3 text-sm leading-6 text-neutral-600">Cada entrada completada cuenta una vez. Las recargas de página no suman. El contador empieza al activar esta función; no incluye entradas anteriores.</p>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}{loaded && <><div className="mt-6 overflow-x-auto"><table className="w-full border-collapse bg-white text-left text-sm"><thead><tr>{["Nombre o ficha","Correo","Teléfono","Acceso","Estado","Entradas","Última entrada"].map(title=><th key={title} className="border-b p-3">{title}</th>)}</tr></thead><tbody>{users.map(row=><tr key={`${row.user_id}:${row.access_kind}`}><td className="border-b p-3">{row.name}</td><td className="border-b p-3">{row.email}</td><td className="border-b p-3">{row.phone_e164 || "—"}</td><td className="border-b p-3">{row.access_kind === "private" ? "Privado" : "Público"}</td><td className="border-b p-3">{row.active ? "Activo" : "Inactivo"}</td><td className="border-b p-3 font-bold">{row.access_count}</td><td className="border-b p-3">{row.last_access_at ? new Date(row.last_access_at).toLocaleString("es-ES") : "Sin entradas registradas"}</td></tr>)}</tbody></table></div>{!users.length && <p className="mt-4">Todavía no hay cuentas registradas de usuarios privados o públicos.</p>}</>}</section></main>;
}
