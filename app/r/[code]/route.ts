import { NextRequest, NextResponse } from "next/server";
import { readPlayerReviewShortLink } from "@/lib/player-edit-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await readPlayerReviewShortLink(code);
  if (!link) return new NextResponse(null, { status: 404, headers: { "X-Robots-Tag": "noindex, nofollow, noarchive" } });
  return NextResponse.redirect(new URL(`/revision-jugador/${link.token}`, request.nextUrl.origin), {
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
