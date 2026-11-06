"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
type Club = { id: string; name: string; authorized: boolean };
export function PlayerClubPermissions({ playerId }: { playerId: string }) {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [allowed, setAllowed] = useState(false);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/jugadores/${playerId}/autorizaciones`, { cache: "no-store", signal });
    return response.ok ? response.json() : null;
  }, [playerId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then((data) => {
      if (!controller.signal.aborted) { setAllowed(data?.can_manage === true); setClubs(data?.clubs ?? []); }
    }).catch(() => {});
    return () => controller.abort();
  }, [load]);
  async function save(clubId: string, active: boolean) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/jugadores/${playerId}/autorizaciones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ club_id: clubId, active }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const fresh = await load(); setAllowed(fresh?.can_manage === true); setClubs(fresh?.clubs ?? []); setSelected(""); setMessage(active ? "Club autorizado para consultar la ficha privada." : "Autorización retirada. El club ya no tiene acceso privado.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  function grant(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (selected) void save(selected, true); }
  if (!allowed) return null;
  return <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-5"><h3 className="font-black">Autorizaciones de acceso a clubes</h3><p className="mt-2 text-sm leading-6">Solo tú o tus tutores podéis autorizar a un club. La autorización permite consultar esta ficha privada, incluidas las necesidades alimenticias y médicas. No permite editarla ni consultar otras fichas. Puedes retirarla en cualquier momento.</p>
    <ul className="mt-4 grid gap-3">{clubs.filter((club) => club.authorized).map((club) => <li key={club.id} className="flex items-center justify-between gap-3"><span>{club.name}</span><button disabled={busy} onClick={() => void save(club.id, false)} className="text-sm font-bold text-red-700 disabled:opacity-50">Retirar autorización</button></li>)}</ul>
    {!clubs.some((club) => club.authorized) && <p className="mt-3 text-sm text-neutral-600">Ningún club tiene autorización.</p>}
    <form onSubmit={grant} className="mt-5 grid gap-3"><label className="grid gap-2 text-sm font-bold">Club que quieres autorizar<select required value={selected} onChange={(event) => setSelected(event.target.value)} className="rounded-lg border p-2"><option value="">Selecciona un club</option>{clubs.filter((club) => !club.authorized).map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></label><label className="flex gap-2 text-sm" key={selected}><input required type="checkbox" />Autorizo expresamente al club seleccionado a consultar los datos privados de esta ficha, incluidas las necesidades alimenticias y médicas.</label><button disabled={busy || !selected} className="justify-self-start rounded-lg bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">Autorizar club</button></form>
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </section>;
}
