import { countryFlagCode, countryOptions } from "@/app/lib/country-flag";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { readOperationalDocument, upsertOperationalDocument } from "@/lib/operational-store";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Override = { source_id: string; id: string; name: string; flag_url?: string };
const file = path.join(process.cwd(), "data", "staging", "countries.json");
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const defaults = () => countryOptions.map((country) => ({ source_id: country.id, id: countryFlagCode(country.id)?.toUpperCase() ?? country.id, name: country.id }));
const localOverrides = async () => JSON.parse(await readFile(file, "utf8").catch(() => "[]")) as Override[];
const readOverrides = async () => {
  const remote = await readOperationalDocument<unknown>("country", "overrides").catch(() => null);
  if (Array.isArray(remote?.payload)) return remote.payload as Override[];
  return localOverrides();
};
const countries = async () => {
  const saved = await readOverrides();
  const overrides = new Map(saved.map((country) => [country.source_id, country]));
  const standard: Override[] = defaults().map((country) => overrides.get(country.source_id) ?? country);
  const custom = saved.filter((country) => !defaults().some((standardCountry) => standardCountry.source_id === country.source_id));
  return [...standard, ...custom].map((country) => ({ ...country, flag_url: country.flag_url ?? `/api/paises/bandera/${encodeURIComponent(country.id)}` })).sort((a, b) => a.name.localeCompare(b.name, "es"));
};

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return reply({ error: "El catálogo no está configurado." }, 503);
  const { admin } = await catalogAccess(request);
  return reply({ admin, countries: await countries() });
}

export async function PUT(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El catálogo no está configurado." }, 503);
  const { admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const body = await request.json() as Partial<Override>;
    const source_id = String(body.source_id ?? "");
    const id = String(body.id ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!defaults().some((country) => country.source_id === source_id) || !/^[A-Z0-9]{2,12}$/.test(id) || !name || name.length > 120) return reply({ error: "ID o nombre de país no válidos." }, 400);
    const overrides = await readOverrides();
    const next = [...overrides.filter((country) => country.source_id !== source_id), { source_id, id, name }];
    await upsertOperationalDocument("country", "overrides", next);
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return reply({ countries: await countries() });
  } catch { return reply({ error: "No se ha podido guardar el país." }, 400); }
}
