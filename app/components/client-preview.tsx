"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ClientType, Customer } from "@/lib/client-types";
import { contrastText, customerPreview, previewExamples, type PreviewClient } from "@/lib/client-preview";
import "./client-preview.css";
import { isSportPage, previewClientSlug, scopedSportHref, sportScope, unscopedSportPath } from "@/lib/sport-routes";

const storageKey = "ctrugby-client-preview";
type PreviewState = { available: boolean; clients: PreviewClient[]; selected: PreviewClient | null; select: (id: string) => void; admin: boolean; notice: string };
const PreviewContext = createContext<PreviewState>({ available: false, clients: [], selected: null, select: () => {}, admin: false, notice: "" });
const variables = ["--preview-surname", "--preview-primary", "--preview-secondary", "--preview-accent", "--preview-on-primary", "--preview-on-accent", "--preview-logo", "--preview-name", "--preview-font"];

export function ClientPreviewProvider({ children, development }: { children: ReactNode; development: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [privateAccess, setPrivateAccess] = useState(false);
  const [clients, setClients] = useState<PreviewClient[]>(previewExamples);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const hidden = ["/login", "/acceso", "/invitado", "/invitado/confirmar", "/recuperar", "/restablecer", "/restablecer-local"].includes(pathname) || pathname.startsWith("/revision-jugador/") || pathname.startsWith("/r/");
  const routeScope = sportScope(pathname);
  const routeClient = routeScope && routeScope !== "likid" ? clients.find(client => previewClientSlug(client) === routeScope) : null;
  const selectedExample = previewExamples.find(client => client.id === selectedId);
  const selected = routeScope ? routeClient ?? null : clients.find(client => client.id === selectedId) ?? (selectedExample ? clients.find(client => client.name.trim().toLocaleLowerCase("es") === selectedExample.name.trim().toLocaleLowerCase("es")) : null) ?? null;
  const available = !hidden && (development || privateAccess);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/acceso/estado", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const access = await response.json();
        if (cancelled) return;
        setAdmin(Boolean(access.admin));
        setPrivateAccess(Boolean(access.authenticated));
        if (!access.authenticated) { setClients(previewExamples); return; }
        const result = await fetch("/api/clientes", { cache: "no-store" });
        const data = await result.json();
        if (cancelled) return;
        if (!result.ok) { setClients(previewExamples); setNotice("Clientes pendientes de activar. Puedes usar las opciones de prueba."); return; }
        const types = new Map<string, string>((data.types as ClientType[]).map(type => [type.id, type.name]));
        const registered = (data.clients as Customer[]).map(client => customerPreview(client, types.get(client.type_id) ?? "Cliente"));
        setClients([...registered, ...previewExamples.filter(example => !registered.some(client => client.name.trim().toLocaleLowerCase("es") === example.name.trim().toLocaleLowerCase("es")))]);
        setNotice("");
      } catch {
        if (!cancelled) { setAdmin(false); setPrivateAccess(false); setClients(previewExamples); setNotice("Opciones de prueba disponibles; no se ha podido conectar con los clientes."); }
      }
    }
    const refresh = () => { void load(); };
    window.addEventListener("ctrugby-clients-updated", refresh);
    void load();
    return () => { cancelled = true; window.removeEventListener("ctrugby-clients-updated", refresh); };
  }, [pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setSelectedId(sessionStorage.getItem(storageKey) ?? ""); } catch { /* Browser storage is optional. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (available && selected) {
      root.dataset.clientPreview = selected.id;
      root.style.setProperty("--preview-primary", selected.primary);
      root.style.setProperty("--preview-secondary", selected.secondary);
      root.style.setProperty("--preview-accent", selected.accent);
      root.style.setProperty("--preview-surname", selected.surname || selected.accent);
      root.style.setProperty("--preview-on-primary", contrastText(selected.primary));
      root.style.setProperty("--preview-on-accent", contrastText(selected.accent));
      root.style.setProperty("--preview-logo", selected.logo ? `url("${selected.logo}")` : "none");
      root.style.setProperty("--preview-name", JSON.stringify(selected.name));
      root.style.setProperty("--preview-font", selected.typography || "var(--font-geist-sans), Arial, sans-serif");
    }
    return () => {
      delete root.dataset.clientPreview;
      variables.forEach(variable => root.style.removeProperty(variable));
    };
  }, [available, selected]);

  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || !isSportPage(url.pathname)) return;
      event.preventDefault();
      router.push(scopedSportHref(url.pathname, pathname) + url.search + url.hash);
    };
    document.addEventListener("click", navigate);
    return () => document.removeEventListener("click", navigate);
  }, [pathname, router]);

  function select(id: string) {
    setSelectedId(id);
    const client = clients.find(item => item.id === id);
    const current = unscopedSportPath(pathname);
    const section = isSportPage(current) ? current : "/jugadores";
    const destination = scopedSportHref(section, "", client ? previewClientSlug(client) : "likid");
    if (pathname !== destination) router.push(destination + window.location.search + window.location.hash);
    try { if (id) sessionStorage.setItem(storageKey, id); else sessionStorage.removeItem(storageKey); } catch { /* Preview still works without storage. */ }
  }
  return <PreviewContext.Provider value={{ available, clients, selected, select, admin, notice }}>{children}<ClientPreviewToolbar /></PreviewContext.Provider>;
}

