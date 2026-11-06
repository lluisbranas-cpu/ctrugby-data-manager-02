import type { NextRequest } from "next/server";
import { readPlayerEditToken } from "@/lib/player-edit-review";

export const REVIEW_MEDIA_COOKIE = "ctrugby-review-media";

// Grants read access only to this player's review images, never general access.
export async function playerReviewMediaAccess(request: NextRequest, playerId: string) {
  const token = request.cookies.get(REVIEW_MEDIA_COOKIE)?.value;
  if (!token) return false;
  try { return (await readPlayerEditToken(token))?.player_id === playerId; }
  catch { return false; }
}
