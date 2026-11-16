"use client";

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";
import { useEffect, useState } from "react";

type RoleRow = { original: string | null; name: string };
type State = { admin: boolean; staff_role_categories?: string[] };

export default function StaffRolesPage() {
  const [state, setState] = useState<State | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/staff", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as State & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se ha podido cargar la tabla de roles.");
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(data);
        setRoles((data.staff_role_categories ?? []).map((name) => ({ original: name, name })));
      })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se ha podido cargar la tabla de roles."); });
    return () => controller.abort();
  }, []);

  const save = async () => {
    const categories = roles.map((role) => role.name.trim());
    if (categories.some((role) => !role)) { setNotice("Completa el nombre de cada rol."); return; }
    if (!categories.length) { setNotice("Añade al menos un rol Rugby."); return; }
    if (new Set(categories.map((role) => role.toLocaleLowerCase("es-ES"))).size !== categories.length) { setNotice("No se permiten nombres de rol duplicados."); return; }
    const renames = roles.flatMap((role, index) => role.original && role.original !== categories[index] ? [{ from: role.original, to: categories[index] }] : []);
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-role-categories", id: "staff-role-categories", categories, renames }),
      });
      const data = await response.json() as { error?: string; categories?: string[] };
      if (!response.ok || !data.categories) throw new Error(data.error ?? "No se ha podido guardar la tabla de roles.");
      setRoles(data.categories.map((name) => ({ original: name, name })));
      setState((current) => current ? { ...current, staff_role_categories: data.categories } : current);
      setNotice("Tabla de roles guardada.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido guardar la tabla de roles.");
    } finally {
      setSaving(false);
    }
  };

  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="staffRoles"/></header>
    <div className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
      <Link href="/staff" className="mb-4 inline-flex rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:text-red-700">Volver a staff</Link>
      <section className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[.15em] text-red-700">Administración</p><h1 className="mt-1 text-2xl font-black text-neutral-950">Roles Rugby del staff</h1><p className="mt-2 text-sm text-neutral-600">Añade roles o cambia sus nombres. Las asignaciones existentes se conservan al renombrar.</p></div>
          {state?.admin && <button type="button" className="player-profile-participation-button" onClick={() => setRoles((current) => [...current, { original: null, name: "" }])}>+ Añadir rol</button>}
        </div>
        {notice && <p className="catalog-notice mt-4" role="status">{notice}</p>}
        {!state && !notice && <p className="mt-5 text-sm text-neutral-500">Cargando roles…</p>}
        {state && !state.admin && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Se necesita acceso de administrador para editar esta tabla.</p>}
        {state && state.admin && <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead><tr className="border-b border-neutral-200 text-xs uppercase text-neutral-500"><th className="px-3 py-2">Nombre del rol</th><th className="w-24 px-3 py-2">Tipo</th></tr></thead>
              <tbody>{roles.map((role, index) => <tr key={`${role.original ?? "new"}-${index}`} className="border-b border-neutral-100">
                <td className="px-3 py-2"><label className="sr-only" htmlFor={`staff-role-${index}`}>Nombre del rol {index + 1}</label><input id={`staff-role-${index}`} maxLength={120} className="w-full rounded-lg border border-neutral-300 px-3 py-2" value={role.name} onChange={(event) => setRoles((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} /></td>
                <td className="px-3 py-2 text-xs font-bold text-neutral-500">{role.original ? "Existente" : "Nuevo"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => void save()}>{saving ? "Guardando…" : "Guardar cambios"}</button>
            <button type="button" className="player-profile-participation-button" disabled={saving} onClick={() => setRoles((state.staff_role_categories ?? []).map((name) => ({ original: name, name })))}>Cancelar</button>
          </div>
        </>}
      </section>
    </div>
  </main>;
}
