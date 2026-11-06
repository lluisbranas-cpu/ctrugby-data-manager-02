/** Public page URLs. API endpoints, assets and shared administration stay global. */
export const sportSections = ["jugadores", "clubs", "staff", "participaciones", "hitos", "destacados", "seleccionados", "federaciones", "noticias", "campus", "clubes-profesionales", "categorias", "agrupaciones-temporales", "world-rugby"] as const;
export function sportScope(path: string) {
  return /^\/rugby\/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\/|$)/.exec(path)?.[1] ?? null;
}
export function unscopedSportPath(path: string) {
  return sportScope(path) ? path.replace(/^\/rugby\/[^/]+/, "") || "/" : path;
}
export function isSportPage(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return sportSections.some(section => pathname === "/" + section || pathname.startsWith("/" + section + "/")) && !/\.[a-z0-9]+$/i.test(pathname);
}
export function scopedSportHref(href: string, currentPath = "", client?: string) {
  if (!isSportPage(href)) return href;
  return "/rugby/" + (client ?? sportScope(currentPath) ?? "likid") + href;
}
export function previewClientSlug(client: { id: string; name: string }) {
  const name = client.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const slug of ["cabrera", "badalona", "alella", "laietans", "ctrugby"]) {
    if (name.split(/[^a-z0-9]+/).includes(slug)) return slug;
  }
  return (name.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cliente") + "-" + client.id.toLowerCase().replace(/[^a-z0-9]/g, "");
}
