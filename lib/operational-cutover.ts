/**
 * Explicit, fail-closed switch for routes migrated to LikidHub.
 * Local mode is the default until the reviewed imports and parity checks pass.
 */
export type OperationalReadMode = "local" | "supabase";

export function operationalReadMode(): OperationalReadMode {
  const value = process.env.LIKIDHUB_OPERATIONAL_READ_MODE;
  if (value === undefined || value === "local") return "local";
  if (value === "supabase") return "supabase";
  throw new Error("LIKIDHUB_OPERATIONAL_READ_MODE debe ser local o supabase.");
}

export function usesLikidHubOperationalStore() {
  return operationalReadMode() === "supabase";
}

export function activeDataOrigin() {
  return likidHubPreviewReadOnly() || usesLikidHubOperationalStore()
    ? "LikidHub"
    : "CTRugby Data Manager";
}

export function likidHubPreviewReadOnly() {
  const value = process.env.LIKIDHUB_PREVIEW_READ_ONLY;
  if (value === undefined || value === "0") return false;
  if (value === "1") return true;
  throw new Error("LIKIDHUB_PREVIEW_READ_ONLY debe ser 0 o 1.");
}
