"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "@/app/components/sport-link";
import styles from "./federation-filters.module.css";
import { ExternalLink, Globe, Pencil, Save } from "lucide-react";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/lib/sport-navigation";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldAtlas from "world-atlas/countries-50m.json";
import { FederationDirectoryCoverActions } from "@/app/components/federation-directory-cover-actions";
import { regionalRugbyAssociations } from "@/lib/regional-rugby-associations";
import {
  regionalMembershipStatus,
  regionalMembershipSuspended,
} from "@/lib/regional-rugby-membership";

type Federation = {
  id: string;
  name: string;
  scope: string;
  territory: string;
  country: string;
  active: boolean;
  website: string | null;
  published?: boolean;
  version?: number;
  has_shield: boolean;
  player_count: number | null;
  participation_count: number | null;
  staff_count?: number | null;
  club_count: number;
  ctrugby_club_count?: number | null;
  world_rugby_affiliation?: "miembro" | "no_miembro" | "no_aplica" | "pendiente";
  regional_association_ids?: string[];
};
type CountryMetric = {
  country: string;
  player_count: number | null;
  participation_count: number | null;
  club_count: number;
  ctrugby_club_count?: number | null;
};
type State = {
  configured: boolean;
  admin?: boolean;
  federations: Federation[];
  associated_player_count?: number | null;
  national_associated_player_count?: number | null;
  territorial_associated_player_count?: number | null;
  world_rugby_associated_player_count?: number | null;
  territoryStats?: {
    regions: number;
    ctrugbyRegions?: number;
    national: number;
    ctrugbyNational?: number;
  };
  countryMetrics?: CountryMetric[];
};
type CountryRow = {
  country: string;
  players: number;
  participations: number;
  clubs: number;
  federation?: Federation;
};
type RegionRow = {
  region: string;
  players: number;
  participations: number;
  clubs: number;
  federation?: Federation;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES");
const displayCountry = (country: string) =>
  ({ France: "Francia", Singapore: "Singapur" })[country] ?? country;
const mapCountryName = (country: string) =>
  ({
    España: "Spain",
    México: "Mexico",
    Francia: "France",
    Brasil: "Brazil",
    Perú: "Peru",
    Panamá: "Panama",
    Singapur: "Singapore",
    "Países Bajos": "Netherlands",
    "Nueva Zelanda": "New Zealand",
    "Estados Unidos": "United States of America",
    Sudáfrica: "South Africa",
    Bélgica: "Belgium",
    Canadá: "Canada",
    "Costa de Marfil": "Côte d'Ivoire",
    "Cabo Verde": "Cape Verde",
    "República Centroafricana": "Central African Rep.",
    "República Democrática del Congo": "Dem. Rep. Congo",
    "República del Congo": "Congo",
    "Congo (República del Congo)": "Congo",
    Esuatini: "eSwatini",
    "Guinea Ecuatorial": "Eq. Guinea",
    Malaui: "Malawi",
    Níger: "Niger",
    Benín: "Benin",
    Túnez: "Tunisia",
    Argelia: "Algeria",
    Botsuana: "Botswana",
    Camerún: "Cameroon",
    Etiopía: "Ethiopia",
    Gabón: "Gabon",
    Kenia: "Kenya",
    Mauricio: "Mauritius",
    Marruecos: "Morocco",
    Mozambique: "Mozambique",
    Ruanda: "Rwanda",
    Sudán: "Sudan",
    Tanzania: "Tanzania",
    Zimbabue: "Zimbabwe",
    Bielorrusia: "Belarus",
    Alemania: "Germany",
    Austria: "Austria",
    "Bosnia y Herzegovina": "Bosnia and Herz.",
    Chipre: "Cyprus",
    Dinamarca: "Denmark",
    Eslovaquia: "Slovakia",
    Eslovenia: "Slovenia",
    Grecia: "Greece",
    Hungría: "Hungary",
    Inglaterra: "United Kingdom",
    Escocia: "United Kingdom",
    Gales: "United Kingdom",
    Letonia: "Latvia",
    Moldavia: "Moldova",
    Mónaco: "Monaco",
    Noruega: "Norway",
    "República Checa": "Czechia",
    Rusia: "Russia",
    Suecia: "Sweden",
    Suiza: "Switzerland",
    Turquía: "Turkey",
    Ucrania: "Ukraine",
    "Arabia Saudita": "Saudi Arabia",
    "Arabia Saudí": "Saudi Arabia",
    Bangladés: "Bangladesh",
    Baréin: "Bahrain",
    Brunéi: "Brunei",
    Catar: "Qatar",
    "China Taipéi": "Taiwan",
    "Corea del Sur": "South Korea",
    "Emiratos Árabes Unidos": "United Arab Emirates",
    Filipinas: "Philippines",
    Irán: "Iran",
    Japón: "Japan",
    Jordania: "Jordan",
    Kazajistán: "Kazakhstan",
    Kirguistán: "Kyrgyzstan",
    Líbano: "Lebanon",
    Malasia: "Malaysia",
    Mongolia: "Mongolia",
    Omán: "Oman",
    Siria: "Syria",
    Tailandia: "Thailand",
    Uzbekistán: "Uzbekistan",
    Bermudas: "Bermuda",
    Curazao: "Curaçao",
    "Islas Caimán": "Cayman Is.",
    "Islas Turcas y Caicos": "Turks and Caicos Is.",
    "Islas Vírgenes Británicas": "British Virgin Is.",
    "República Dominicana": "Dominican Rep.",
    "San Vicente y las Granadinas": "St. Vin. and Gren.",
    "Islas Salomón": "Solomon Is.",
    "Islas Cook": "Cook Is.",
    "Samoa Americana": "American Samoa",
  })[country] ?? country;

function WorldMap({ countries }: { countries: string[] }) {
  return (
    <section
      className="player-world-map"
      aria-label="Mapamundi de federaciones"
    >
      <header>
        <div>
          <p>MAPAMUNDI</p>
          <span>Países de las federaciones visibles</span>
        </div>
      </header>
      <ComposableMap width={800} height={400} projectionConfig={{ scale: 155 }}>
        <Geographies geography={worldAtlas as never}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const active = countries.some(
                (country) =>
                  mapCountryName(country) ===
                  String(geo.properties?.name ?? ""),
              );
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  className={
                    active ? "player-map-country active" : "player-map-country"
                  }
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
      <p className="player-map-legend">
        {countries.length} país{countries.length === 1 ? "" : "es"} con
        federaciones
      </p>
    </section>
  );
}

function Shield({ federation }: { federation?: Federation }) {
  const src = federation?.has_shield
    ? federationShieldUrl(federation.id)
    : null;
  return (
    <span className="country-directory-shield image-hover-preview">
      {src ? (
        <Link href={`/federaciones/${federation!.id}`}>
          <img
            src={src}
            alt={`Escudo de ${federation!.name}`}
            className="image-hover-preview-image"
          />
        </Link>
      ) : (
        "—"
      )}
    </span>
  );
}

function CountryDirectory({
  rows,
  onClose,
}: {
  rows: CountryRow[];
  onClose: () => void;
}) {
  const [sort, setSort] = useState<{
    key: "players" | "participations" | "shield" | "country" | "clubs";
    direction: 1 | -1;
  }>({ key: "players", direction: -1 });
  const ordered = [...rows].sort(
    (a, b) =>
      (sort.key === "country"
        ? a.country.localeCompare(b.country, "es")
        : sort.key === "shield"
          ? Number(a.federation?.has_shield ?? false) -
            Number(b.federation?.has_shield ?? false)
          : a[sort.key] - b[sort.key]) * sort.direction ||
      a.country.localeCompare(b.country, "es"),
  );
  const order = (key: typeof sort.key) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? ((current.direction * -1) as 1 | -1)
          : key === "country"
            ? 1
            : -1,
    }));
  const mark = (key: typeof sort.key) =>
    sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  return (
    <section
      className="country-directory"
      aria-label="Listado de federaciones nacionales"
    >
      <header>
        <div>
          <b>FED. NACIONALES</b>
          <small>
            JUG: jugadores únicos desde 2023 · PART: total participaciones Rugby
            desde 2023.
          </small>
        </div>
        <button type="button" aria-label="Cerrar listado" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="country-directory-head">
        <button onClick={() => order("players")}>JUG. {mark("players")}</button>
        <button onClick={() => order("participations")}>
          PART. {mark("participations")}
        </button>
        <button
          type="button"
          onClick={() => order("shield")}
          title="Ordenar por escudo: con escudo o sin escudo"
          aria-label={`Ordenar por escudo. ${sort.key === "shield" ? (sort.direction === -1 ? "Primero con escudo" : "Primero sin escudo") : "Sin ordenar"}`}
        >
          ESCUDO {mark("shield")}
        </button>
        <button className="text-left" onClick={() => order("country")}>
          PAÍS {mark("country")}
        </button>
        <button className="text-left" onClick={() => order("clubs")}>
          CLUBS {mark("clubs")}
        </button>
      </div>
      <ul>
        {ordered.map((row) => (
          <li key={row.country}>
            <span className="country-directory-count players">
              {row.players}
            </span>
            <span className="country-directory-count">
              {row.participations}
            </span>
            <Shield federation={row.federation} />
            {row.federation ? (
              <Link
                href={`/federaciones/${row.federation.id}`}
                className="font-bold hover:text-red-700"
              >
                {row.country}
              </Link>
            ) : (
              <b>{row.country}</b>
            )}
            <span className="country-directory-count">{row.clubs}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RegionDirectory({
  rows,
  onClose,
}: {
  rows: RegionRow[];
  onClose: () => void;
}) {
  const [sort, setSort] = useState<{
    key: "players" | "participations" | "shield" | "region" | "clubs";
    direction: 1 | -1;
  }>({ key: "players", direction: -1 });
  const ordered = [...rows].sort(
    (a, b) =>
      (sort.key === "region"
        ? a.region.localeCompare(b.region, "es")
        : sort.key === "shield"
          ? Number(a.federation?.has_shield ?? false) -
            Number(b.federation?.has_shield ?? false)
          : a[sort.key] - b[sort.key]) * sort.direction ||
      a.region.localeCompare(b.region, "es"),
  );
  const order = (key: typeof sort.key) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? ((current.direction * -1) as 1 | -1)
          : key === "region"
            ? 1
            : -1,
    }));
  const mark = (key: typeof sort.key) =>
    sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  return (
    <section
      className="region-directory"
      aria-label="Listado de federaciones autonómicas"
    >
      <header>
        <div>
          <b>FED. AUTONÓMICAS</b>
          <small>
            JUG: jugadores únicos desde 2023 · PART: total participaciones Rugby
            desde 2023.
          </small>
        </div>
        <button type="button" aria-label="Cerrar listado" onClick={onClose}>
          ×
        </button>
      </header>
      <div className="region-directory-head">
        <button onClick={() => order("players")}>JUG. {mark("players")}</button>
        <button onClick={() => order("participations")}>
          PART. {mark("participations")}
        </button>
        <button
          type="button"
          onClick={() => order("shield")}
          title="Ordenar por escudo: con escudo o sin escudo"
          aria-label={`Ordenar por escudo. ${sort.key === "shield" ? (sort.direction === -1 ? "Primero con escudo" : "Primero sin escudo") : "Sin ordenar"}`}
        >
          ESCUDO {mark("shield")}
        </button>
        <button className="text-left" onClick={() => order("region")}>
          FEDERACIÓN {mark("region")}
        </button>
        <button className="text-left" onClick={() => order("clubs")}>
          CLUBS {mark("clubs")}
        </button>
      </div>
      <ul>
        {ordered.map((row) => (
          <li key={row.region}>
            <span className="players">{row.players}</span>
            <span>{row.participations}</span>
            <Shield federation={row.federation} />
            {row.federation ? (
              <Link
                href={`/federaciones/${row.federation.id}`}
                className="font-bold hover:text-red-700"
              >
                {row.region}
              </Link>
            ) : (
              <b>{row.region}</b>
            )}
            <span>{row.clubs}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const adminInput =
  "w-full rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 outline-none focus:border-red-500 disabled:bg-neutral-50 disabled:text-neutral-600";

function AdminFederationsTable({
  federations,
  onReload,
}: {
  federations: Federation[];
  onReload: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveFederation(
    event: FormEvent<HTMLFormElement>,
    federation: Federation,
  ) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(
        `/api/federaciones/${encodeURIComponent(federation.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.get("name"),
            scope: form.get("scope"),
            territory: form.get("territory"),
            country: form.get("country"),
            active: form.get("active") === "true",
            website: form.get("website"),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "No se ha podido guardar la federación.",
        );
      setEditingId(null);
      setNotice("Federación guardada.");
      await onReload();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se ha podido guardar la federación.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function togglePublication(federation: Federation) {
    if (!federation.version) {
      setNotice("Recarga antes de cambiar la publicación.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/catalogos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-publication",
          kind: "federation",
          id: federation.id,
          published: !federation.published,
          version: federation.version,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "No se ha podido cambiar la publicación.",
        );
      setNotice(
        federation.published
          ? "Federación retirada del directorio."
          : "Federación publicada.",
      );
      await onReload();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se ha podido cambiar la publicación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 rounded-2xl bg-white shadow-sm">
      <header className="federation-directory-title">
        <div>
          <b>ADMIN · TABLA DE FEDERACIONES</b>
          <small>
            Edita datos maestros, publicación y acceso a fichas desde la misma
            pantalla.
          </small>
        </div>
        <Link
          href="/api/federaciones/hoja"
          download="ctrugby-federaciones.xlsx"
          className="rounded-[8px] border border-neutral-300 bg-white px-3 py-2 text-xs font-black text-neutral-700 hover:border-red-200 hover:text-red-700"
        >
          Excel
        </Link>
      </header>
      {notice && (
        <p className="catalog-notice mx-3" role="status">
          {notice}
        </p>
      )}
      <div className="overflow-x-auto">
        <div className="grid min-w-[1120px] grid-cols-[58px_88px_minmax(220px,1.2fr)_132px_150px_132px_minmax(190px,1fr)_92px_104px_96px] gap-2 border-y border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500">
          <span>ESC.</span>
          <span>ID</span>
          <span>NOMBRE</span>
          <span>ÁMBITO</span>
          <span>TERRITORIO</span>
          <span>PAÍS</span>
          <span>WEB</span>
          <span>ACTIVA</span>
          <span>PUBLICADA</span>
          <span>ACCIONES</span>
        </div>
        <ul className="min-w-[1120px] divide-y divide-neutral-200">
          {federations.map((federation) => {
            const isEditing = editingId === federation.id;
            return (
              <li key={federation.id}>
                <form
                  onSubmit={(event) => void saveFederation(event, federation)}
                  className="grid grid-cols-[58px_88px_minmax(220px,1.2fr)_132px_150px_132px_minmax(190px,1fr)_92px_104px_96px] items-center gap-2 px-3 py-2"
                >
                  <Link
                    href={`/federaciones/${federation.id}/editar`}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100"
                    title={`Editar escudo de ${federation.name}`}
                  >
                    <img
                      src={
                        federationShieldUrl(federation.id) ??
                        `/api/federaciones/escudo/${federation.id}`
                      }
                      alt={`Escudo de ${federation.name}`}
                      className="h-9 w-9 object-contain"
                    />
                  </Link>
                  <span className="text-xs font-black text-neutral-500">
                    {federation.id}
                  </span>
                  <input
                    name="name"
                    defaultValue={federation.name}
                    disabled={!isEditing}
                    className={adminInput}
                    required
                  />
                  <select
                    name="scope"
                    defaultValue={federation.scope}
                    disabled={!isEditing}
                    className={adminInput}
                  >
                    <option>Nacional</option>
                    <option>Territorial</option>
                  </select>
                  <input
                    name="territory"
                    defaultValue={federation.territory}
                    disabled={!isEditing}
                    className={adminInput}
                    required
                  />
                  <input
                    name="country"
                    defaultValue={federation.country}
                    disabled={!isEditing}
                    className={adminInput}
                    required
                  />
                  <input
                    name="website"
                    defaultValue={federation.website ?? ""}
                    disabled={!isEditing}
                    className={adminInput}
                    placeholder="https://..."
                  />
                  <select
                    name="active"
                    defaultValue={federation.active ? "true" : "false"}
                    disabled={!isEditing}
                    className={adminInput}
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void togglePublication(federation)}
                    className={`rounded-[8px] border px-3 py-2 text-xs font-black disabled:opacity-50 ${federation.published ? "border-green-200 bg-green-50 text-green-800" : "border-neutral-300 bg-white text-neutral-700"}`}
                  >
                    {federation.published ? "Publicada" : "Pendiente"}
                  </button>
                  <span className="flex gap-1">
                    {isEditing ? (
                      <button
                        disabled={busy}
                        className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-red-200 text-red-700 hover:bg-red-50"
                        aria-label={`Guardar ${federation.name}`}
                        title={`Guardar ${federation.name}`}
                      >
                        <Save size={15} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditingId(federation.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700"
                        aria-label={`Editar ${federation.name}`}
                        title={`Editar ${federation.name}`}
                      >
                        <Pencil size={15} aria-hidden="true" />
                      </button>
                    )}
                    <Link
                      href={`/federaciones/${federation.id}`}
                      className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-neutral-300 text-neutral-700 hover:border-red-300 hover:text-red-700"
                      aria-label={`Abrir ${federation.name}`}
                      title={`Abrir ${federation.name}`}
                    >
                      <ExternalLink size={15} aria-hidden="true" />
                    </Link>
                  </span>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FederationsContent() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [query, setQuery] = useState("");
  const [scope] = useState<"ctrugby" | "all">("all");
  const [personFilter, setPersonFilter] = useState<"all" | "players" | "staff">("all");
  const [regionalAssociationFilter, setRegionalAssociationFilter] = useState<string | null>(null);
  const [membershipFilter, setMembershipFilter] = useState<
    "all" | "Miembro pleno" | "Asociado"
  >("all");
  const [regionalShields, setRegionalShields] = useState<Record<string, string>>({});
  const [view, setView] = useState<"federations" | "countries" | "regions" | "world-rugby">(
    () => "federations",
  );
  const [sort, setSort] = useState<{
    key: "players" | "participations" | "staff" | "shield" | "name" | "clubs";
    direction: 1 | -1;
  }>({ key: "players", direction: -1 });
  const [directoryCoverVersion, setDirectoryCoverVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/federaciones", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((data) => {
        if (!controller.signal.aborted) setState(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  useEffect(() => {
    setRegionalShields(Object.fromEntries(regionalRugbyAssociations.map((association) => [association.id, localStorage.getItem(`ctrugby-regional-shield-${association.code}`) ?? ""])));
  }, []);
  const federations = useMemo(
    () =>
      (state?.federations ?? [])
        .filter((federation) => federation.scope === "Nacional")
        .filter((federation) => scope === "all" || (personFilter === "staff" ? (federation.staff_count ?? 0) > 0 : (federation.player_count ?? 0) > 0))
        .filter((federation) => personFilter === "all" || (personFilter === "players" ? (federation.player_count ?? 0) > 0 : (federation.staff_count ?? 0) > 0))
        .filter(
          (federation) =>
            view !== "world-rugby" || federation.world_rugby_affiliation === "miembro",
        )
        .filter(
          (federation) =>
            !regionalAssociationFilter || federation.regional_association_ids?.includes(regionalAssociationFilter),
        )
        .filter(
          (federation) =>
            membershipFilter === "all" ||
            regionalMembershipStatus(
              federation.regional_association_ids?.[0],
              federation.country,
            ) === membershipFilter,
        )
        .filter(
          (federation) =>
            !query ||
            [federation.name, federation.territory, federation.country]
              .join(" ")
              .toLocaleLowerCase("es-ES")
              .includes(query.toLocaleLowerCase("es-ES")),
        )
        .sort((a, b) => {
          const value =
            sort.key === "shield"
              ? Number(a.has_shield) - Number(b.has_shield)
              : sort.key === "players"
                ? (a.player_count ?? 0) - (b.player_count ?? 0)
                : sort.key === "participations"
                  ? (a.participation_count ?? 0) - (b.participation_count ?? 0)
                  : sort.key === "staff"
                    ? (a.staff_count ?? 0) - (b.staff_count ?? 0)
                  : sort.key === "clubs"
                    ? a.club_count - b.club_count
                    : a.name.localeCompare(b.name, "es");
          return value * sort.direction || a.name.localeCompare(b.name, "es");
        }),
    [state, query, scope, personFilter, sort, view, regionalAssociationFilter, membershipFilter],
  );
  const countryRows = useMemo(
    () =>
      (state?.countryMetrics ?? [])
        .filter((row) => scope === "all" || (row.player_count ?? 0) > 0)
        .map((row) => {
          const federation = state?.federations.find(
            (item) =>
              item.scope === "Nacional" &&
              normalize(item.country) === normalize(row.country),
          );
          return {
            country: displayCountry(row.country),
            players: row.player_count ?? 0,
            participations: row.participation_count ?? 0,
            clubs:
              scope === "ctrugby"
                ? (federation?.ctrugby_club_count ?? 0)
                : row.club_count,
            federation,
          };
        }),
    [state, scope],
  );
  const regionRows = useMemo(
    () =>
      (state?.federations ?? [])
        .filter(
          (federation) =>
            federation.scope === "Territorial" &&
            normalize(federation.country) === "espana" &&
            (scope === "all" || (federation.player_count ?? 0) > 0),
        )
        .map((federation) => ({
          region: federation.territory,
          players: federation.player_count ?? 0,
          participations: federation.participation_count ?? 0,
          clubs:
            scope === "ctrugby"
              ? (federation.ctrugby_club_count ?? 0)
              : federation.club_count,
          federation,
        })),
    [state, scope],
  );
  const order = (key: typeof sort.key) =>
    setSort((current) => ({
      key,
      direction:
        current.key === key
          ? ((current.direction * -1) as 1 | -1)
          : key === "name"
            ? 1
            : -1,
    }));
  const mark = (key: typeof sort.key) =>
    sort.key !== key ? "↕" : sort.direction === 1 ? "↑" : "↓";
  const countries = Array.from(
    new Set(federations.map((federation) => federation.country)),
  );
  const scopeFederationCount =
    scope === "ctrugby"
      ? (state?.federations ?? []).filter(
          (federation) => federation.scope === "Nacional" && (federation.player_count ?? 0) > 0,
        ).length
      : (state?.federations ?? []).filter((federation) => federation.scope === "Nacional").length;
  const worldRugbyFederationCount = (state?.federations ?? []).filter(
    (federation) => federation.world_rugby_affiliation === "miembro",
  ).length;
  const worldRugbyPlayerCountSum = (state?.federations ?? []).filter(
    (federation) => federation.world_rugby_affiliation === "miembro",
  ).reduce((total, federation) => total + (federation.player_count ?? 0), 0);
  const worldRugbyPlayerCount =
    state?.world_rugby_associated_player_count ?? worldRugbyPlayerCountSum;
  return (
    <main className="directory-app">
      <header className="catalog-topbar">
        <Link href="/" className="catalog-brand">
          <Image
            src="/ctrugby-logo-contrast.webp"
            alt="CTRugby"
            width={100}
            height={54}
            priority
          />
          <span>
            <strong>RUGBY - HUB</strong>
          </span>
        </Link>
        <ManagerMenu current="federations" />
      </header>
      <section
        className="directory-cover"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(250,251,251,.98) 0%, rgba(250,251,251,.92) 50%, rgba(250,251,251,.58) 100%), url(/api/federaciones/portada/directorio?v=${directoryCoverVersion})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {state?.admin && (
          <>
            <a
              href="/api/federaciones/hoja"
              download="ctrugby-federaciones.xlsx"
              className="federation-excel-action"
              title="Descargar base de datos en Excel"
              aria-label="Descargar base de datos de federaciones en Excel"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="m8 12 4 5M12 12l-4 5M15 13h2M15 17h2" />
              </svg>
            </a>
            <FederationDirectoryCoverActions
              onUpdated={() => setDirectoryCoverVersion(Date.now())}
            />
          </>
        )}
        <div className="directory-cover-copy">
          <p>
            <i className="ctrugby-marker" />
            <b>Rugby</b>
            <i />
            DIRECTORIO DE FEDERACIONES NACIONALES
          </p>
          <h1>
            FEDERACIONES NACIONALES
            {scope === "ctrugby" && (
              <strong className="ctrugby-title">RUGBY</strong>
            )}
          </h1>
          <span>Federaciones nacionales y rugby</span>
        </div>
        <div className="directory-cover-actions">
          <Link href={state?.admin ? "/catalogos?tipo=federation" : "/login"}>
            {state?.admin
              ? "+Añadir federaciones"
              : "Iniciar sesión para añadir"}
          </Link>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-5 pb-8 pt-2 sm:px-8">
        {state && (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-6 sm:gap-3">
              <button
                onClick={() => { setView("federations"); setRegionalAssociationFilter(null); }}
                className={`order-1 min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:col-span-3 sm:rounded-2xl sm:p-5 ${view === "federations" ? "ring-2 ring-red-600" : ""}`}
              >
                <span className="block truncate text-[10px] font-semibold text-neutral-500 sm:text-sm">
                  Federaciones Nacionales
                </span>
                <span className="mt-1 flex items-center gap-2 sm:mt-2">
                  <Globe
                    aria-hidden="true"
                    className="h-10 w-10 shrink-0 text-red-700 sm:h-12 sm:w-12"
                    strokeWidth={1.5}
                  />
                  <b className="text-2xl sm:text-3xl">{scopeFederationCount}</b>
                </span>
                <span className="mt-1 block text-xs font-semibold text-neutral-600">
                  {state.national_associated_player_count ?? "—"} Jug. asociados
                </span>
              </button>
              {regionalRugbyAssociations.map((association) => {
                const associationFederations = state.federations.filter((federation) => federation.regional_association_ids?.includes(association.id));
                const count = associationFederations.length;
                const players = associationFederations.reduce((total, federation) => total + (federation.player_count ?? 0), 0);
                const active = view === "federations" && regionalAssociationFilter === association.id;
                return <button key={association.id} onClick={() => { setView("federations"); setRegionalAssociationFilter((current) => current === association.id ? null : association.id); }} className={`order-3 min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:col-span-1 sm:rounded-2xl sm:p-5 ${active ? "ring-2 ring-red-600" : ""}`}>
                  <span className="block min-w-0"><span className="block min-h-8 whitespace-normal text-[11px] font-semibold leading-4 text-neutral-500 sm:text-sm">{association.name}</span><span className="mt-1 flex items-center gap-2"><span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden text-xs font-black text-red-700">{regionalShields[association.id] ? <img src={regionalShields[association.id]} alt={`Escudo de ${association.name}`} className="h-full w-full object-contain" /> : association.acronym}</span><b className="text-2xl sm:text-3xl">{count}</b></span><span className="mt-1 block text-xs font-semibold text-neutral-600">{players} Jug. asociados</span></span>
                </button>;
              })}
              <button
                onClick={() => { setView("world-rugby"); setRegionalAssociationFilter(null); }}
                className={`order-2 min-w-0 rounded-xl bg-white p-3 text-left shadow-sm sm:col-span-3 sm:rounded-2xl sm:p-5 ${view === "world-rugby" ? "ring-2 ring-red-600" : ""}`}
              >
                <span className="block text-[10px] font-semibold text-neutral-500 sm:text-sm">
                  Fed. World Rugby
                </span>
                <span className="mt-1 flex items-center gap-2 sm:mt-2">
                  <img
                    src="/world-rugby-logo.png"
                    alt="Escudo de World Rugby"
                    className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
                  />
                  <b className="text-2xl sm:text-3xl">{worldRugbyFederationCount}</b>
                </span>
                <span className="mt-1 block text-xs font-semibold text-neutral-600">
                  {worldRugbyPlayerCount} Jug. asociados
                </span>
              </button>
            </section>
            <p className="mt-2 text-xs text-neutral-500">
              {scope === "ctrugby"
                ? "Entidades con al menos una participación Rugby."
                : "Todos activo: los contadores y listados incluyen todas las federaciones publicadas."}
            </p>
            <div className={`directory-filter-toolbar ${styles.toolbar}`}>
              <div className="directory-scope-toggle" aria-label="Filtrar por tipo de integrante">
                {([['all', 'Todos'], ['players', 'Jugadores'], ['staff', 'Staff']] as const).map(([value, label]) => <button key={value} type="button" className={personFilter === value ? "selected" : ""} onClick={() => setPersonFilter(value)}>{label}</button>)}
              </div>
              <div className="directory-scope-toggle" aria-label="Filtrar por estatus regional">
                {[
                  ["all", "Todos"],
                  ["Miembro pleno", "Miembro pleno"],
                  ["Asociado", "Asociado"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={membershipFilter === value ? "selected" : ""}
                    onClick={() =>
                      setMembershipFilter(
                        value as "all" | "Miembro pleno" | "Asociado",
                      )
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              <label className="directory-search">
                <span>⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por federación o territorio…"
                />
              </label>
            </div>
            {view === "countries" ? (
              <div className="directory-geo-layout">
                <CountryDirectory
                  rows={countryRows}
                  onClose={() => setView("federations")}
                />
                <WorldMap countries={countryRows.map((row) => row.country)} />
              </div>
            ) : view === "regions" ? (
              <div className="directory-geo-layout">
                <RegionDirectory
                  rows={regionRows}
                  onClose={() => setView("federations")}
                />
                <WorldMap countries={["España"]} />
              </div>
            ) : (
              <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.75fr)]">
                <section className="overflow-visible rounded-2xl bg-white shadow-sm">
                  <header className="federation-directory-title">
                    <div>
                      <b>{view === "world-rugby" ? "FEDERACIONES WORLD RUGBY" : "FEDERACIONES"}</b>
                      <small>
                        JUG: jugadores únicos desde 2023 · PART: total
                        participaciones Rugby desde 2023. Se contabilizan los
                        jugadores que han jugado en equipos de cada federación.
                      </small>
                    </div>
                  </header>
                  <div className="directory-list-heading federation-directory-head grid grid-cols-[52px_52px_52px_64px_minmax(0,1fr)_48px_36px] border-y border-neutral-200 bg-neutral-50 px-3 py-3 text-[10px] font-black tracking-[.12em] text-neutral-500">
                    <button onClick={() => order("players")}>
                      JUG. {mark("players")}
                    </button>
                    <button onClick={() => order("staff")}>
                      STAFF {mark("staff")}
                    </button>
                    <button onClick={() => order("participations")}>
                      PART. {mark("participations")}
                    </button>
                    <button
                      type="button"
                      onClick={() => order("shield")}
                      title="Ordenar por escudo: con escudo o sin escudo"
                      aria-label={`Ordenar por escudo. ${sort.key === "shield" ? (sort.direction === -1 ? "Primero con escudo" : "Primero sin escudo") : "Sin ordenar"}`}
                    >
                      ESCUDO {mark("shield")}
                    </button>
                    <button className="text-left" onClick={() => order("name")}>
                      FEDERACIÓN {mark("name")}
                    </button>
                    <button
                      className="text-left"
                      onClick={() => order("clubs")}
                    >
                      CLUBS {mark("clubs")}
                    </button>
                    <span aria-hidden="true" />
                  </div>
                  <ul className="divide-y divide-neutral-200">
                    {federations.map((federation) => (
                      <li key={federation.id}>
                        <button
                          onDoubleClick={() =>
                            router.push(`/federaciones/${federation.id}`)
                          }
                          className="grid w-full grid-cols-[52px_52px_52px_64px_minmax(0,1fr)_48px_36px] items-center px-3 py-[15px] text-left hover:bg-neutral-50"
                        >
                          <span className="text-center text-lg text-red-600">
                            {federation.player_count ?? "—"}
                          </span>
                          <span className="text-center text-lg">
                            {federation.staff_count ?? "—"}
                          </span>
                          <span className="text-center text-lg">
                            {federation.participation_count ?? "—"}
                          </span>
                          <Shield federation={federation} />
                          <Link
                            href={`/federaciones/${federation.id}`}
                            className="font-bold hover:text-red-700"
                          >
                            {federation.name}
                            <small className="block font-normal text-neutral-500">
                              {federation.scope === "Territorial"
                                ? federation.territory
                                : [
                                    displayCountry(federation.country),
                                    regionalMembershipStatus(
                                      federation.regional_association_ids?.[0],
                                      federation.country,
                                    ),
                                    regionalMembershipSuspended(
                                      federation.regional_association_ids?.[0],
                                      federation.country,
                                    )
                                      ? "Suspendida"
                                      : undefined,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </small>
                          </Link>
                          <span className="text-center text-lg">
                            {scope === "ctrugby"
                              ? (federation.ctrugby_club_count ?? "—")
                              : federation.club_count}
                          </span>
                          {state.admin && (
                            <span
                              role="link"
                              tabIndex={0}
                              title={`Editar ${federation.name}`}
                              aria-label={`Editar ${federation.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-red-50 hover:text-red-700"
                              onClick={(event) => {
                                event.stopPropagation();
                                router.push(
                                  state.admin
                                    ? `/federaciones/${federation.id}/editar`
                                    : "/login",
                                );
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  router.push(
                                    state.admin
                                      ? `/federaciones/${federation.id}/editar`
                                      : "/login",
                                  );
                                }
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.9"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                              </svg>
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
                <WorldMap countries={countries} />
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function FederationsPage() {
  return (
    <Suspense fallback={<main className="directory-app min-h-screen" />}>
      <FederationsContent />
    </Suspense>
  );
}
