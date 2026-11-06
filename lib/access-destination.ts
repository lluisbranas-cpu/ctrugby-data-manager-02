import type { NextRequest } from "next/server";
import { openPending } from "@/lib/pending-access";

export const RETURN_COOKIE = "ctrugby-access-return";
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || url.hash || url.pathname === "/" || /^\/(?:api|_next|acceso|login|invitado|restablecer|recuperar)(?:\/|$)/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch { return null; }
}
export function destinationAfterLogin(request: NextRequest, fallback: string, role: "administrator" | "private" | "public") {
  if (role !== "private") return fallback;
  const pending = openPending<{ kind: string; path: unknown; createdAt: number }>(request.cookies.get(RETURN_COOKIE)?.value ?? "");
  if (!pending || pending.kind !== "access-return" || !Number.isFinite(pending.createdAt) || pending.createdAt > Date.now() || Date.now() - pending.createdAt > 1800_000) return fallback;
  return safeReturnPath(pending.path) ?? fallback;
}
