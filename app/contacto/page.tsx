"use client";

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { FormEvent, useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { brand } from "@/lib/brand";

type ContactMessage = { id: string; name: string | null; reply_to: string | null; subject: string; message: string; created_at: string };
type State = { configured: boolean; admin: boolean; messages: ContactMessage[] };

export default function ContactPage() {
  const [state, setState] = useState<State | null>(null);
  const [name, setName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subject, setSubject] = useState(`Información errónea en ${brand.product}`);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMessages = () => fetch("/api/contacto", { cache: "no-store" })
    .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data as State; })
    .then(setState)
    .catch(() => setState({ configured: true, admin: false, messages: [] }));

  useEffect(() => { void loadMessages(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/contacto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, reply_to: replyTo, subject, message }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotice("Mensaje enviado. Gracias, lo revisaremos cuanto antes.");
      setMessage("");
      if (state?.admin) void loadMessages();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se ha podido enviar el formulario.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src={brand.logo} alt={brand.product} width={100} height={54} priority/><span><strong>{brand.hub}</strong><small>Base compartida</small></span></Link><ManagerMenu current="contact"/></header>
    <section className="catalog-heading">
      <div><p>CONTACTO</p><h1>Contactar con {brand.product}</h1><span>Envía una consulta o avisa de una información que haya que revisar.</span></div>
    </section>
    <section className="catalog-content">
      {notice && <p className="catalog-notice" role="status">{notice}</p>}
      <div className="catalog-panel">
        <header><div><p>FORMULARIO</p><h2>Enviar una corrección o consulta</h2><span>Tu mensaje queda registrado para el equipo de administración.</span></div></header>
        <form className="grid gap-4 p-5 sm:p-6" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Nombre
              <input className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold normal-case tracking-normal text-neutral-900 outline-none focus:border-red-600" value={name} onChange={(event) => setName(event.target.value)} placeholder="Opcional" />
            </label>
            <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Correo de respuesta
              <input type="email" className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold normal-case tracking-normal text-neutral-900 outline-none focus:border-red-600" value={replyTo} onChange={(event) => setReplyTo(event.target.value)} placeholder="Opcional" />
            </label>
          </div>
          <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Asunto
            <input required className="h-11 rounded-lg border border-neutral-200 px-3 text-sm font-semibold normal-case tracking-normal text-neutral-900 outline-none focus:border-red-600" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="grid gap-2 text-xs font-black uppercase tracking-[.12em] text-neutral-500">Mensaje
            <textarea required className="min-h-40 rounded-lg border border-neutral-200 p-3 text-sm font-medium normal-case leading-6 tracking-normal text-neutral-900 outline-none focus:border-red-600" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Describe la consulta o la información que habría que revisar. Si puedes, incluye el nombre del jugador, club o página afectada." />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button disabled={busy} className="catalog-menu-button inline-flex min-h-11 items-center">{busy ? "Enviando..." : "Enviar formulario"}</button>
          </div>
        </form>
      </div>
      {state?.admin && <section className="catalog-panel mt-5">
        <header><div><p>MENSAJES RECIBIDOS</p><h2>Tabla de contacto</h2><span>{state.messages.length} mensaje{state.messages.length === 1 ? "" : "s"} recibido{state.messages.length === 1 ? "" : "s"}.</span></div></header>
        <div className="overflow-x-auto">
          <div className="grid min-w-[820px] grid-cols-[150px_minmax(150px,.8fr)_minmax(180px,1fr)_minmax(260px,1.4fr)] border-y border-neutral-200 bg-neutral-50 px-4 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500"><span>FECHA</span><span>CONTACTO</span><span>ASUNTO</span><span>MENSAJE</span></div>
          <ul className="min-w-[820px] divide-y divide-neutral-200">{state.messages.map((item) => <li key={item.id} className="grid grid-cols-[150px_minmax(150px,.8fr)_minmax(180px,1fr)_minmax(260px,1.4fr)] gap-3 px-4 py-3 text-sm">
            <time className="font-semibold text-neutral-700">{new Date(item.created_at).toLocaleString("es-ES")}</time>
            <span className="min-w-0"><b className="block truncate">{item.name ?? "Sin nombre"}</b><small className="block truncate text-neutral-500">{item.reply_to ?? "Sin correo"}</small></span>
            <b className="min-w-0 truncate">{item.subject}</b>
            <span className="min-w-0 whitespace-pre-wrap text-neutral-700">{item.message}</span>
          </li>)}</ul>
          {!state.messages.length && <p className="p-8 text-center text-sm text-neutral-500">Aún no hay mensajes recibidos.</p>}
        </div>
      </section>}
    </section>
  </main>;
}
