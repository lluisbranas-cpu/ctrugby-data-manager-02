import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const COOKIE = "ctrugby-pilot-session";
export const PLAYER = "TEST001";
export function configured() {
  return process.env.CTRUGBY_PILOT_ENABLED === "true" &&
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY);
}
export function client(token?: string) {
  if (!configured()) throw new Error("La prueba todavía no está conectada.");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
export async function access(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value;
  const db = client(token);
  if (!token) return { db, admin: false };
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return { db: client(), admin: false };
  const role = await db.rpc("pilot_is_admin");
  return { db, admin: !role.error && role.data === true };
}
export function sameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin &&
    request.headers.get("sec-fetch-site") !== "cross-site";
}
