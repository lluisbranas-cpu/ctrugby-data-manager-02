import { appVersion } from "./scripts/app-version.mjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate build directory lets a temporary local test run without
  // interrupting another Next development server using the default `.next`.
  distDir: process.env.CTRUGBY_NEXT_DIST_DIR || ".next",
  async redirects() { return [{ source: "/", destination: "/Likid", permanent: false }]; },
  async rewrites() {
    return {
      beforeFiles: [{ source: "/Likid", destination: "/" }, { source: "/rugby/:client/:section(jugadores|clubs|staff|participaciones|hitos|destacados|seleccionados|federaciones|Federaciones_Nacionales|confederaciones|noticias|titulos|campus|clubes-profesionales|categorias|agrupaciones-temporales|world-rugby|paises|web)/:path*", destination: "/:section/:path*" }],
      afterFiles: [],
      fallback: [],
    };
  },
  outputFileTracingIncludes: {
    "/api/jugadores/\\[id\\]": [
      "./data/staging/player-season-photos/*/*.png",
      "./data/staging/player-season-photos/*/primary.json",
    ],
    "/api/jugadores/foto/\\[id\\]": [
      "./data/staging/player-season-photos/*/*.png",
      "./data/staging/player-season-photos/*/primary.json",
      "./data/staging/player-photos/prepared/*.png",
    ],
  },
};

export default async function config() {
  const info = await appVersion();
  return { ...nextConfig, env: { ...nextConfig.env, APP_BUILD_VERSION: info.version, APP_BUILD_UPDATED: info.updated } };
}
