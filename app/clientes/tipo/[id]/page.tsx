"use client";

import Link from "@/app/components/sport-link";
import { ArrowLeft, ArrowUpRight, Pencil, Search, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ClientType, Customer } from "@/lib/client-types";

type Data = { types: ClientType[]; clients: Customer[] };
export default function ClientsByTypePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/clientes", { cache: "no-store", signal: controller.signal })
      .then(async res => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || "No se han podido cargar los clientes.");
        return payload as Data;
      })
      .then(payload => { if (!controller.signal.aborted) setData(payload); })
      .catch(cause => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error de carga.");
      });
    return () => controller.abort();
  }, []);
  const type = data?.types.find(item => item.id === id);
  const clients = useMemo(() => (data?.clients ?? []).filter(client => client.type_id === id).sort((a,b) => a.name.localeCompare(b.name, "es")), [data, id]);
  const visible = clients.filter(client => client.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  return <main className="min-h-[70vh] bg-[#f4f6f8] px-4 py-8 text-[#223044] sm:px-8">
    <div className="mx-auto max-w-[1380px]">
      <Link href="/clientes" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[#1b4980] hover:underline"><ArrowLeft size={16}/> Tipos de cliente</Link>
      <header className="mb-6 rounded-2xl bg-[#143f6d] px-6 py-7 text-white sm:px-8">
        <p className="text-xs font-extrabold tracking-[.13em] text-[#c8ddf3]">ADMINISTRACIÓN · LIKIDHUB</p>
        <h1 className="mt-2 text-3xl font-black">{type?.name ?? (data ? "Tipo no encontrado" : "Clientes por categoría")}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-[#deebf8]"><Users size={17}/> {clients.length} clientes registrados</p>
      </header>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-white p-4 text-red-700">{error}</p>}
      {!data && !error && <p role="status" className="rounded-xl bg-white p-5">Cargando clientes…</p>}
      {data && !type && <p role="alert" className="rounded-xl bg-white p-5">Esta categoría no existe.</p>}
      {data && type && <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex w-full max-w-md items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2"><Search size={18} className="text-neutral-500"/><span className="sr-only">Buscar cliente</span><input className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Buscar cliente…" value={search} onChange={event => setSearch(event.target.value)}/></label>
          <span className="text-xs font-semibold text-neutral-500">Mostrando {visible.length} de {clients.length}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(client => <article key={client.id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-[#fafbfc] p-4">
            <div className="min-w-0"><h2 className="truncate font-extrabold">{client.name}</h2><p className="mt-1 text-xs text-neutral-500">{type.name}</p></div>
            <Link href={`/clientes?editar=${encodeURIComponent(client.id)}`} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#bfd0e2] bg-white px-3 py-2 text-xs font-bold text-[#1b4980]" aria-label={`Editar ${client.name}`}><Pencil size={15}/><span className="hidden sm:inline">Editar</span><ArrowUpRight size={13}/></Link>
          </article>)}
        </div>
        {!visible.length && <p className="rounded-xl bg-[#f4f6f8] p-8 text-center text-sm text-neutral-500">No hay clientes que coincidan.</p>}
      </section>}
    </div>
  </main>;
}
