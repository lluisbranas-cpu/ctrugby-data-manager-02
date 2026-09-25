"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
export default function Recovery() {
  const token = useRef("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Comprobando enlace…");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hash.get("access_token");
    if (accessToken && hash.get("type") === "recovery") token.current = accessToken;
    window.history.replaceState(null, "", "/recuperar");
    // The token stays only in memory; never in storage, logs or React-rendered content.
    const timer = window.setTimeout(() => {
      setReady(Boolean(token.current));
      setMessage(token.current ? "Elige una contraseña nueva para la app." : "Falta el enlace de recuperación o ha caducado. Abre el correo de recuperación.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password !== form.get("confirmation")) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/prueba/recuperar", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token.current },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      token.current = ""; setDone(true); setReady(false);
      setMessage("Contraseña cambiada. Ya puedes entrar en la prueba.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo conectar. Vuelve a intentarlo."); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-neutral-100 px-6 py-16 text-neutral-950">
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
      <p className="font-black text-red-700">CTRugby</p>
      <h1 className="my-4 text-2xl font-bold">Nueva contraseña</h1>
      <p role="status">{message}</p>
      {ready && !done && <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block">Nueva contraseña<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="mt-2 w-full rounded border p-3" /></label>
        <label className="block">Repetir contraseña<input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className="mt-2 w-full rounded border p-3" /></label>
        <p className="text-sm text-neutral-600">Al menos 12 caracteres. Esta contraseña es para la app.</p>
        <button disabled={busy} className="rounded bg-red-700 px-5 py-3 font-bold text-white">{busy ? "Guardando…" : "Guardar contraseña"}</button>
      </form>}
      <Link href="/prueba" className="mt-6 block underline">Ir a la prueba</Link>
    </section>
  </main>;
}