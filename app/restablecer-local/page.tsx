"use client";

import Link from "@/app/components/sport-link";
import { PasswordInput } from "@/app/components/password-input";
import { FormEvent, useState } from "react";

export default function LocalResetPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/acceso/restablecer-local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se ha podido actualizar la contraseña.");
      setPassword(""); setConfirmation(""); setMessage("Contraseña actualizada. Ya puedes entrar como administrador.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se ha podido actualizar la contraseña."); }
    finally { setBusy(false); }
  }

  return <main className="directory-app min-h-screen"><section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm"><p className="text-xs font-black tracking-[.14em] text-red-700">SOLO EN LOCALHOST</p><h1 className="mt-2 text-3xl font-black text-neutral-900">Nueva contraseña de administrador</h1><p className="mt-3 text-sm leading-6 text-neutral-600">Actualiza la contraseña de la cuenta administradora configurada en este equipo.</p><form className="mt-7 grid gap-4" onSubmit={reset}><label className="grid gap-2 text-sm font-bold text-neutral-700">Nueva contraseña<PasswordInput value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} autoComplete="new-password" required className="rounded-lg border border-neutral-300 px-3 py-2.5 font-normal"/></label><label className="grid gap-2 text-sm font-bold text-neutral-700">Repite la contraseña<PasswordInput value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} autoComplete="new-password" required className="rounded-lg border border-neutral-300 px-3 py-2.5 font-normal"/></label><button disabled={busy} className="mt-2 rounded-lg bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Actualizando…" : "Guardar contraseña"}</button></form>{message && <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800" role="status">{message}</p>}<Link href="/login" className="mt-5 block text-center text-sm font-bold text-neutral-600 hover:text-red-700">Volver al acceso</Link></div></section></main>;
}
