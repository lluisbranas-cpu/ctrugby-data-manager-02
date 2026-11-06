import { RETURN_COOKIE, destinationAfterLogin } from "@/lib/access-destination";
import { GUEST_COOKIE, GUEST_PENDING_COOKIE } from "@/lib/guest-registration";
import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_COOKIE, CATALOG_COOKIE, catalogClient, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { beginAuthenticator, destinationFor, finishAuthenticator, loginContacts, normalizePhone, type LoginContact } from "@/lib/portal-auth";
import { openPending, sealPending } from "@/lib/pending-access";

export const runtime = "nodejs";
const PENDING_COOKIE = "ctrugby-access-pending";
type Pending = { purpose?: "club"; token: string; createdAt: number; contact?: LoginContact; factorId?: string; challengeId?: string };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };
const savePending = (response: NextResponse, pending: Pending) => response.cookies.set(PENDING_COOKIE, sealPending(pending), { ...cookieOptions, maxAge: 600 });
const clearSessions = (response: NextResponse) => { for (const name of ["ctrugby-email-access", PUBLIC_COOKIE, CATALOG_COOKIE, PENDING_COOKIE, GUEST_COOKIE, GUEST_PENDING_COOKIE]) response.cookies.set(name, "", { ...cookieOptions, maxAge: 0 }); return response; };
const clearReturn = (response: NextResponse) => { response.cookies.set(RETURN_COOKIE, "", { ...cookieOptions, maxAge: 0 }); return response; };
const contactMatches = (left: LoginContact, right: LoginContact) => left.subject_kind === right.subject_kind && left.subject_id === right.subject_id && left.phone_e164 === right.phone_e164;

