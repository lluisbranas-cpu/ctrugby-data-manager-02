import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { catalogConfigured } from "@/lib/catalog";
import { requestOrigin } from "@/lib/request-origin";

export const GOOGLE_OAUTH_COOKIE = "ctrugby-google-admin-oauth";
export const GOOGLE_OAUTH_CALLBACK = "/api/acceso/google/callback";

export function googleAdminOAuthEnabled(request?: NextRequest) {
  if (process.env.CTRUGBY_GOOGLE_ADMIN_ENABLED !== "true" ||
    !catalogConfigured() || !process.env.SUPABASE_URL ||
    !(process.env.CTRUGBY_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)) return false;
  if (!request) return true;
  const origin = applicationOrigin(request);
  return origin !== null && requestOrigin(request) === origin;
}

export function applicationOrigin(request: NextRequest): string | null {
  if (process.env.NODE_ENV === "production") {
    const configured = process.env.CTRUGBY_PUBLIC_URL;
    if (!configured) return null;
    try {
      const url = new URL(configured);
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
      return url.origin;
    } catch {
      return null;
    }
  }

  const origin = requestOrigin(request);
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function googleOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function createOAuthState() {
  return randomBytes(32).toString("base64url");
}

export function createPkceVerifier() {
  return randomBytes(32).toString("base64url");
}
