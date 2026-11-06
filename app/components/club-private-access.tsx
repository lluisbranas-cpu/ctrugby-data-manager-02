"use client";
import Link from "@/app/components/sport-link";
import { FormEvent, useEffect, useState } from "react";
export function ClubPrivateAccess({ clubId, admin }: { clubId: string; admin: boolean }) {
  const [allowed, setAllowed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clubs/${clubId}/autorizaciones`, { cache: "no-store", signal: controller.signal }).then((response) => setAllowed(response.ok)).catch(() => {});
    return () => controller.abort();
  }, [clubId]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/clubs/${clubId}/acceso`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, active: values.active === "enable" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setMessage(values.active === "enable" ? "Cuenta del club vinculada. Para entrar debe confirmar el código enviado a su correo. Solo podrá consultar jugadores con autorización activa." : "Acceso de esta cuenta al club retirado.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  if (!admin && !allowed) return null;
  return <section className="my-6 rounded-xl border bg-white p-5"><h2 className="font-black">Acceso privado del club</h2>{allowed && <Link href={`/clubs/${clubId}/autorizaciones`} className="mt-3 inline-block font-bold text-red-700">Ver fichas de jugadores con autorización</Link>}{admin && <><p className="mt-2 text-sm">Vincula el correo del representante del club. Esto no autoriza ninguna ficha: cada jugador o tutor debe conceder su permiso.</p><form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Correo del representante<input name="email" type="email" required maxLength={254} className="rounded-lg border p-2" /></label><label className="grid gap-1 text-sm font-bold">Teléfono asociado<input name="phone" type="tel" placeholder="+34600111222" required maxLength={40} className="rounded-lg border p-2" /></label><label className="grid gap-1 text-sm font-bold">Estado<select name="active" className="rounded-lg border p-2"><option value="enable">Dar acceso al club</option><option value="disable">Retirar acceso al club</option></select></label><button disabled={busy} className="self-end rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar acceso"}</button></form></>}{message && <p role="status" className="mt-3 text-sm">{message}</p>}</section>;
}
