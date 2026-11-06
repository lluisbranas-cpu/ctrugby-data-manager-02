"use client";
import Link from "@/app/components/sport-link";
import { AccessReturnActions } from "@/app/components/access-return-actions";
import { PasswordInput } from "@/app/components/password-input";
import { FormEvent, useState } from "react";
import { brand } from "@/lib/brand";

export default function GuestPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    if (fields.password !== fields.confirmation) { setError("Las contraseñas no coinciden."); setBusy(false); return; }
    try {
      const response = await fetch("/api/acceso/invitado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "register", ...fields }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido solicitar el enlace.");
      setSent(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido solicitar el enlace."); }
    finally { setBusy(false); }
  }
  const input = "rounded-lg border border-neutral-300 p-3 font-normal";
  return <main className="directory-app flex min-h-screen items-center justify-center px-5 py-10"><section className="w-full max-w-md rounded-2xl border bg-white p-7 shadow-sm"><p className="text-xs font-black tracking-widest text-red-700">PÚBLICO · INVITADO</p><h1 className="mt-2 text-3xl font-black">Consultar Rugby</h1><p className="mt-3 text-sm leading-6 text-neutral-600">Crea tu cuenta con nombre, correo, teléfono y contraseña. Confirma tu correo para consultar la información pública.</p>{sent ? <div role="status" className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-900">Solicitud enviada. Revisa tu correo y la carpeta de spam. Abre el enlace de confirmación en este mismo navegador antes de una hora.<button type="button" onClick={() => setSent(false)} className="mt-4 block font-bold underline">Corregir los datos o solicitar otro enlace</button></div> : <form onSubmit={submit} className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-bold">Nombre<input name="name" autoComplete="name" required minLength={2} maxLength={120} className={input} /></label><label className="grid gap-2 text-sm font-bold">Correo electrónico<input name="email" type="email" autoComplete="email" required maxLength={254} className={input} /></label><label className="grid gap-2 text-sm font-bold">Teléfono<input name="phone" type="tel" autoComplete="tel" placeholder="+34 600 111 222" required maxLength={40} className={input} /></label><label className="grid gap-2 text-sm font-bold">Contraseña<PasswordInput name="password" autoComplete="new-password" minLength={10} maxLength={1024} required className={input} /></label><label className="grid gap-2 text-sm font-bold">Repite la contraseña<PasswordInput name="confirmation" autoComplete="new-password" minLength={10} maxLength={1024} required className={input} /></label><p className="text-xs leading-5 text-neutral-600">{brand.product} guardará estos datos para gestionar tu acceso como invitado. Se verificará el correo; el teléfono se guarda como contacto.</p><button disabled={busy} className="rounded-lg bg-red-700 p-3 font-bold text-white disabled:opacity-60">{busy ? "Enviando…" : "Enviar enlace de confirmación"}</button></form>}{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<Link href="/acceso" className="mt-6 block text-center text-sm font-bold text-neutral-600">Ya tengo cuenta: entrar</Link><Link href="/acceso?recuperar=1" className="mt-4 block text-center text-sm font-bold text-red-700">Recordar contraseña</Link><AccessReturnActions /></section></main>;
}
