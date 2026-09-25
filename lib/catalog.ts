import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

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

export async function catalogAccess(request: NextRequest) {
  const token = request.cookies.get(CATALOG_COOKIE)?.value;
  if (!token) return { db: catalogClient(), admin: false };
  const authenticated = catalogClient(token);
  const { data, error } = await authenticated.auth.getUser(token);
  if (error || !data.user) return { db: catalogClient(), admin: false };
  const role = await authenticated.rpc("app_is_admin");
  return { db: authenticated, admin: !role.error && role.data === true };
}

export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}
