"use client";

import Link from "@/app/components/sport-link";
import { DiskIcon, CrossIcon } from "@/app/components/action-icons";
import { FormEvent, useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";

type Administrator = { email: string; phone_e164: string; active: boolean; access_count?: number; last_access_at?: string | null };
export default function AdministratorsPage() {
  const [rows, setRows] = useState<Administrator[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [draft, setDraft] = useState<Administrator>({ email: "", phone_e164: "", active: true });
  const [currentEmail, setCurrentEmail] = useState("");
  const [pendingChange, setPendingChange] = useState<Administrator | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function load() {
    const response = await fetch("/api/administradores", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setAuthorized(false); throw new Error(data.error ?? "No se ha podido cargar la tabla."); }
    setAuthorized(true); setRows(data.administrators ?? []); setCurrentEmail(data.current_email ?? "");
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/administradores", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido cargar la tabla.");
      return data;
    }).then((data) => { setAuthorized(true); setRows(data.administrators ?? []); setCurrentEmail(data.current_email ?? ""); })
      .catch((cause: Error) => { if (!controller.signal.aborted) setNotice(cause.message); });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/administradores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, phone_e164: draft.phone_e164.replace(/[\s().-]/g, "") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido guardar.");
      await load(); setDraft({ email: "", phone_e164: "", active: true }); setNotice("Administrador guardado.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  async function changeStatus(row: Administrator) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/administradores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: row.email, phone_e164: row.phone_e164, active: !row.active }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido cambiar el estado.");
      await load(); setPendingChange(null); setNotice(row.active ? "Administrador dado de baja. Ya no tiene permisos de administración." : "Administrador reactivado.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "No se ha podido cambiar el estado."); }
    finally { setBusy(false); }
  }
  const renderStatus = (row: Administrator) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${row.active ? "border-green-200 bg-green-50 text-green-800" : "border-neutral-200 bg-neutral-100 text-neutral-600"}`}>{row.active ? "Activo" : "Inactivo"}</span>;
  const renderActions = (row: Administrator) => <div className="flex shrink-0 items-center gap-2"><button type="button" disabled={busy} aria-label={`Editar ${row.email}`} title="Editar" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-50" onClick={() => setDraft({ ...row })}><DiskIcon /></button><button type="button" disabled={busy || (row.active && row.email === currentEmail)} aria-label={`${row.active ? "Dar de baja" : "Reactivar"} ${row.email}`} title={row.active && row.email === currentEmail ? "Otro administrador debe dar de baja tu cuenta" : row.active ? "Dar de baja" : "Reactivar"} className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 px-2 font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-neutral-200 disabled:text-neutral-400" onClick={() => setPendingChange(row)}>{row.active ? <CrossIcon /> : "Reactivar"}</button></div>;
  const input = "mt-1 w-full rounded-lg border border-neutral-300 bg-white p-3";
  return <main className="directory-app min-h-screen"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong><span className="sm:hidden">Rugby</span><span className="hidden sm:inline">RUGBY - HUB</span></strong></Link><ManagerMenu /></header><section className="mx-auto w-full max-w-5xl p-4 sm:p-6"><h1 className="text-2xl font-black sm:text-3xl">Administradores</h1><p className="mt-3 text-neutral-600">Cada administrador entra con su correo, contraseña y un código generado por su app autenticadora.</p>{notice && <p role="status" className="my-4 rounded-lg bg-neutral-100 p-3">{notice}</p>}{authorized ? <><form onSubmit={save} className="my-6 grid gap-4 rounded-xl border border-neutral-200 bg-white p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3"><label>Correo<input type="email" required maxLength={254} className={input} value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label><label>Teléfono de contacto<input type="tel" required placeholder="+34 600 111 222" className={input} value={draft.phone_e164} onChange={(e) => setDraft({ ...draft, phone_e164: e.target.value })} /></label><label>Estado<select className={input} value={draft.active ? "active" : "inactive"} onChange={(e) => setDraft({ ...draft, active: e.target.value === "active" })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label><button disabled={busy} className="rounded-lg bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? "Guardando…" : "Guardar administrador"}</button></form><p className="mb-4 text-sm text-neutral-600">El correo debe tener una cuenta confirmada en Rugby. Esta tabla autoriza el acceso; no envía invitaciones ni crea contraseñas. Otro administrador debe desactivar tu acceso. El teléfono se conserva como contacto y no se usa para enviar códigos.</p><p className="mb-4 text-sm text-neutral-600">Las entradas cuentan desde la activación del contador. Recargar la página no suma.</p>{pendingChange && <div role="region" aria-label="Confirmar cambio de administrador" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"><p>¿Quieres {pendingChange.active ? "dar de baja" : "reactivar"} a <strong>{pendingChange.email}</strong>? {pendingChange.active && "Perderá sus permisos incluso si tiene una sesión abierta. El registro se conservará."}</p><div className="mt-3 flex gap-4"><button disabled={busy} type="button" className="rounded bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-60" onClick={() => void changeStatus(pendingChange)}>{busy ? "Guardando…" : pendingChange.active ? "Confirmar baja" : "Confirmar reactivación"}</button><button disabled={busy} type="button" onClick={() => setPendingChange(null)}>Cancelar</button></div></div>}<div className="grid gap-3 lg:hidden">{rows.map(row => <article key={row.email} className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-bold">{row.email}</p><p className="mt-1 text-sm text-neutral-600">{row.phone_e164}</p></div>{renderActions(row)}</div><div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-neutral-100 pt-3 text-xs">{renderStatus(row)}<span>Entradas: <strong>{row.access_count ?? 0}</strong></span><span className="min-w-0 text-neutral-600">Última: {row.last_access_at ? new Date(row.last_access_at).toLocaleString("es-ES") : "Sin entradas registradas"}</span></div></article>)}</div><div className="hidden overflow-x-auto lg:block"><table className="w-full border-collapse bg-white text-left"><thead><tr>{["Correo", "Teléfono de contacto", "Estado", "Entradas", "Última entrada", "Acciones"].map((title, i) => <th key={i} className="border-b p-3">{title}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.email}><td className="border-b p-3">{row.email}</td><td className="border-b p-3">{row.phone_e164}</td><td className="border-b p-3">{renderStatus(row)}</td><td className="border-b p-3">{row.access_count ?? 0}</td><td className="border-b p-3">{row.last_access_at ? new Date(row.last_access_at).toLocaleString("es-ES") : "Sin entradas registradas"}</td><td className="border-b p-3">{renderActions(row)}</td></tr>)}</tbody></table></div></> : <Link className="mt-5 inline-block font-bold text-red-700" href="/acceso">Entrar con correo, contraseña y app autenticadora</Link>}</section></main>;
}
