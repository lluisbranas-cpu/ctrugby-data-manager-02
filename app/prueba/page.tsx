"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
type Player = { id: string; name: string; season: string; version: number;
  photoUrl: string | null; pilot_clubs: { name: string } };
type State = { configured: boolean; admin: boolean; player?: Player | null; notes?: string };
export default function PilotPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState("Jugador de prueba");
  const [club, setClub] = useState("Club de prueba");
  const [season, setSeason] = useState("2026/2027");
  const [notes, setNotes] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  async function load() {
    const response = await fetch("/api/prueba", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setState(data);
    setName(data.player?.name ?? "Jugador de prueba");
    setClub(data.player?.pilot_clubs?.name ?? "Club de prueba");
    setSeason(data.player?.season ?? "2026/2027");
    setNotes(data.admin ? data.notes ?? "" : "");
  }
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/prueba", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      }).then(data => {
        setState(data); setName(data.player?.name ?? "Jugador de prueba");
        setClub(data.player?.pilot_clubs?.name ?? "Club de prueba");
        setSeason(data.player?.season ?? "2026/2027");
        setNotes(data.admin ? data.notes ?? "" : "");
      }).catch(() => {
        if (!controller.signal.aborted) setNotice("No se ha podido cargar la prueba. Recarga para reintentar.");
      });
    return () => controller.abort();
  }, []);
  async function send(body: object) {
    const response = await fetch("/api/prueba", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
  }
  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true); setNotice("");
    try { await action(); await load(); setNotice(success); }
    catch (error) { setNotice(error instanceof Error ? error.message : "No se pudo completar la operación."); }
    finally { setBusy(false); }
  }
  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    event.currentTarget.reset();
    void perform(() => send({ action: "login", email: form.get("email"), password: form.get("password") }), "Sesión de administrador iniciada.");
  }
  function requestRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void perform(() => send({ action: "recover", email: recoveryEmail }),
      "Si el correo pertenece al usuario de la prueba, recibirás un enlace para crear una contraseña nueva.");
  }
  const input = "mt-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-neutral-950";
  return <main className="min-h-screen bg-neutral-100 text-neutral-950">
    <header className="relative flex items-center justify-between bg-neutral-950 px-6 py-5 text-white">
      <Link href="/" className="text-2xl font-black">CTRugby <span className="text-red-500">· Prueba</span></Link>
      <button aria-label="Menú" aria-expanded={menu} aria-controls="pilot-menu" onClick={() => setMenu(!menu)}
        className="rounded-lg border border-neutral-600 px-4 py-2 text-2xl">{menu ? "×" : "☰"}</button>
      {menu && <nav id="pilot-menu" aria-label="Navegación" className="absolute right-6 top-20 z-10 rounded-xl bg-neutral-900 p-5 shadow-xl"
        onKeyDown={event => { if (event.key === "Escape") setMenu(false); }}>
        <Link href="/" onClick={() => setMenu(false)}>Volver a portada</Link>
      </nav>}
    </header>
    <div className="mx-auto max-w-5xl px-6 py-10">
      <p className="text-sm font-bold uppercase tracking-widest text-red-700">Fase 3 · Datos ficticios</p>
      <h1 className="mt-2 text-3xl font-black">Una ficha. Un club. Una foto.</h1>
      <p className="mt-3 max-w-2xl text-neutral-600">Comprobamos que los cambios se guardan y que la evaluación solo puede verla el administrador.</p>
      <p role="status" className="my-5 min-h-6 font-medium">{notice}</p>
      {!state && !notice && <p>Cargando conexión…</p>}
      {state && !state.configured && <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h2 className="text-xl font-bold">Pendiente de conectar Supabase</h2>
        <p className="mt-2">La pantalla está preparada. Todavía no hay datos guardados ni una sesión de prueba disponible.</p>
      </section>}
      {state?.configured && <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-neutral-500">VISTA PÚBLICA</p>
          {state.player ? <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {state.player.photoUrl ? <img src={state.player.photoUrl} alt="Foto del jugador ficticio" width="300" height="300" className="mx-auto my-6 max-w-full" />
              : <div className="my-6 rounded-xl bg-neutral-100 p-10 text-center text-neutral-500">Foto pendiente</div>}
            <h2 className="text-2xl font-bold">{state.player.name}</h2>
            <p className="mt-2">{state.player.pilot_clubs.name} · {state.player.season}</p>
            <p className="mt-4 text-sm text-neutral-500">{state.player.id} · Guardado en la base de datos</p>
          </> : <p className="mt-5">La ficha ficticia todavía no se ha creado.</p>}
          <button disabled={busy} className="mt-6 underline" onClick={() => void perform(async () => {}, "Datos recargados desde la base.")}>Recargar datos guardados</button>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">{state.admin ? "Administrar prueba" : "Acceso de administrador"}</h2>
          {!state.admin ? <>
            <form onSubmit={login} className="mt-5 space-y-4">
              <label className="block">Correo<input name="email" type="email" autoComplete="username" required className={input} /></label>
              <label className="block">Contraseña<input name="password" type="password" autoComplete="current-password" required className={input} /></label>
              <button disabled={busy} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white">Entrar</button>
            </form>
            <button type="button" className="mt-4 text-sm underline" onClick={() => { setRecovery(!recovery); setNotice(""); }}>
              {recovery ? "Cancelar recuperación" : "He olvidado la contraseña"}
            </button>
            {recovery && <form onSubmit={requestRecovery} className="mt-4 rounded-xl bg-neutral-100 p-4">
              <label className="block text-sm font-medium">Correo del usuario de la prueba
                <input value={recoveryEmail} onChange={event => setRecoveryEmail(event.target.value)} type="email" autoComplete="email" required className={input} />
              </label>
              <button disabled={busy} className="mt-3 rounded-xl bg-neutral-800 px-4 py-2 font-bold text-white">Enviar enlace de recuperación</button>
            </form>}
          </> : <>
            <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); void perform(() => send({
              action: "save", name, club, season, notes, version: state.player?.version ?? 0,
            }), "Ficha, club y evaluación guardados."); }}>
              <label className="block">Jugador ficticio<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={input} /></label>
              <label className="block">Club ficticio<input required maxLength={100} value={club} onChange={e => setClub(e.target.value)} className={input} /></label>
              <label className="block">Temporada<input required pattern="[0-9]{4}/[0-9]{4}" value={season} onChange={e => setSeason(e.target.value)} className={input} /></label>
              <label className="block">Evaluación privada · solo texto ficticio<textarea maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} className={input} /></label>
              <button disabled={busy} className="rounded-xl bg-red-700 px-5 py-3 font-bold text-white">{busy ? "Guardando…" : "Guardar prueba"}</button>
            </form>
            {state.player && <label className="mt-6 block border-t border-neutral-200 pt-5">Publicar foto de prueba
              <span className="mt-1 block text-sm text-neutral-500">PNG, JPG o WebP · hasta 3 MB. Original privado; copia circular pública.</span>
              <input aria-label="Publicar foto de prueba" disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" className="mt-3 max-w-full"
                onChange={event => {
                  const file = event.target.files?.[0]; event.target.value = "";
                  if (!file) return;
                  if (file.size > 3_000_000) { setNotice("Máximo 3 MB por foto de prueba."); return; }
                  void perform(async () => {
                    const form = new FormData(); form.set("file", file); form.set("version", String(state.player!.version));
                    const response = await fetch("/api/prueba/foto", { method: "POST", body: form });
                    const data = await response.json(); if (!response.ok) throw new Error(data.error);
                  }, "Original privado y foto circular guardados.");
                }} />
            </label>}
            <button disabled={busy} className="mt-6 underline" onClick={() => void perform(async () => {
              await send({ action: "logout" }); setNotes(""); setState(null);
            }, "Sesión cerrada. Ahora estás viendo la prueba como visitante.")}>Cerrar sesión y ver como visitante</button>
          </>}
        </section>
      </div>}
    </div>
  </main>;
}
