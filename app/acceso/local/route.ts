import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, PUBLIC_COOKIE } from "@/lib/catalog";
import { GUEST_COOKIE, GUEST_PENDING_COOKIE } from "@/lib/guest-registration";
import { RETURN_COOKIE } from "@/lib/access-destination";
import { LOCAL_ADMIN_COOKIE, localAdminAvailable, issueLocalAdminSession, localAdminCookieOptions } from "@/lib/local-admin-session";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  if (!localAdminAvailable(request)) return new NextResponse("No disponible", { status: 404 });
  const response = NextResponse.redirect(new URL("/jugadores", request.url));
  for (const name of ["ctrugby-email-access", PUBLIC_COOKIE, CATALOG_COOKIE, "ctrugby-access-pending", GUEST_COOKIE, GUEST_PENDING_COOKIE, RETURN_COOKIE]) response.cookies.set(name, "", { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 0 });
  response.cookies.set(LOCAL_ADMIN_COOKIE, issueLocalAdminSession(), localAdminCookieOptions);
  return response;
}
