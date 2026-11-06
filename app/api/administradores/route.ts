import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function GET(request: NextRequest) {
  if (!catalogConfigured()) return reply({ error: "El acceso no está configurado." }, 503);
  const { db, admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Inicia sesión como administrador y confirma tu app autenticadora." }, 403);
  const result = await db.rpc("admin_list_administrators");
  if (result.error) return reply({ error: "No se ha podido leer la tabla. Comprueba la migración de seguridad en Supabase." }, 503);
  const [identity, statistics] = await Promise.all([
    db.auth.getUser(request.cookies.get(CATALOG_COOKIE)?.value), db.rpc("admin_access_accounts"),
  ]);
  if (identity.error || statistics.error) return reply({ error: "No se ha podido cargar la información de administradores." }, 503);
  return reply({ current_email: identity.data.user?.email?.trim().toLowerCase(), administrators: (result.data ?? []).map((row: { email: string }) => {
    const stats = (statistics.data ?? []).find((item: { email: string; access_kind: string }) => item.email === row.email && item.access_kind === "administrator");
    return { ...row, access_count: stats?.access_count ?? 0, last_access_at: stats?.last_access_at ?? null };
  }) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El acceso no está configurado." }, 503);
  const { db, admin } = await catalogAccess(request);
  if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw) as { email?: unknown; phone_e164?: unknown; active?: unknown };
    if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || typeof body.phone_e164 !== "string" || !/^\+[1-9][0-9]{7,14}$/.test(body.phone_e164) || typeof body.active !== "boolean") return reply({ error: "Indica correo, teléfono internacional y estado válidos." }, 400);
    const result = await db.rpc("admin_save_administrator", { p_email: body.email.trim().toLowerCase(), p_phone: body.phone_e164, p_active: body.active });
    if (result.error) return reply({ error: result.error.code === "22023" ? "Otro administrador debe desactivar tu acceso." : "No se ha podido guardar el administrador." }, 400);
    return reply({ ok: true });
  } catch { return reply({ error: "Solicitud no válida." }, 400); }
}
