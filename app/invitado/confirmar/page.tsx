"use client";
import Link from "@/app/components/sport-link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/lib/sport-navigation";

export default function ConfirmGuestPage() {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    window.history.replaceState(null, "", window.location.pathname);
    async function confirm() {
      if (!accessToken || params.has("error")) throw new Error("El enlace no es válido o ha caducado. Solicita uno nuevo.");
      const response = await fetch("/api/acceso/invitado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", accessToken }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se ha podido confirmar el acceso.");
      router.replace("/jugadores"); router.refresh();
    }
    void confirm().catch((cause) => setError(cause instanceof Error ? cause.message : "No se ha podido confirmar el acceso."));
  }, [router]);
  return <main className="directory-app flex min-h-screen items-center justify-center p-5"><section className="max-w-md rounded-2xl border bg-white p-7"><h1 className="text-2xl font-black">Confirmar acceso público</h1><p role={error ? "alert" : "status"} className="mt-4">{error || "Comprobando tu correo…"}</p>{error && <Link className="mt-5 block font-bold text-red-700" href="/invitado">Volver al registro de invitado</Link>}</section></main>;
}
