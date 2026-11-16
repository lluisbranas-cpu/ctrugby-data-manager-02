import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Link = { staff_id: string; token: string; created_at: string };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow" } });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  const { admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  const id = (await params).id.toUpperCase();
  if (!/^STF\d{4}$/.test(id)) return reply({ error: "Staff no válido." }, 400);
  const root = path.join(process.cwd(), "data", "staging");
  const staff = JSON.parse(await readFile(path.join(root, "staff.json"), "utf8")) as { id: string }[];
  if (!staff.some((person) => person.id === id)) return reply({ error: "Staff no encontrado." }, 404);
  const file = path.join(root, "staff-private-links.json");
  const links = JSON.parse(await readFile(file, "utf8").catch(() => "[]")) as Link[];
  let link = links.find((item) => item.staff_id === id);
  if (!link) { link = { staff_id: id, token: randomUUID().replace(/-/g, ""), created_at: new Date().toISOString() }; links.push(link); await writeFile(file, `${JSON.stringify(links, null, 2)}\n`, "utf8"); }
  return reply({ ok: true, url: `${request.nextUrl.origin}/revision-staff/${link.token}` });
}
