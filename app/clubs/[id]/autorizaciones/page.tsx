"use client";
import Link from "@/app/components/sport-link";
import { useParams } from "@/lib/sport-navigation";
import { useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
type Player = { id: string; first_name: string; last_name: string | null };
export default function ClubAuthorizationsPage() {
  const { id } = useParams<{ id: string }>();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clubs/${id}/autorizaciones`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setPlayers(data.players);
    }).catch((cause) => { if (!controller.signal.aborted) setError(cause.message); });
    return () => controller.abort();
  }, [id]);
  return <main className="directory-app min-h-screen"><header className="catalog-topbar"><Link href="/" className="catalog-brand">RUGBY - HUB</Link><ManagerMenu current="clubs" /></header><section className="mx-auto max-w-4xl px-5 py-8"><h1 className="text-3xl font-black">Fichas con autorización al club</h1><p className="mt-3 text-sm leading-6">Solo aparecen jugadores que han autorizado a este club a consultar su ficha privada. El resto de las fichas se consulta en modo público. Si retiran la autorización, el acceso privado termina.</p>{error ? <p role="alert" className="mt-5 text-red-700">{error}</p> : players === null ? <p className="mt-5">Cargando…</p> : players.length === 0 ? <p className="mt-5">Todavía no hay jugadores con autorización activa.</p> : <ul className="mt-6 grid gap-3">{players.map((player) => <li key={player.id}><Link href={`/jugadores/${player.id}`} className="block rounded-xl border bg-white p-4 font-bold">{player.first_name} {player.last_name} · {player.id}<span className="ml-3 text-sm text-red-700">Ver ficha privada</span></Link></li>)}</ul>}<Link href={`/clubs/${id}`} className="mt-6 inline-block text-sm font-bold text-red-700">Volver a la ficha del club</Link></section></main>;
}
