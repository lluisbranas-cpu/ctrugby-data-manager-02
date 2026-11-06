import { GUEST_COOKIE } from "@/lib/guest-registration";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { localAdminSessionValid } from "@/lib/local-admin-session";

export const PUBLIC_COOKIE = "ctrugby-public-mode";

export const CATALOG_COOKIE = "ctrugby-catalog-session";

export function catalogConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}

export function catalogClient(token?: string) {
  if (!catalogConfigured()) throw new Error("El catálogo todavía no está conectado.");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}

export function catalogServiceClient() {
  if (!catalogConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return catalogClient();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}

export function localAdminAccess(request: NextRequest) {
  return request.cookies.get(PUBLIC_COOKIE)?.value !== "1" && localAdminSessionValid(request);
}

// Retired: kept for archived source copies that still import this symbol.
export function publicAdminAccess(request: NextRequest) { void request; return false; }

// Reuse identity checks only within this exact request. Never share permissions
// between requests or users: revocation is checked again on the next request.
const requestAccess = new WeakMap<NextRequest, ReturnType<typeof resolveCatalogAccess>>();
export function catalogAccess(request: NextRequest) {
  let access = requestAccess.get(request);
  if (!access) { access = resolveCatalogAccess(request); requestAccess.set(request, access); }
  return access;
}
async function resolveCatalogAccess(request: NextRequest) {
  const anonymous = () => ({ db: catalogClient(), admin: false, authenticated: false, guest: false });
  // Only an explicit signed development session enables local administrative preview.
  // Merely browsing localhost must not bypass private or club permissions.
  if (localAdminAccess(request)) return { db: catalogServiceClient(), admin: true, authenticated: true, guest: false };
  // Public mode always uses the anonymous database client and has no editing privileges.
  if (request.cookies.get(PUBLIC_COOKIE)?.value === "1") return { ...anonymous(), guest: true };
  const token = request.cookies.get(CATALOG_COOKIE)?.value;
  if (token) {
    const db = catalogClient(token);
    const user = await db.auth.getUser(token);
    if (!user.error && user.data.user) {
      const [role, privateAccess] = await Promise.all([db.rpc("app_is_admin"), db.rpc("app_has_private_access")]);
      if (!privateAccess.error && privateAccess.data === true) return { db, admin: !role.error && role.data === true, authenticated: true, guest: false };
    }
  }
  const guestToken = request.cookies.get(GUEST_COOKIE)?.value;
  if (guestToken) {
    const db = catalogClient(guestToken);
    const user = await db.auth.getUser(guestToken);
    if (!user.error && user.data.user?.email_confirmed_at) {
      const access = await db.rpc("app_has_guest_access");
      if (!access.error && access.data === true) return { db, admin: false, authenticated: false, guest: true };
    }
  }
  return anonymous();
}

export { sameOrigin } from "@/lib/request-origin";
