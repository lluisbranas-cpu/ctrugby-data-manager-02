import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sealPrivate } from "@/lib/pending-access";
import { applicationOrigin, createOAuthState, createPkceVerifier, googleAdminOAuthEnabled, googleOAuthCookieOptions, GOOGLE_OAUTH_CALLBACK, GOOGLE_OAUTH_COOKIE } from "@/lib/google-admin-auth";
import { requestOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OAuthTransaction = { state: string; verifier: string; createdAt: number };

function failure(origin: string, reason: string, status = 302) {
  const response = NextResponse.redirect(new URL(`/acceso?privado=1&oauth_error=${encodeURIComponent(reason)}`, origin), status);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const origin = applicationOrigin(request);
  if (!origin || requestOrigin(request) !== origin) {
    return NextResponse.json({ error: "El origen de acceso no está configurado." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!googleAdminOAuthEnabled(request)) return failure(origin, "unavailable");

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return failure(origin, "unavailable");
  try {
    const state = createOAuthState();
    const verifier = createPkceVerifier();
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const callback = new URL(GOOGLE_OAUTH_CALLBACK, origin);
    callback.searchParams.set("state", state);
    const authorization = new URL("/auth/v1/authorize", supabaseUrl);
    authorization.searchParams.set("provider", "google");
    authorization.searchParams.set("redirect_to", callback.toString());
    authorization.searchParams.set("code_challenge", challenge);
    authorization.searchParams.set("code_challenge_method", "s256");

    const response = NextResponse.redirect(authorization);
    response.cookies.set(GOOGLE_OAUTH_COOKIE, sealPrivate({ state, verifier, createdAt: Date.now() } satisfies OAuthTransaction), {
      ...googleOAuthCookieOptions(),
      maxAge: 600,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return failure(origin, "unavailable");
  }
}
