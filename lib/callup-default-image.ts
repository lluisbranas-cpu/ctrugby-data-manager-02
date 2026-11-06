export function callupDefaultImage(federationId: string, format?: string | null): string {
  if (!/^(?:FN|FT)\d{3}$/.test(federationId)) return "";
  return federationId === "FN003" && (format === "7s" || format === "7") ? "/news-defaults/espana-sevens.png" : "/api/federaciones/escudo/" + federationId;
}
