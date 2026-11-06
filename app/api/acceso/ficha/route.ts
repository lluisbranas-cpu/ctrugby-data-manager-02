import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, PUBLIC_COOKIE, catalogClient, catalogConfigured, catalogServiceClient, sameOrigin } from "@/lib/catalog";
import { GUEST_COOKIE, GUEST_PENDING_COOKIE } from "@/lib/guest-registration";
import { RETURN_COOKIE } from "@/lib/access-destination";
import { openPending, sealPending } from "@/lib/pending-access";
import { loginContacts, type LoginContact } from "@/lib/portal-auth";

export const runtime = "nodejs";
const COOKIE = "ctrugby-email-access";
type Pending = { kind: "email-access"; email: string; createdAt: number; token?: string };
const options = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", Vary: "Cookie" } });
function save(response: NextResponse, pending: Pending) {
  response.cookies.set(COOKIE, sealPending(pending), { ...options, maxAge: 600 });
  return response;
}
function eligible(contacts: LoginContact[]) {
  return contacts.filter((contact, index, all) => contact.subject_kind === "player" &&
    all.findIndex((other) => other.subject_kind === contact.subject_kind && other.subject_id === contact.subject_id) === index);
}
async function complete(token: string, contact: LoginContact) {
  const db = catalogClient(token);
  const scoped = await db.rpc("app_select_private_subject", { p_kind: contact.subject_kind, p_id: contact.subject_id });
  if (scoped.error) return reply({ error: "No se ha podido autorizar esta ficha. Comprueba la configuración de acceso." }, 403);
  const tracked = await db.rpc("app_record_access", { p_kind: "private" });
  if (tracked.error) return reply({ error: "No se ha podido registrar la entrada." }, 503);
  const destination = contact.subject_kind === "club" ? `/clubs/${contact.subject_id}/autorizaciones` : `/jugadores/${contact.subject_id}`;
  const response = reply({ destination });
  for (const name of [COOKIE, PUBLIC_COOKIE, GUEST_COOKIE, GUEST_PENDING_COOKIE, RETURN_COOKIE, "ctrugby-access-pending"])
    response.cookies.set(name, "", { ...options, maxAge: 0 });
  response.cookies.set(CATALOG_COOKIE, token, { ...options, maxAge: 3600 });
  return response;
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "Acceso no configurado." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object") return reply({ error: "Solicitud no válida." }, 400);
    const pending = openPending<Pending>(request.cookies.get(COOKIE)?.value ?? "");
    const validPending = pending?.kind === "email-access" && typeof pending.email === "string" &&
      Number.isFinite(pending.createdAt) && pending.createdAt <= Date.now() && Date.now() - pending.createdAt < 600_000;
    if (body.action === "send-code") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Introduce un correo válido." }, 400);
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return reply({ error: "El envío de códigos no está configurado." }, 503);
      const allowed = await catalogServiceClient().rpc("app_email_login_allowed", { p_email: email });
      if (allowed.error) return reply({ error: "El acceso por correo requiere aplicar la actualización de permisos en Supabase." }, 503);
      if (allowed.data !== true) {
        const response = reply({ error: "Este correo no tiene autorización al acceso privado" }, 403);
        response.cookies.set(COOKIE, "", { ...options, maxAge: 0 });
        return response;
      }
      if (validPending && Date.now() - pending.createdAt < 60_000) return reply({ error: "Espera un minuto antes de pedir otro código." }, 429);
      {
        const sent = await catalogClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        if (sent.error) return reply({ error: "No se ha podido enviar el código. Espera un minuto y vuelve a intentarlo." }, 503);
      }
      return save(reply({ sent: true, message: "Recibirás un código de acceso en tu mail" }), { kind: "email-access", email, createdAt: Date.now() });
    }
    if (!validPending) return reply({ error: "La solicitud ha caducado. Pide un código nuevo." }, 401);
    if (body.action === "verify-code") {
      if (typeof body.code !== "string" || !/^\d{6,10}$/.test(body.code)) return reply({ error: "Introduce el código recibido por correo." }, 400);
      const verified = await catalogClient().auth.verifyOtp({ email: pending.email, token: body.code, type: "email" });
      const token = verified.data.session?.access_token;
      if (verified.error || !token || verified.data.user?.email?.toLowerCase() !== pending.email) return reply({ error: "Código incorrecto o caducado." }, 401);
      const contacts = eligible(await loginContacts(token));
      if (!contacts.length) {
        await catalogClient(token).auth.signOut({ scope: "local" });
        return reply({ error: "Este correo no tiene autorización al acceso privado" }, 403);
      }
      if (contacts.length === 1) return complete(token, contacts[0]);
      return save(reply({ choices: contacts.map((contact, index) => ({ index, label: `${contact.subject_kind === "club" ? "Club" : "Ficha"} ${contact.subject_id}` })) }), { ...pending, token });
    }
    if (body.action === "select-profile" && pending.token && Number.isInteger(body.choice)) {
      const contacts = eligible(await loginContacts(pending.token));
      const contact = contacts[body.choice as number];
      if (!contact) return reply({ error: "Elige una ficha autorizada." }, 403);
      return complete(pending.token, contact);
    }
    return reply({ error: "Solicitud no válida." }, 400);
  } catch { return reply({ error: "No se ha podido completar el acceso. Vuelve a intentarlo." }, 400); }
}
