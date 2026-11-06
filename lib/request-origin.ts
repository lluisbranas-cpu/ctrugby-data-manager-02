import type { NextRequest } from "next/server";

export function requestOrigin(request: NextRequest): string | null {
  const protocol = request.nextUrl.protocol;
  if (protocol !== "http:" && protocol !== "https:") return null;
  const host = request.headers.get("host");
  if (!host) return request.nextUrl.origin;
  try {
    // NextURL normalizes loopback IPs to localhost. Host preserves the address
    // the browser actually used. Forwarded host headers are deliberately ignored.
    const target = new URL(`${protocol}//${host}`);
    if (target.host.toLowerCase() !== host.toLowerCase() || target.username || target.password || target.pathname !== "/" || target.search || target.hash) return null;
    return target.origin;
  } catch { return null; }
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  return origin === requestOrigin(request);
}