async function challenge(pending: Pending, contact: LoginContact) {
  const { setup, ...factor } = await beginAuthenticator(pending.token);
  const response = clearSessions(reply({ ok: true, requiresCode: true, setup }));
  savePending(response, { ...pending, contact, ...factor });
  return response;
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!catalogConfigured()) return reply({ error: "El acceso todavía no está configurado." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 8000) return reply({ error: "Solicitud demasiado grande." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (!body || typeof body !== "object") return reply({ error: "Solicitud no válida." }, 400);
    if (body.action === "public-mode") {
      const token = request.cookies.get(CATALOG_COOKIE)?.value ?? request.cookies.get(GUEST_COOKIE)?.value;
      if (token) await catalogClient(token).auth.admin.signOut(token, "local").catch(() => undefined);
      const response = clearReturn(clearSessions(reply({ ok: true, destination: "/" })));
      response.cookies.set(PUBLIC_COOKIE, "1", { ...cookieOptions, maxAge: 3600 });
      return response;
    }
    if (body.action === "local-admin") {
      const localPreview = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(request.nextUrl.hostname);
      if (!localPreview) return reply({ error: "Este acceso solo está disponible en la vista local." }, 403);
      return clearReturn(clearSessions(reply({ ok: true, destination: "/jugadores" })));
    }
    if (body.action === "logout") {
      const token = request.cookies.get(CATALOG_COOKIE)?.value ?? request.cookies.get(GUEST_COOKIE)?.value;
      if (token) await catalogClient(token).auth.admin.signOut(token, "local").catch(() => undefined);
      return clearReturn(clearSessions(reply({ ok: true })));
    }
    if (body.action === "login") {
      if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 254 || !body.password || body.password.length > 1024) return reply({ error: "Indica correo y contraseña." }, 400);
      const login = await catalogClient().auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
      if (login.error || !login.data.session) return clearSessions(reply({ error: "Correo o contraseña incorrectos." }, 401));
      const allContacts = await loginContacts(login.data.session.access_token);
      const contacts = body.purpose === "club" ? allContacts.filter((contact) => contact.subject_kind === "club") : allContacts;
      if (body.purpose === "club" && !contacts.length) {
        await catalogClient(login.data.session.access_token).auth.signOut({ scope: "local" });
        return clearSessions(reply({ error: "Esta cuenta no tiene acceso autorizado a un club." }, 403));
      }
      if (!contacts.length) {
        const token = login.data.session.access_token;
        const db = catalogClient(token);
        const guest = await db.rpc("app_has_guest_access");
        if (guest.error || guest.data !== true) return clearSessions(reply({ error: "Esta cuenta no tiene un acceso activo. Si eres invitado, completa el registro y confirma tu correo." }, 403));
        const tracked = await db.rpc("app_record_access", { p_kind: "public" });
        if (tracked.error) return clearSessions(reply({ error: "No se ha podido registrar la entrada." }, 503));
        const response = clearReturn(clearSessions(reply({ ok: true, destination: "/jugadores", role: "public" })));
        response.cookies.set(GUEST_COOKIE, token, { ...cookieOptions, maxAge: 3600 });
        return response;
      }
      const pending: Pending = { ...(body.purpose === "club" ? { purpose: "club" as const } : {}), token: login.data.session.access_token, createdAt: Date.now() };
      if (contacts.length === 1) return challenge(pending, contacts[0]);
      const response = clearSessions(reply({ ok: true, requiresPhone: true, choices: contacts.map((contact, index) => ({ index, label: contact.subject_kind === "administrator" ? "Administración" : `${contact.subject_kind === "club" ? "Club" : "Ficha"} ${contact.subject_id}`, ending: contact.phone_e164?.slice(-2) ?? null })) }));
      savePending(response, pending);
      return response;
    }
    const value = request.cookies.get(PENDING_COOKIE)?.value;
    const pending = value ? openPending<Pending>(value) : null;
    if (!pending || typeof pending.token !== "string" || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || Date.now() - pending.createdAt > 600_000) return clearSessions(reply({ error: "La validación ha caducado. Vuelve a iniciar sesión." }, 401));
    const allContacts = await loginContacts(pending.token);
    const contacts = pending.purpose === "club" ? allContacts.filter((contact) => contact.subject_kind === "club") : allContacts;
    if (body.action === "select-phone") {
      if (typeof body.phone !== "string" || body.phone.length > 40 || !Number.isInteger(body.choice)) return reply({ error: "Elige un contacto e indica su teléfono completo, si lo tiene." }, 400);
      const selected = contacts[body.choice as number];
      if (!selected || (selected.phone_e164 && normalizePhone(body.phone) !== selected.phone_e164)) return reply({ error: "El teléfono no coincide con el contacto elegido." }, 401);
      return challenge(pending, selected);
    }
    if (body.action === "verify-authenticator") {
      if (typeof body.code !== "string" || !/^\d{6}$/.test(body.code) || !pending.contact || typeof pending.factorId !== "string" || typeof pending.challengeId !== "string") return reply({ error: "Introduce el código de seis cifras de tu app autenticadora." }, 400);
      const contact = contacts.find((item) => contactMatches(item, pending.contact!));
      if (!contact) return clearSessions(reply({ error: "El contacto ya no está autorizado. Vuelve a iniciar sesión." }, 403));
      const token = await finishAuthenticator(pending.token, pending.factorId, pending.challengeId, body.code);
      const tracked = await catalogClient(token).rpc("app_record_access", { p_kind: contact.subject_kind === "administrator" ? "administrator" : "private" });
      if (tracked.error) return clearSessions(reply({ error: "No se ha podido registrar la entrada. Vuelve a intentarlo." }, 503));
      const destination = destinationAfterLogin(request, contact.subject_kind === "club" ? `/clubs/${contact.subject_id}/autorizaciones` : destinationFor(contact), contact.subject_kind === "administrator" ? "administrator" : "private");
      const response = clearReturn(clearSessions(reply({ ok: true, destination, role: contact.subject_kind })));
      response.cookies.set(CATALOG_COOKIE, token, { ...cookieOptions, maxAge: 3600 });
      return response;
    }
    return reply({ error: "Solicitud no válida." }, 400);
  } catch (cause) {
    const message = cause instanceof Error && /autenticadora|Supabase|acceso privado autorizado/.test(cause.message) ? cause.message : "No se ha podido procesar el acceso.";
    return reply({ error: message }, 400);
  }
}
