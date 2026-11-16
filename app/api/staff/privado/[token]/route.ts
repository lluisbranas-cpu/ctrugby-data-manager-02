import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Link = { staff_id: string; token: string };
type Private = { staff_id: string; email?: string | null; phone?: string | null };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
async function data(token: string) {
  const root = path.join(process.cwd(), "data", "staging");
  const links = JSON.parse(await readFile(path.join(root, "staff-private-links.json"), "utf8").catch(() => "[]")) as Link[];
  const link = links.find((item) => item.token === token); if (!link) return null;
  const staff = JSON.parse(await readFile(path.join(root, "staff.json"), "utf8")) as { id: string; first_name?: string; last_name?: string }[];
  const person = staff.find((item) => item.id === link.staff_id); if (!person) return null;
  const privateData = JSON.parse(await readFile(path.join(root, "staff-private-data.json"), "utf8").catch(() => "[]")) as Private[];
  return { root, person, record: privateData.find((item) => item.staff_id === person.id) ?? { staff_id: person.id }, records: privateData };
}
export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) { const item = await data((await params).token); return item ? reply({ name: [item.person.first_name, item.person.last_name].filter(Boolean).join(" "), email: item.record.email ?? "", phone: item.record.phone ?? "" }) : reply({ error: "Enlace no válido." }, 404); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) { const item = await data((await params).token); if (!item) return reply({ error: "Enlace no válido." }, 404); const body = await request.json(); const email = String(body.email ?? "").trim(); const phone = String(body.phone ?? "").trim(); if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Correo no válido." }, 400); const next = { staff_id: item.person.id, email: email || null, phone: phone || null }; const index = item.records.findIndex((record) => record.staff_id === next.staff_id); if (index >= 0) item.records[index] = next; else item.records.push(next); await writeFile(path.join(item.root, "staff-private-data.json"), `${JSON.stringify(item.records, null, 2)}\n`, "utf8"); return reply({ ok: true }); }
