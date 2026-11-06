import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogClient, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { GUEST_COOKIE, GUEST_PENDING_COOKIE, guestFields, type GuestRegistration } from "@/lib/guest-registration";
import { openPending, sealPending } from "@/lib/pending-access";
import { requestOrigin } from "@/lib/request-origin";
import { brand } from "@/lib/brand";

export const runtime = "nodejs";
const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer" } });
const requests = new Map<string, number>();

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El acceso no está configurado." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Solicitud no válida." }, 400);
    if (body.action === "register") {
      const fields = guestFields(body);
      if (!fields) return reply({ error: "Indica nombre, correo válido y teléfono con prefijo internacional." }, 400);
      if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 1024) return reply({ error: "Elige una contraseña de al menos 10 caracteres." }, 400);
      const now = Date.now();
      for (const [email, at] of requests) if (now - at > 60_000) requests.delete(email);
      if (requests.has(fields.email)) return reply({ error: "Espera un minuto antes de pedir otro enlace." }, 429);
      requests.set(fields.email, now);
      const sent = await catalogClient().auth.signUp({ email: fields.email, password: body.password, options: {
        emailRedirectTo: new URL("/invitado/confirmar", requestOrigin(request)!).toString(),
      } });
      if (sent.error) return reply({ error: sent.error.status === 429 ? "Se ha alcanzado el límite de envíos. Espera unos minutos." : `No se ha podido enviar el enlace de confirmación. Contacta con ${brand.product} si vuelve a ocurrir.` }, sent.error.status === 429 ? 429 : 503);
      const response = reply({ ok: true });
      response.cookies.set(GUEST_PENDING_COOKIE, sealPending({ kind: "guest-registration", ...fields, createdAt: now } satisfies GuestRegistration), { ...options, maxAge: 3600 });
      return response;
    }
    if (body.action === "confirm") {
      const pending = openPending<GuestRegistration>(request.cookies.get(GUEST_PENDING_COOKIE)?.value ?? "");
      if (!pending || pending.kind !== "guest-registration" || !guestFields(pending) || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || Date.now() - pending.createdAt > 3600_000) return reply({ error: "Abre el enlace en el mismo navegador donde te registraste. Si ha pasado una hora, solicita uno nuevo." }, 401);
      if (typeof body.accessToken !== "string" || body.accessToken.length > 10_000) return reply({ error: "Enlace no válido." }, 400);
      const db = catalogClient(body.accessToken);
      const user = await db.auth.getUser(body.accessToken);
      if (user.error || !user.data.user?.email_confirmed_at || user.data.user.email?.trim().toLowerCase() !== pending.email) return reply({ error: "El enlace no corresponde al correo registrado o ha caducado." }, 401);
      const saved = await db.rpc("app_register_guest", { p_name: pending.name, p_phone: pending.phone });
      if (saved.error) return reply({ error: "No se ha podido guardar el registro de invitado." }, 503);
      const tracked = await db.rpc("app_record_access", { p_kind: "public" });
      if (tracked.error) return reply({ error: "Esta cuenta no tiene acceso público activo." }, 403);
      const response = reply({ ok: true, destination: "/jugadores" });
      response.cookies.set(GUEST_COOKIE, body.accessToken, { ...options, maxAge: 3600 });
      // Choosing Público must never retain a previous administrator/private session.
      for (const name of [CATALOG_COOKIE, "ctrugby-access-pending", GUEST_PENDING_COOKIE]) response.cookies.set(name, "", { ...options, maxAge: 0 });
      return response;
    }
    return reply({ error: "Solicitud no válida." }, 400);
  } catch { return reply({ error: "No se ha podido procesar el registro." }, 400); }
}
