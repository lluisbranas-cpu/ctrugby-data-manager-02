"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ClubMapEntry = {
  id: string;
  name: string;
  city: string;
  province: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  active: boolean;
  player_count?: number;
  participation_count?: number;
  maps_url?: string;
  website?: string | null;
  instagram?: string | null;
  teams?: { name: string; category: string; league: string }[];
};

type LeafletMap = { setView: (center: [number, number], zoom: number) => LeafletMap; fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => LeafletMap; invalidateSize: () => void };
type LeafletLayer = { addTo: (map: LeafletMap | LeafletLayer) => LeafletLayer; clearLayers: () => void };
type LeafletMarker = { bindPopup: (content: string, options?: { maxWidth?: number }) => LeafletMarker; addTo: (layer: LeafletLayer) => LeafletMarker; on: (event: string, listener: () => void) => LeafletMarker; openPopup: () => LeafletMarker };
type LeafletApi = {
  map: (node: HTMLElement, options?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options: Record<string, unknown>) => LeafletLayer;
  layerGroup: () => LeafletLayer;
  marker: (position: [number, number], options: Record<string, unknown>) => LeafletMarker;
  divIcon: (options: Record<string, unknown>) => unknown;
  latLngBounds: (positions: [number, number][]) => unknown;
};
type LeafletWindow = Window & { L?: LeafletApi };

let leafletLoader: Promise<void> | null = null;

