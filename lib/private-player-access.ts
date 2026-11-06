import type { NextRequest } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export async function privatePlayerAccess(request: NextRequest, playerId: string) {
  if (!catalogConfigured()) return false;
  const access = await catalogAccess(request);
  if (access.admin) return true;
  if (!access.authenticated) return false;
  const result = await access.db.rpc("app_can_view_player", { p_player_id: playerId });
  return !result.error && result.data === true;
}

// Review links alone do not authorize reading health, even inside saved submissions.
export function withoutHealth(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutHealth);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    ["allergies", "dietary_conditions", "medications"].includes(key) ? null : withoutHealth(item),
  ]));
}
