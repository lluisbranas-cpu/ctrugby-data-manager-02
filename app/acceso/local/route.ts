import { NextRequest, NextResponse } from "next/server";
import { localAdminAvailable } from "@/lib/local-admin-session";

export const runtime = "nodejs";

// Legacy local shortcut. GET must never activate an administrator session:
// cross-origin navigation to localhost can be triggered by another website.
// The user explicitly selects administrator mode from /acceso via same-origin POST.
export function GET(request: NextRequest) {
  if (!localAdminAvailable(request)) return new NextResponse("No disponible", { status: 404 });
  return NextResponse.redirect(new URL("/acceso", request.url));
}