function loadLeaflet() {
  if ((window as LeafletWindow).L) return Promise.resolve();
  if (leafletLoader) return leafletLoader;
  leafletLoader = new Promise((resolve, reject) => {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(stylesheet);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se ha podido cargar el mapa."));
    document.head.appendChild(script);
  });
  return leafletLoader;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function ClubFinderMap({ clubs, selectedId, onSelect, includeAllClubs = false, compact = false, countLabel = "jugadores" }: {
  clubs: ClubMapEntry[];
  selectedId?: string | null;
  onSelect?: (club: ClubMapEntry) => void;
  includeAllClubs?: boolean;
  compact?: boolean;
  countLabel?: string;
}) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletLayer | null>(null);
  const onSelectRef = useRef(onSelect);
  const [loadedClubs, setLoadedClubs] = useState<ClubMapEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const onlyCtrugby = false;
  const [error, setError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const source = includeAllClubs && loadedClubs ? loadedClubs : clubs;
  const searchValue = query;

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!includeAllClubs) return;
    void fetch("/api/clubs", { cache: "no-store" }).then((response) => response.json()).then((result: unknown) => {
      const rows = (result as { clubs?: unknown }).clubs;
      if (!Array.isArray(rows)) return;
      setLoadedClubs(rows.filter((item): item is ClubMapEntry => {
        const club = item as Partial<ClubMapEntry>;
        return typeof club.id === "string" && typeof club.name === "string" && typeof club.city === "string" && typeof club.province === "string" && typeof club.region === "string" && typeof club.country === "string" && typeof club.latitude === "number" && typeof club.longitude === "number" && typeof club.active === "boolean";
      }));
    }).catch(() => setLoadedClubs(null));
  }, [includeAllClubs]);
  useEffect(() => {
    let cancelled = false;
    void loadLeaflet().then(() => {
      const L = (window as LeafletWindow).L;
      if (cancelled || !L || !mapNode.current || mapRef.current) return;
      const map = L.map(mapNode.current, { scrollWheelZoom: true }).setView([40.1, -3.7], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      setMapReady(true);
    }).catch((loadError: unknown) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "No se ha podido cargar el mapa."); });
    return () => { cancelled = true; };
  }, []);

  const countries = useMemo(() => [...new Set(source.map((club) => club.country).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [source]);
  const regions = useMemo(() => [...new Set(source.filter((club) => !country || club.country === country).map((club) => club.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [country, source]);
  const provinces = useMemo(() => [...new Set(source.filter((club) => (!country || club.country === country) && (!region || club.region === region)).map((club) => club.province).filter((item) => item && item !== "—"))].sort((a, b) => a.localeCompare(b, "es")), [country, region, source]);
  const visible = useMemo(() => source.filter((club) => {
    const teamText = (club.teams ?? []).flatMap((team) => [team.name, team.category, team.league]).join(" ");
    const matchQuery = !searchValue || normalize([club.name, club.city, club.province, club.region, club.country, teamText].join(" ")).includes(normalize(searchValue));
    return matchQuery && (!country || club.country === country) && (!region || club.region === region) && (!province || club.province === province) && (!onlyCtrugby || (club.player_count ?? 0) > 0);
  }), [country, onlyCtrugby, province, region, searchValue, source]);

  useEffect(() => {
    const L = (window as LeafletWindow).L;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!L || !map || !layer) return;
    layer.clearLayers();
    const positions: [number, number][] = [];
    let selectedMarker: LeafletMarker | null = null;
    visible.forEach((club) => {
      const selected = club.id === selectedId;
      const represented = (club.player_count ?? 0) > 0;
      const icon = L.divIcon({ className: "", html: `<span class="club-finder-marker${represented ? " is-ctrugby" : ""}${selected ? " is-selected" : ""}"></span>`, iconSize: [25, 25], iconAnchor: [12, 12], popupAnchor: [0, -13] });
      const location = [club.city, club.province, club.country].filter((item) => item && item !== "—").join(" · ");
      const links = [club.maps_url ? `<a href="${escapeHtml(club.maps_url)}" target="_blank" rel="noreferrer">Ubicación</a>` : "", club.website ? `<a href="${escapeHtml(club.website)}" target="_blank" rel="noreferrer">Web</a>` : ""].filter(Boolean).join("");
      const teams = (club.teams ?? []).map((team) => `<span>${escapeHtml(team.category)} · ${escapeHtml(team.league)}</span>`).join("");
      const popup = `<article class="club-finder-popup"><h3>${escapeHtml(club.name)}</h3><p>${escapeHtml(location)}</p>${teams ? `<p class="club-finder-popup-teams">${teams}</p>` : ""}<span class="club-finder-status${represented ? " is-ctrugby" : ""}">${represented ? `Con ${escapeHtml(countLabel)} Rugby` : "Sin participación registrada"}</span>${represented ? `<strong>${club.player_count} ${escapeHtml(countLabel)}</strong>` : ""}<div>${links}</div></article>`;
      const marker = L.marker([club.latitude, club.longitude], { icon, title: club.name }).bindPopup(popup, { maxWidth: 310 }).on("click", () => onSelectRef.current?.(club)).addTo(layer);
      if (selected) selectedMarker = marker;
      positions.push([club.latitude, club.longitude]);
    });
    const selectedClub = visible.find((club) => club.id === selectedId);
    if (selectedClub) { map.setView([selectedClub.latitude, selectedClub.longitude], 13); (selectedMarker as LeafletMarker | null)?.openPopup(); }
    else if (positions.length) map.fitBounds(L.latLngBounds(positions), { padding: [30, 30], maxZoom: 9 });
    setTimeout(() => map.invalidateSize(), 0);
  }, [countLabel, mapReady, selectedId, visible]);

  const represented = visible.filter((club) => (club.player_count ?? 0) > 0);
  const total = represented.reduce((sum, club) => sum + (club.player_count ?? 0), 0);
  return <section className={`club-finder${compact ? " is-compact" : ""}`} aria-label={compact ? "Mapa de clubs filtrados" : "Buscador de clubs"}>{!compact && <div className="club-finder-toolbar"><label>Buscar club o ciudad<input type="search" value={searchValue} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: Alella, Santboiana…" /></label><label>País<select value={country} onChange={(event) => { setCountry(event.target.value); setRegion(""); setProvince(""); }}><option value="">Todos</option>{countries.map((item) => <option key={item}>{item}</option>)}</select></label><label>Comunidad / región<select value={region} onChange={(event) => { setRegion(event.target.value); setProvince(""); }}><option value="">Todas</option>{regions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Provincia<select value={province} onChange={(event) => setProvince(event.target.value)}><option value="">Todas</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select></label></div>}<div className="club-finder-summary">{compact ? <div className="club-finder-map-title"><strong>MAPA DE CLUBS FILTRADOS</strong><span>Ubicación de los clubs que aparecen en el listado actual</span></div> : <span>Clubs del cliente</span>}<div><b>{visible.length}</b> clubs {compact ? <><b>{total}</b> {countLabel}</> : <><b>{represented.length}</b> representados <b>{total}</b> {countLabel}</>}</div></div><div ref={mapNode} className="club-finder-leaflet" aria-label="Mapa interactivo de clubs" />{error ? <p className="club-finder-message">{error}</p> : <p className="club-finder-message">{visible.length ? `Mostrando ${visible.length} clubs del filtro actual.` : "No hay clubs con ubicación disponible para este filtro."}</p>}</section>;
}
