import { connection } from "next/server";
import { appVersion } from "../../scripts/app-version.mjs";

export async function AppVersion() {
  await connection();
  const info = process.env.NODE_ENV === "production" && process.env.APP_BUILD_VERSION
    ? { version: process.env.APP_BUILD_VERSION, updated: process.env.APP_BUILD_UPDATED }
    : await appVersion();
  return <div style={{ textAlign: "center", fontSize: 11, color: "#888", padding: "6px 12px" }}>{info.version} · {info.updated} · {process.env.VERCEL ? "PÚBLICA" : "LOCAL"}</div>;
}
