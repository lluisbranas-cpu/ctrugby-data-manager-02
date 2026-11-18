import { connection } from "next/server";
import { appVersion } from "../../scripts/app-version.mjs";

/** Identificador de compilación: mismo dato en local y en Vercel. */
export async function AppVersion() {
  await connection();
  const info = process.env.NODE_ENV === "production" && process.env.APP_BUILD_VERSION
    ? { version: process.env.APP_BUILD_VERSION, updated: process.env.APP_BUILD_UPDATED }
    : await appVersion();
  const environment = process.env.VERCEL ? "PRODUCCIÓN" : "LOCAL";
  return (
    <span aria-label={`Versión de LikidHub: ${info.version}. Entorno: ${environment}`} className="font-mono text-[10px] tracking-wide text-[#90abc7]">
      {info.version} · {info.updated || "fecha no disponible"} · {environment}
    </span>
  );
}
