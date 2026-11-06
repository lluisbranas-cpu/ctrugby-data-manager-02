"use client";
import { FormEvent, useState } from "react";

export function EmailProfileAccess() {
  const [step, setStep] = useState<"email" | "code" | "choice">("email");
  const [choices, setChoices] = useState<{ index: number; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/acceso/ficha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: step === "email" ? "send-code" : step === "code" ? "verify-code" : "select-profile",
        ...fields, ...(step === "choice" ? { choice: Number(fields.choice) } : {}),
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido completar el acceso.");
      if (data.destination) { window.location.replace(data.destination); return; }
      if (data.choices) { setChoices(data.choices); setStep("choice"); setMessage(""); }
      else { setStep("code"); setMessage(data.message); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se ha podido completar el acceso."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5"><p className="text-sm leading-6 text-neutral-600">Introduce un correo asociado al jugador o a sus tutores. Solo enviaremos el código si ese correo tiene autorización para acceder a una ficha.</p>
    <form key={step} onSubmit={submit} className="mt-5 grid gap-4">
      {step === "email" && <label className="grid gap-2 text-sm font-bold">Correo electrónico<input required type="email" name="email" autoComplete="email" maxLength={254} className="rounded-lg border px-3 py-2.5 font-normal" /></label>}
      {step === "code" && <label className="grid gap-2 text-sm font-bold">Código recibido por correo<input required name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} className="rounded-lg border px-3 py-2.5 font-normal" /></label>}
      {step === "choice" && <label className="grid gap-2 text-sm font-bold">Elige tu acceso<select name="choice" className="rounded-lg border px-3 py-2.5" required>{choices.map((choice) => <option key={choice.index} value={choice.index}>{choice.label}</option>)}</select><span className="text-xs font-normal">Solo la ficha elegida tendrá acceso privado.</span></label>}
      <button disabled={busy} className="rounded-lg bg-red-700 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? "Comprobando…" : step === "email" ? "Enviar código" : step === "code" ? "Confirmar y entrar" : "Entrar"}</button>
    </form>
    {message && <p role="status" className="mt-3 text-sm text-neutral-600">{message}</p>}{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {step !== "email" && <button type="button" disabled={busy} onClick={() => { setStep("email"); setMessage(""); setError(""); }} className="mt-4 text-sm font-bold text-red-700">Cambiar correo o pedir otro código</button>}
  </div>;
}
