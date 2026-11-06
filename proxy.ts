import { isSportPage, sportScope, unscopedSportPath, scopedSportHref } from "@/lib/sport-routes";
import { NextRequest, NextResponse } from "next/server";
import { requireConsultation } from "@/lib/consultation-access";
import { requestOrigin } from "@/lib/request-origin";
import { sealPending } from "@/lib/pending-access";
import { RETURN_COOKIE, safeReturnPath } from "@/lib/access-destination";

export async function proxy(request: NextRequest) {
  const originalPath = request.nextUrl.pathname;
  if (process.env.LIKIDHUB_PREVIEW_READ_ONLY === "1" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return NextResponse.json({ error: "La preview de LikidHub es de solo lectura." }, { status: 405, headers: { "Cache-Control": "no-store" } });
  }
  const scope = sportScope(originalPath);
  const path = unscopedSportPath(originalPath);
  if (!scope && isSportPage(path)) {
    const destination = request.nextUrl.clone();
    destination.pathname = scopedSportHref(path);
    return NextResponse.redirect(destination, 308);
  }
  if (scope && !isSportPage(path)) return new NextResponse("Página no encontrada", { status: 404 });
  const continueRequest = () => NextResponse.next();
  const publicClubTeams = ["/clubs/ESP0022/equipos", "/clubs/ESP0023/equipos", "/clubs/ESP0010/equipos", "/clubs/rugby-laietans", "/clubs/cabrera/nuestros-equipos.html"].includes(path);
  const assetFile = /\.(?:png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(path) && (path.slice(1).indexOf("/") === -1 || /^\/(?:club-backgrounds|club-covers|club-shields|federation-shields|fonts|jerseys|player-covers|professional-category-shields|staff-covers|staff-photos|staff-shields|vision)\//.test(path));
  // Auth screens and the assets needed to display them must remain reachable.
  if (path === "/" || path.startsWith("/api/") || path.startsWith("/_next/") || assetFile || publicClubTeams ||
      ["/acceso", "/login", "/recuperar", "/restablecer", "/restablecer-local", "/invitado", "/invitado/confirmar"].includes(path)) return continueRequest();
  const privateLink = path.startsWith("/r/") || path.startsWith("/revision-jugador/");
  if (privateLink) {
    const response = continueRequest();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return response; // The review handlers validate the bearer link and its expiry.
  }
  const denied = Boolean(await requireConsultation(request));
  if (denied) {
    const destination = new URL(privateLink ? "/acceso?privado=1" : "/acceso", requestOrigin(request) ?? request.url);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    const returnPath = safeReturnPath(`${originalPath}${request.nextUrl.search}`);
    if (returnPath && (process.env.CTRUGBY_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY)) response.cookies.set(RETURN_COOKIE, sealPending({ kind: "access-return", path: returnPath, createdAt: Date.now() }), {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800,
    });
    return response;
  }
  const response = continueRequest();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

