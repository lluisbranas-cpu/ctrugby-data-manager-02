import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured, catalogServiceClient, sameOrigin } from "@/lib/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return reply({ error: "Acceso no configurado." }, 503);
  try {
    const id = (await params).id;
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(id)) return reply({ error: "Club no válido." }, 400);
    const { db, admin } = await catalogAccess(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    const raw = await request.text();
    if (raw.length > 1000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body?.phone === "string" ? body.phone.replace(/[\s().-]/g, "") : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+[1-9][0-9]{7,14}$/.test(phone) || typeof body?.active !== "boolean") return reply({ error: "Indica un correo, un teléfono internacional y el estado del acceso." }, 400);
    const configured = await db.rpc("admin_club_access_ready", { p_club_id: id, p_email: email });
    if (configured.error || configured.data !== true) return reply({ error: "Aplica la actualización de permisos o revisa el correo y el club." }, 403);
    const service = catalogServiceClient();
    let userId: string | undefined;
    for (let page = 1; ; page++) {
      const users = await service.auth.admin.listUsers({ page, perPage: 200 });
      if (users.error) return reply({ error: "No se han podido revisar las cuentas." }, 503);
      userId = users.data.users.find((user) => user.email?.trim().toLowerCase() === email)?.id;
      if (userId || users.data.users.length < 200) break;
    }
    if (!userId && body.active) {
      const created = await service.auth.admin.createUser({ email, email_confirm: false });
      if (created.error || !created.data.user) return reply({ error: "No se ha podido crear la cuenta del club." }, 503);
      userId = created.data.user.id;
    }
    if (!userId) return reply({ ok: true });
    const linked = await db.rpc("admin_set_club_access", { p_user_id: userId, p_club_id: id, p_phone: phone, p_active: body.active });
    return linked.error ? reply({ error: "No se ha podido cambiar el acceso. Una cuenta ya vinculada a otro perfil no se reasigna automáticamente." }, 403) : reply({ ok: true });
  } catch { return reply({ error: "No se ha podido guardar el acceso del club." }, 400); }
}
