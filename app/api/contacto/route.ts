import { requireConsultation } from "@/lib/consultation-access";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ContactMessage = { id: string; name: string | null; reply_to: string | null; subject: string; message: string; created_at: string };

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
const filePath = () => path.join(process.cwd(), "data", "staging", "contact-messages.json");
const clean = (value: unknown, maximum: number) => typeof value === "string" ? value.trim().slice(0, maximum) : "";
const nullable = (value: unknown, maximum: number) => clean(value, maximum) || null;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readMessages() {
  const raw = await readFile(filePath(), "utf8").catch(() => "[]");
  return JSON.parse(raw) as ContactMessage[];
}

async function saveMessages(messages: ContactMessage[]) {
  const target = filePath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

export async function GET(request: NextRequest) {
  const denied = await requireConsultation(request); if (denied) return denied;
  try {
    if (!catalogConfigured()) return reply({ configured: false, admin: false, messages: [] }, 503);
    const { admin } = await catalogAccess(request);
    if (!admin) return reply({ configured: true, admin: false, messages: [] });
    return reply({ configured: true, admin: true, messages: await readMessages() });
  } catch {
    return reply({ error: "No se han podido cargar los mensajes." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireConsultation(request); if (denied) return denied;
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  try {
    const body = await request.json() as Record<string, unknown>;
    const replyTo = nullable(body.reply_to, 254);
    const subject = clean(body.subject, 160);
    const message = clean(body.message, 4000);
    if (replyTo && !emailPattern.test(replyTo)) return reply({ error: "Indica un correo de respuesta válido." }, 400);
    if (!subject || !message) return reply({ error: "Indica asunto y mensaje." }, 400);
    const record: ContactMessage = { id: `MSG-${Date.now()}-${randomUUID().slice(0, 8)}`, name: nullable(body.name, 160), reply_to: replyTo, subject, message, created_at: new Date().toISOString() };
    await saveMessages([record, ...(await readMessages())]);
    return reply({ ok: true, id: record.id }, 201);
  } catch {
    return reply({ error: "No se ha podido enviar el formulario." }, 400);
  }
}
