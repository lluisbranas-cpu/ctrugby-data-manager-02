import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { defaultClubPalette, isClubPalette, type ClubPalette } from "@/app/lib/club-palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validId = (id: string) => /^[A-Z]{3}\d{4}$/.test(id) ? id : null;
const palettesPath = path.join(process.cwd(), "data", "staging", "club-palettes.json");
const initialPalettes: Record<string, ClubPalette> = { ESP0022: ["#07577c", "#2ea8d6", "#e8f3f7"] };

async function palettes(): Promise<Record<string, ClubPalette>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(palettesPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isClubPalette(value))) as Record<string, ClubPalette>;
  } catch { return {}; }
}

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const consultationDenied = await requireConsultation(_request);
  if (consultationDenied) return consultationDenied;

  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Club no válido." }, 404);
  return reply({ palette: (await palettes())[id] ?? initialPalettes[id] ?? defaultClubPalette });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const id = validId((await context.params).id.toUpperCase());
  if (!id) return reply({ error: "Club no válido." }, 404);
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const body: unknown = await request.json();
    const palette = typeof body === "object" && body !== null ? (body as { palette?: unknown }).palette : null;
    if (!isClubPalette(palette)) return reply({ error: "Indica tres colores hexadecimales válidos." }, 400);
    const current = await palettes();
    current[id] = palette;
    await mkdir(path.dirname(palettesPath), { recursive: true });
    await writeFile(palettesPath, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return reply({ ok: true, palette });
  } catch { return reply({ error: "No se ha podido guardar la paleta." }, 400); }
}