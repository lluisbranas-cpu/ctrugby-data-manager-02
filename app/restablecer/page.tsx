"use client";

import Link from "@/app/components/sport-link";
import { PasswordInput } from "@/app/components/password-input";
import { FormEvent, useState } from "react";
import { useRouter } from "@/lib/sport-navigation";

export default function ResetAccessPage() {
  const router = useRouter();
  const [accessToken] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("access_token") ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    if (!accessToken) { setMessage("El enlace no es válido o ha caducado. Solicita uno nuevo."); return; }
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/acceso/restablecer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, password }) }); const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error); setMessage("Contraseña actualizada. Ya puedes iniciar sesión."); setTimeout(() => router.push("/login"), 1200); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se ha podido actualizar la contraseña."); }
    finally { setBusy(false); }
  }
  return <main className="directory-app min-h-screen"><section className="mx-auto flex min-h-screen max-w-md items-center px-5"><div className="w-full rounded-2xl border border-neutral-200 bg-white p-7 shadow-sm"><p className="text-xs font-black tracking-[.14em] text-red-700">ACCESO RUGBY</p><h1 className="mt-2 text-3xl font-black">Nueva contraseña</h1><p className="mt-3 text-sm leading-6 text-neutral-600">Elige una contraseña nueva de al menos 10 caracteres.</p><form className="mt-7 grid gap-4" onSubmit={reset}><label className="grid gap-2 text-sm font-bold">Nueva contraseña<PasswordInput name="password" minLength={10} required className="rounded-lg border border-neutral-300 px-3 py-2.5 font-normal"/></label><label className="grid gap-2 text-sm font-bold">Repite la contraseña<PasswordInput name="confirmation" minLength={10} required className="rounded-lg border border-neutral-300 px-3 py-2.5 font-normal"/></label><button disabled={busy} className="rounded-lg bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Actualizando…" : "Guardar contraseña"}</button></form>{message && <p className="mt-4 rounded-lg bg-neutral-100 px-3 py-2 text-sm text-neutral-800" role="status">{message}</p>}<Link href="/login" className="mt-5 block text-center text-sm font-bold text-neutral-600">Volver al acceso</Link></div></section></main>;
}

