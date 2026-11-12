"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "@/app/components/sport-link";
import { Camera } from "lucide-react";
import { prepareClientLogo } from "@/lib/prepare-client-logo";
import { contrastText } from "@/lib/client-preview";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import type { ClientType, Customer } from "@/lib/client-types";

const input = "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900";
const button = "rounded-lg border border-neutral-300 px-3 py-2 text-sm font-bold disabled:opacity-50";
const emptyType = { id: "", name: "", characteristics: "", track_participations: false, version: 0 };
const emptyClient: Customer = { id: "", name: "", type_id: "", characteristics: "", participations: null, primary_color: "#171717", secondary_color: "#ffffff", accent_color: "#dc2626", surname_color: "#171717", style: "", typography: "", logo: "", version: 0 };
type State = { types: ClientType[]; clients: Customer[] };

function LogoPicker({ logo, name, disabled, onFile }: { logo: string; name: string; disabled: boolean; onFile: (file?: File) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const label = `${logo ? "Cambiar" : "Subir"} logotipo de ${name}`;
  return <span className="relative inline-flex shrink-0"><button type="button" title={label} aria-label={label} disabled={disabled} onClick={() => fileInput.current?.click()} className="relative inline-flex h-12 w-12 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-50 text-neutral-500 hover:border-blue-500 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-wait disabled:opacity-50">
    {logo ? <><img src={logo} alt={`Logotipo de ${name}`} className="h-10 w-10 object-contain" /><span className="absolute -bottom-1 -right-1 rounded-full border border-neutral-200 bg-white p-1"><Camera size={12} aria-hidden="true" /></span></> : <Camera size={21} aria-hidden="true" />}
  </button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden disabled={disabled} aria-label={`Archivo del logotipo de ${name}`} onChange={event => { onFile(event.target.files?.[0]); event.target.value = ""; }} /></span>;
}
export default function ClientsPage() {
  const [state, setState] = useState<State | null>(null);
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"client" | "type">("client");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [typeDraft, setTypeDraft] = useState<ClientType | null>(null);
  const [draft, setDraft] = useState<Customer | null>(null);
  async function load() {
    try {
      const response = await fetch("/api/clientes", { cache: "no-store" });
      const data = await response.json();
      setDenied(response.status === 403);
      if (!response.ok) throw new Error(data.error);
      setState(data);
      return true;
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se han podido cargar los datos."); return false; }
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []);
  async function mutate(kind: "type" | "client", action: "save" | "delete", values: ClientType | Customer) {
    if (action === "delete" && !window.confirm(`¿Eliminar «${values.name}»?`)) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, action, ...values }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.dispatchEvent(new Event("ctrugby-clients-updated"));
      if (kind === "type") setTypeDraft(null); else setDraft(null);
      if (await load()) setNotice(action === "delete" ? "Registro eliminado." : "Cambios guardados.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido guardar."); }
    finally { setBusy(false); }
  }
  async function selectLogo(file?: File, client?: Customer) {
    if (!file) return;
    setBusy(true); setNotice("Preparando logotipo…");
    try {
      const logo = await prepareClientLogo(file);
      if (client) {
        const response = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "client", action: "save-logo", id: client.id, version: client.version, logo }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "No se ha podido guardar el logotipo.");
        window.dispatchEvent(new Event("ctrugby-clients-updated"));
        if (await load()) setNotice("Logotipo guardado.");
      } else { setDraft(current => current ? { ...current, logo } : current); setNotice("Logotipo preparado. Pulsa Guardar cliente para guardarlo."); }
    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido subir el logotipo."); }
    finally { setBusy(false); }
  }  const selectedType = state?.types.find(type => type.id === draft?.type_id);
  const visibleClients = state?.clients.filter(client => (!filter || client.type_id === filter) && client.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) ?? [];
  const visibleTypes = state?.types.filter(type => type.name.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))) ?? [];
  const showParticipationsColumn = Boolean(filter && state?.types.find(type => type.id === filter)?.track_participations);
  const saveType = (event: FormEvent) => { event.preventDefault(); if (typeDraft) void mutate("type", "save", typeDraft); };
  const saveClient = (event: FormEvent) => { event.preventDefault(); if (draft) void mutate("client", "save", draft); };
  return <main className="directory-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><img src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} /><strong>RUGBY - HUB</strong></Link><ManagerMenu /></header>
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-8">
      <header><p className="text-xs font-bold text-red-600">ADMINISTRACIÓN</p><h1 className="text-3xl font-black">Clientes</h1><p className="mt-2 text-sm text-neutral-600">Tipos de cliente, características especiales e identidad visual.</p></header>
      {notice && <p role="status" className="catalog-notice">{notice}</p>}
      {!state && <div className="rounded-xl bg-white p-5">{denied ? <Link href="/login">Iniciar sesión como administrador</Link> : notice ? <button className={button} onClick={() => void load()}>Reintentar carga</button> : "Cargando clientes…"}</div>}
      {state && <>
        <nav className="flex gap-2" aria-label="Tablas de clientes">{(["client", "type"] as const).map(value => <button key={value} disabled={busy} aria-pressed={tab === value} onClick={() => { setTab(value); setSearch(""); }} className={`${button} ${tab === value ? "bg-neutral-900 text-white" : "bg-white"}`}>{value === "client" ? `Clientes (${state.clients.length})` : `Tipos de cliente (${state.types.length})`}</button>)}</nav>
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3"><label className="min-w-48 flex-1"><span className="sr-only">Buscar por nombre</span><input className={input} placeholder="Buscar por nombre…" value={search} onChange={event => setSearch(event.target.value)} /></label>{tab === "client" && <select aria-label="Filtrar por tipo" className={input + " sm:w-auto"} value={filter} onChange={event => setFilter(event.target.value)}><option value="">Todos los tipos</option>{state.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select>}<button className={button} disabled={busy || (tab === "client" && !state.types.length)} onClick={() => tab === "type" ? setTypeDraft({ ...emptyType }) : setDraft({ ...emptyClient, type_id: state.types[0]?.id ?? "" })}>+ Añadir {tab === "client" ? "cliente" : "tipo"}</button></div>
          {tab === "client" && !state.types.length && <p className="mb-4 text-sm">Crea primero un tipo de cliente.</p>}
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{tab === "client" ? "Lista de clientes y su categoría" : "Tipos de cliente y características especiales"}</caption><thead className="border-b bg-neutral-50"><tr>{(tab === "client" ? ["Cliente", "Tipo / categoría", "Características", ...(showParticipationsColumn ? ["Participaciones"] : []), "Cabecera", "Apellidos", "Botones", "Fondo", "Estilo y tipografía", "Acciones"] : ["Tipo de cliente", "Características especiales", "Registra participaciones", "Clientes", "Acciones"]).map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
            {tab === "client" ? visibleClients.map(client => <tr key={client.id} className="border-b align-top"><td className="p-3"><div className="flex items-center gap-3"><LogoPicker logo={client.logo} name={client.name} disabled={busy || Boolean(draft)} onFile={file => void selectLogo(file, client)} /><b>{client.name}</b></div></td><td className="p-3">{state.types.find(type => type.id === client.type_id)?.name}</td><td className="max-w-xs whitespace-pre-wrap p-3">{client.characteristics || "—"}</td>{showParticipationsColumn && <td className="p-3">{client.participations ?? "—"}</td>}{[client.primary_color, client.surname_color, client.accent_color, client.secondary_color].map((color, index) => <td className="p-3" key={index}><span title={color} className="inline-block h-6 w-6 rounded border border-neutral-300" style={{ backgroundColor: color }} /><small className="block font-mono">{color}</small></td>)}<td className="max-w-xs whitespace-pre-wrap p-3">{client.style || "—"}<small className="block">{client.typography}</small></td><td className="p-3"><div className="flex gap-2"><button disabled={busy} className={button} onClick={() => setDraft({ ...client })}>Editar<span className="sr-only"> {client.name}</span></button><button disabled={busy} className={button + " text-red-700"} onClick={() => void mutate("client", "delete", client)}>Eliminar<span className="sr-only"> {client.name}</span></button></div></td></tr>) : visibleTypes.map(type => { const count = state.clients.filter(client => client.type_id === type.id).length; return <tr key={type.id} className="border-b"><td className="p-3 font-bold">{type.name}</td><td className="max-w-lg whitespace-pre-wrap p-3">{type.characteristics || "—"}</td><td className="p-3">{type.track_participations ? "Sí" : "No"}</td><td className="p-3">{count}</td><td className="p-3"><div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setTypeDraft({ ...type })}>Editar<span className="sr-only"> {type.name}</span></button><button className={button + " text-red-700"} disabled={busy || count > 0} title={count ? "Reasigna los clientes antes de eliminar el tipo" : "Eliminar tipo"} onClick={() => void mutate("type", "delete", type)}>Eliminar<span className="sr-only"> {type.name}</span></button></div></td></tr>; })}
            {(tab === "client" ? !visibleClients.length : !visibleTypes.length) && <tr><td colSpan={tab === "client" ? (showParticipationsColumn ? 10 : 9) : 5} className="p-8 text-center text-neutral-500">No hay registros para mostrar.</td></tr>}
          </tbody></table></div>
        </section>
        {typeDraft && <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-bold">{typeDraft.id ? "Editar tipo de cliente" : "Nuevo tipo de cliente"}</h2><form onSubmit={saveType}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><label>Nombre<input required maxLength={160} className={input} value={typeDraft.name} onChange={event => setTypeDraft({ ...typeDraft, name: event.target.value })} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={typeDraft.track_participations} onChange={event => setTypeDraft({ ...typeDraft, track_participations: event.target.checked })} />Registrar número de participaciones (por ejemplo, Campus)</label><label className="sm:col-span-2">Características especiales<textarea maxLength={4000} rows={3} className={input} value={typeDraft.characteristics} onChange={event => setTypeDraft({ ...typeDraft, characteristics: event.target.value })} /></label><div className="flex gap-2"><button className={button + " bg-neutral-900 text-white"}>Guardar tipo</button><button type="button" className={button} onClick={() => setTypeDraft(null)}>Cancelar</button></div></fieldset></form></section>}
        {draft && <section className="rounded-xl bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-bold">{draft.id ? "Editar cliente" : "Nuevo cliente"}</h2><form onSubmit={saveClient}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>Nombre del cliente<input required maxLength={160} className={input} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label>Tipo / categoría<select required className={input} value={draft.type_id} onChange={event => setDraft({ ...draft, type_id: event.target.value })}>{state.types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
          <label>Número de participaciones{selectedType?.track_participations ? " *" : " (opcional)"}<input type="number" min={0} max={2147483647} step={1} required={selectedType?.track_participations} className={input} value={draft.participations ?? ""} onChange={event => setDraft({ ...draft, participations: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          {selectedType?.characteristics && <p className="rounded-lg bg-neutral-50 p-3 text-sm sm:col-span-2 lg:col-span-3"><b>Características del tipo {selectedType.name}:</b> {selectedType.characteristics}</p>}
          <label className="sm:col-span-2 lg:col-span-3">Características propias del cliente<textarea maxLength={4000} rows={3} className={input} value={draft.characteristics} onChange={event => setDraft({ ...draft, characteristics: event.target.value })} /></label>
          {(["primary_color", "surname_color", "accent_color", "secondary_color"] as const).map((key, index) => <label key={key}>{["Color cabecera", "Color apellidos", "Color botones", "Color fondo"][index]}<div className="flex gap-2"><input aria-label={`Selector de ${["color cabecera", "color apellidos", "color botones", "color fondo"][index]}`} type="color" className="h-10 w-14" value={/^#[0-9a-f]{6}$/i.test(draft[key]) ? draft[key] : "#000000"} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /><input aria-label={`Código de ${["color cabecera", "color apellidos", "color botones", "color fondo"][index]}`} required pattern="#[0-9a-fA-F]{6}" className={input} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} /></div></label>)}
          <label>Tipografía<input maxLength={160} className={input} placeholder="Ej. Arial, títulos en negrita" value={draft.typography} onChange={event => setDraft({ ...draft, typography: event.target.value })} /></label>
          <label className="sm:col-span-2">Estilo visual<textarea maxLength={2000} rows={2} className={input} placeholder="Ej. deportivo, fondos claros, botones redondeados…" value={draft.style} onChange={event => setDraft({ ...draft, style: event.target.value })} /></label>
          <div><p className="mb-2">Logotipo</p><div className="flex items-center gap-3"><LogoPicker logo={draft.logo} name={draft.name || "nuevo cliente"} disabled={busy} onFile={file => void selectLogo(file)} /><span className="text-sm text-neutral-500">Pulsa la cámara para {draft.logo ? "cambiar" : "subir"} el logotipo.<small className="block">PNG, JPG, WebP o SVG · Hasta 10 MB</small></span></div></div><div className="flex items-center gap-4">{draft.logo && <button type="button" className={button} onClick={() => setDraft({ ...draft, logo: "" })}>Quitar logotipo</button>}</div>
          <div className="rounded-xl border p-4" style={{ backgroundColor: draft.secondary_color, color: draft.primary_color }}><div className="-mx-4 -mt-4 mb-3 rounded-t-xl px-4 py-3" style={{ backgroundColor: draft.primary_color, color: contrastText(/^#[0-9a-f]{6}$/i.test(draft.primary_color) ? draft.primary_color : "#171717") }}><b>{draft.name || "Cabecera del cliente"}</b></div><span className="block text-sm">Nombre</span><strong className="block text-lg" style={{ color: draft.surname_color }}>Apellidos</strong><span className="mt-2 block w-fit rounded px-3 py-1" style={{ backgroundColor: draft.accent_color, color: contrastText(/^#[0-9a-f]{6}$/i.test(draft.accent_color) ? draft.accent_color : "#dc2626") }}>Botón de ejemplo</span></div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3"><button className={button + " bg-neutral-900 text-white"}>Guardar cliente</button><button type="button" className={button} onClick={() => setDraft(null)}>Cancelar</button></div>
        </fieldset></form></section>}
      </>}
    </div>
  </main>;
}