function ClientPreviewToolbar() {
  const pathname = usePathname();
  const { available } = useContext(PreviewContext);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!available) return;
    const container = document.createElement("div");
    container.className = "client-preview-slot";
    let mounted = false;
    const position = () => {
      const header = document.querySelector("main > header");
      if (!header) return;
      if (header.nextElementSibling !== container) header.insertAdjacentElement("afterend", container);
      if (!mounted) { mounted = true; setTarget(container); }
    };
    const observer = new MutationObserver(position);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = requestAnimationFrame(position);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); container.remove(); };
  }, [available, pathname]);
  if (!available || !target || !target.isConnected) return null;
  return createPortal(<aside className="client-preview-toolbar" aria-label="Vista previa de clientes"><span className="client-preview-toolbar-title">Vista de cliente</span><ClientPreviewSelector /></aside>, target);
}

export function ClientPreviewSelector() {
  const pathname = usePathname();
  const { available, clients, selected, select, admin, notice } = useContext(PreviewContext);
  if (!available) return null;
  return <div className="client-preview-control">
    <div className="client-preview-pill" title={notice || "Previsualizar la identidad visual de un cliente"}>
      {selected?.logo ? <img src={selected.logo} alt="" width={22} height={22} /> : <span aria-hidden="true">◉</span>}
      <label><span className="client-preview-label">Clientes</span><select aria-label="Vista previa de cliente" value={selected?.id ?? ""} onChange={event => select(event.target.value)}>
        <option value="">Vista general · LIKID</option>
        {clients.some(client => !client.demo) && <optgroup label="Clientes registrados">{clients.filter(client => !client.demo).map(client => <option value={client.id} key={client.id}>{client.name} · {client.category}</option>)}</optgroup>}
        <optgroup label="Opciones de prueba">{clients.filter(client => client.demo).map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</optgroup>
      </select></label>
      {selected && <button type="button" aria-label="Salir de la vista previa" title="Volver a la vista general" onClick={() => select("")}>×</button>}
    </div>
    {selected && <div className="client-preview-caption" role="status"><span>Vista previa visual{selected.demo ? " · prueba" : ""}</span>{selected.href && <Link href={scopedSportHref(selected.href, pathname)}>Abrir portal ↗</Link>}</div>}
    {!selected && notice && <span className="client-preview-caption" role="status">Opciones de prueba</span>}
    {admin && <Link className="client-preview-manage" href="/clientes" title="Gestionar clientes">Gestionar clientes</Link>}
  </div>;
}

