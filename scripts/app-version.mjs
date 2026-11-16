// Build metadata is provided by Vercel at build time.  Do not crawl the
// repository here: this module is imported by next.config and a dynamic walk
// makes output tracing package all local staging assets into every deployment.
export async function appVersion() {
  const deployedAt = process.env.VERCEL_DEPLOYMENT_CREATED_AT;
  const date = deployedAt ? new Date(Number(deployedAt)) : new Date();
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  const revision = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "local";
  return {
    version: "v" + part("year") + "." + part("month") + "." + part("day") + "." + revision,
    updated: part("day") + "/" + part("month") + "/" + part("year") + " · " + new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(date),
  };
}
