import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_PENDING_COOKIE, loginContacts, type PendingAccess } from "@/lib/portal-auth";
import { CATALOG_COOKIE, PUBLIC_COOKIE, catalogClient, catalogConfigured } from "@/lib/catalog";
import { GUEST_COOKIE, GUEST_PENDING_COOKIE } from "@/lib/guest-registration";
import { RETURN_COOKIE } from "@/lib/access-destination";
import { sealPrivate, openPrivate } from "@/lib/pending-access";
import { applicationOrigin, googleAdminOAuthEnabled, googleOAuthCookieOptions, GOOGLE_OAUTH_COOKIE } from "@/lib/google-admin-auth";
import { requestOrigin } from "@/lib/request-origin";
import { LOCAL_ADMIN_COOKIE } from "@/lib/local-admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OAuthTransaction = { state: string; verifier: string; createdAt: number };
type TokenReply = { access_token?: unknown };
const sessionCookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };

function replyError(status: number) {
  return NextResponse.json({ error: "No se ha podido validar el acceso de Google." }, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function sameState(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_OAUTH_COOKIE, "", { ...googleOAuthCookieOptions(), maxAge: 0 });
  return response;
}

function accessFailure(origin: string, reason: string) {
  const response = NextResponse.redirect(new URL(`/acceso?privado=1&oauth_error=${encodeURIComponent(reason)}`, origin));
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  for (const name of [GOOGLE_OAUTH_COOKIE, ACCESS_PENDING_COOKIE, CATALOG_COOKIE, PUBLIC_COOKIE, GUEST_COOKIE, GUEST_PENDING_COOKIE, "ctrugby-email-access", RETURN_COOKIE, LOCAL_ADMIN_COOKIE]) {
    response.cookies.set(name, "", { ...sessionCookieOptions, maxAge: 0 });
  }
  return response;
}

export async function GET(request: NextRequest) {
  const origin = applicationOrigin(request);
  if (!origin || requestOrigin(request) !== origin) return replyError(400);

  const stateCookie = request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value ?? "";
  const transaction = openPrivate<OAuthTransaction>(stateCookie);
  const returnedState = request.nextUrl.searchParams.get("state") ?? "";
  const validTransaction = transaction &&
    typeof transaction.state === "string" &&
    typeof transaction.verifier === "string" &&
    /^[A-Za-z0-9_-]{43,128}$/.test(transaction.verifier) &&
    Number.isFinite(transaction.createdAt) &&
    transaction.createdAt <= Date.now() &&
    Date.now() - transaction.createdAt <= 600_000 &&
    sameState(returnedState, transaction.state);
  if (!validTransaction) return clearOAuthCookie(accessFailure(origin, "state"));
  if (request.nextUrl.searchParams.has("error")) return clearOAuthCookie(accessFailure(origin, "cancelled"));
  if (!googleAdminOAuthEnabled(request) || !catalogConfigured()) return clearOAuthCookie(accessFailure(origin, "unavailable"));

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code || code.length > 4096) return clearOAuthCookie(accessFailure(origin, "exchange"));

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return clearOAuthCookie(accessFailure(origin, "unavailable"));
    const tokenResponse = await fetch(new URL("/auth/v1/token?grant_type=pkce", supabaseUrl), {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: { apikey: publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ auth_code: code, code_verifier: transaction.verifier }),
    });
    if (!tokenResponse.ok) return clearOAuthCookie(accessFailure(origin, "exchange"));
    const token = await tokenResponse.json() as TokenReply;
    if (typeof token.access_token !== "string" || !token.access_token) return clearOAuthCookie(accessFailure(origin, "exchange"));

    const db = catalogClient(token.access_token);
    const user = await db.auth.getUser(token.access_token);
    if (user.error || !user.data.user?.email_confirmed_at) return clearOAuthCookie(accessFailure(origin, "account"));
    const contacts = await loginContacts(token.access_token);
    const administrators = contacts.filter((contact) => contact.subject_kind === "administrator");
    if (administrators.length !== 1) return clearOAuthCookie(accessFailure(origin, "not-admin"));

    const pending: PendingAccess = {
      provider: "google",
      token: token.access_token,
      createdAt: Date.now(),
      contact: administrators[0],
    };
    const response = NextResponse.redirect(new URL("/acceso?privado=1&google=1", origin));
    response.cookies.set(ACCESS_PENDING_COOKIE, sealPrivate(pending), { ...sessionCookieOptions, maxAge: 600 });
    for (const name of [CATALOG_COOKIE, PUBLIC_COOKIE, GUEST_COOKIE, GUEST_PENDING_COOKIE, "ctrugby-email-access", RETURN_COOKIE]) {
      response.cookies.set(name, "", { ...sessionCookieOptions, maxAge: 0 });
    }
    clearOAuthCookie(response);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return clearOAuthCookie(accessFailure(origin, "exchange"));
  }
}
