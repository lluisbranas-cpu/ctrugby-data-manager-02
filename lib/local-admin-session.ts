import type { NextRequest } from "next/server";
import { openPending, sealPending } from "@/lib/pending-access";

export const LOCAL_ADMIN_COOKIE = "ctrugby-local-admin-session";
const MAX_AGE_SECONDS = 8 * 60 * 60;
type LocalAdminSession = { kind: "local-admin"; issuedAt: number };

export function localAdminAvailable(request: NextRequest) {
  return process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(request.nextUrl.hostname);
}

// This is a development-only, explicit local preview mode, NOT a substitute
// for authenticated administrative access on any published deployment.
export function issueLocalAdminSession() {
  return sealPending({ kind: "local-admin", issuedAt: Date.now() } satisfies LocalAdminSession);
}

export function localAdminSessionValid(request: NextRequest) {
  if (!localAdminAvailable(request)) return false;
  const cookie = request.cookies.get(LOCAL_ADMIN_COOKIE)?.value;
  if (!cookie) return false;
  const session = openPending<LocalAdminSession>(cookie);
  return !!session && session.kind === "local-admin" &&
    Number.isFinite(session.issuedAt) && session.issuedAt <= Date.now() &&
    Date.now() - session.issuedAt < MAX_AGE_SECONDS * 1000;
}

export const localAdminCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: false, // Loopback-only in development.
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
