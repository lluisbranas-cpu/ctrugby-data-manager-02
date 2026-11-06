export type WorldRugbyAffiliation = "miembro" | "no_aplica" | "pendiente";

// Verificado contra la página oficial de membresía de World Rugby (27-09-2026).
const verifiedNationalFederations = new Set([
  "FN001", "FN002", "FN003", "FN004", "FN005", "FN006", "FN007", "FN008", "FN009", "FN010", "FN011", "FN012", "FN013", "FN014", "FN015", "FN016", "FN017", "FN018", "FN019", "FN020", "FN021", "FN022", "FN023", "FN024", "FN025", "FN026",
]);

export const WORLD_RUGBY_MEMBERSHIP_URL = "https://www.world.rugby/organisation/membership?lang=es";

export function worldRugbyAffiliation(id: string, scope: string): WorldRugbyAffiliation {
  if (scope !== "Nacional") return "no_aplica";
  return verifiedNationalFederations.has(id) ? "miembro" : "pendiente";
}
