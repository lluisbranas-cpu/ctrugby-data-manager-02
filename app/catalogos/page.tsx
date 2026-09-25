"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Club = { id: string; name: string; active: boolean; city: string; country: string; published: boolean; version: number };
type Federation = { id: string; name: string; scope: string; country: string; active: boolean; published: boolean; version: number };
type CatalogState = { configured: boolean; admin: boolean; clubs: Club[]; federations: Federation[]; clubNotes?: string[]; federationNotes?: string[] };
type Kind = "club" | "federation";

export default function CatalogPage() {
  const [state, setState] = useState<CatalogState | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<Kind>("club");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "published">("pending");
  const [menu, setMenu] = useState(false);

  async function load() {
    const response = await fetch("/api/catalogos", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/catalogos", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      }).then((data) => setState(data))
      .catch(() => { if (!controller.signal.aborted) setNotice("No se ha podido cargar el catálogo. Recarga para reintentar."); });
    return () => controller.abort();
  }, []);
  async function send(body: object) {
    const response = await fetch("/api/catalogos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
  }
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true); setNotice("");
    try { await action(); await load(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido completar la operación."); }
    finally { setBusy(false); }
  }
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    event.currentTarget.reset();
    void perform(() => send({ action: "login", email: form.get("email"), password: form.get("password") }), "Sesión de administración iniciada.");
  }
  function importWorkbook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.name) { setNotice("Selecciona una hoja .xlsx antes de importar."); return; }
    void perform(async () => {
      const response = await fetch("/api/catalogos/importar", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(data.issues) && data.issues.length ? ` ${data.issues.slice(0, 3).map((issue: { sheet: string; row: number; field: string; message: string }) => `${issue.sheet}, fila ${issue.row}, ${issue.field}: ${issue.message}`).join(" · ")}` : "";
        throw new Error(`${data.error ?? "No se ha podido importar la hoja."}${detail}`);
      }
      event.currentTarget.reset();
    }, "La hoja se ha importado. Revisa los cambios publicados y pendientes.");
  }
  const entries = useMemo(() => {
    const source = kind === "club" ? state?.clubs ?? [] : state?.federations ?? [];
    const text = query.trim().toLocaleLowerCase("es-ES");
    return source.filter((entry) => {
      const matchesText = !text || [entry.id, entry.name, entry.country].some((value) => value.toLocaleLowerCase("es-ES").includes(text));
      return matchesText && (filter === "all" || (filter === "published" ? entry.published : !entry.published));
    });
  }, [filter, kind, query, state]);
  const privateNotes = new Set(kind === "club" ? state?.clubNotes ?? [] : state?.federationNotes ?? []);
  const input = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-950";
  return <main className="min-h-screen bg-neutral-100 text-neutral-950">
    <header className="relative flex items-center justify-between bg-neutral-950 px-6 py-5 text-white">
      <Link href="/" className="text-2xl font-black">CTRugby <span className="text-red-500">· Catálogos</span></Link>
      <button aria-label="Menú" aria-expanded={menu} aria-controls="catalog-menu" onClick={() => setMenu(!menu)} className="rounded-lg border border-neutral-600 px-4 py-2 text-2xl">{menu ? "×" : "☰"}</button>
      {menu && <nav id="catalog-menu" aria-label="Navegación" className="absolute right-6 top-20 z-10 rounded-xl bg-neutral-900 p-5 shadow-xl"><Link href="/" onClick={() => setMenu(false)}>Portada</Link><br /><Link href="/prueba" onClick={() => setMenu(false)}>Prueba de almacenamiento</Link></nav>}
    </header>
    <div className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-sm font-bold uppercase tracking-widest text-red-700">Fase 5 · Revisión previa a publicar</p>
      <h1 className="mt-2 text-3xl font-black">Clubs y federaciones</h1>
      <p className="mt-3 max-w-3xl text-neutral-600">Los registros importados siguen privados hasta que un administrador los revise. Las notas internas nunca pasan a la vista pública.</p>
      <p role="status" className="my-5 min-h-6 font-medium">{notice}</p>
      {!state && !notice && <p>Cargando catálogo…</p>}
      {state && !state.configured && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h2 className="text-xl font-bold">Pendiente de conectar Supabase</h2><p className="mt-2">La pantalla está lista, pero no encuentra las variables de conexión.</p></section>}
      {state?.configured && <>
        {!state.admin && <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Acceso de administrador</h2><form onSubmit={login} className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"><label>Correo<input name="email" type="email" autoComplete="username" required className={input} /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required className={input} /></label><button disabled={busy} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white">Entrar</button></form></section>}
        {state.admin && <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Importar hoja de catálogo</h2><p className="mt-2 max-w-3xl text-sm text-neutral-600">Edita la plantilla en Excel o Google Sheets, descárgala como archivo .xlsx e impórtala aquí. Se validará antes de guardar; la columna Publicar controla la vista pública.</p><form onSubmit={importWorkbook} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Archivo .xlsx<input name="file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required className="mt-2 block max-w-full text-sm" /></label><button disabled={busy} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white">Importar cambios</button></form></section>}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-xl font-bold">{state.admin ? "Revisar catálogo" : "Vista pública"}</h2><p className="text-sm text-neutral-500">{state.admin ? "Publica cada registro cuando esté revisado." : "Solo se muestran registros publicados."}</p></div>{state.admin && <button disabled={busy} onClick={() => void perform(() => send({ action: "logout" }), "Sesión cerrada. Ahora ves el catálogo público.")} className="underline">Cerrar sesión</button>}</div>
          <div className="mt-6 flex flex-wrap gap-2"><button onClick={() => setKind("club")} className={`rounded-full px-4 py-2 font-semibold ${kind === "club" ? "bg-neutral-950 text-white" : "bg-neutral-100"}`}>Clubs ({state.clubs.length})</button><button onClick={() => setKind("federation")} className={`rounded-full px-4 py-2 font-semibold ${kind === "federation" ? "bg-neutral-950 text-white" : "bg-neutral-100"}`}>Federaciones ({state.federations.length})</button>{state.admin && <><button onClick={() => setFilter("pending")} className={`rounded-full px-4 py-2 ${filter === "pending" ? "bg-red-700 text-white" : "bg-neutral-100"}`}>Pendientes</button><button onClick={() => setFilter("published")} className={`rounded-full px-4 py-2 ${filter === "published" ? "bg-red-700 text-white" : "bg-neutral-100"}`}>Publicados</button><button onClick={() => setFilter("all")} className={`rounded-full px-4 py-2 ${filter === "all" ? "bg-red-700 text-white" : "bg-neutral-100"}`}>Todos</button></>}</div>
          <label className="mt-5 block max-w-xl text-sm font-medium">Buscar por nombre, ID o país<input value={query} onChange={(event) => setQuery(event.target.value)} className={input} /></label>
          <p className="mt-5 text-sm text-neutral-500">{entries.length} resultado{entries.length === 1 ? "" : "s"}</p>
          <ul className="mt-3 divide-y divide-neutral-200">{entries.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div><p className="font-bold">{entry.name}</p><p className="text-sm text-neutral-600">{entry.id} · {kind === "club" ? `${(entry as Club).city}, ${entry.country}` : `${(entry as Federation).scope} · ${entry.country}`}{!entry.active && " · Inactivo"}</p>{state.admin && privateNotes.has(entry.id) && <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-red-700">Nota privada disponible</p>}</div>{state.admin && <button disabled={busy} onClick={() => void perform(() => send({ action: "set-publication", kind, id: entry.id, published: !entry.published, version: entry.version }), entry.published ? `${entry.name} retirado de la vista pública.` : `${entry.name} publicado.`)} className={`rounded-xl px-4 py-2 font-bold ${entry.published ? "bg-neutral-200 text-neutral-900" : "bg-red-700 text-white"}`}>{entry.published ? "Retirar" : "Publicar"}</button>}</li>)}</ul>
          {!entries.length && <p className="py-10 text-center text-neutral-500">No hay registros para este filtro.</p>}
        </section>
      </>}
    </div>
  </main>;
}
