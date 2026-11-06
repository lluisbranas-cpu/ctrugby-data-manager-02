import { spawn } from "node:child_process";
import path from "node:path";
import { likidHubEnv } from "./likidhub-env.mjs";

const env = await likidHubEnv();
if (!env.publishableKey) throw new Error("Falta LIKIDHUB_SUPABASE_PUBLISHABLE_KEY en .env.likidhub.local.");
const next = process.platform === "win32" ? path.join(process.cwd(), "node_modules", ".bin", "next.cmd") : path.join(process.cwd(), "node_modules", ".bin", "next");
const child = spawn(next, ["dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_URL: env.url,
    SUPABASE_PUBLISHABLE_KEY: env.publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: env.serviceRoleKey,
    LIKIDHUB_PREVIEW_READ_ONLY: "1",
    LIKIDHUB_OPERATIONAL_READ_MODE: "supabase",
  },
});
child.on("exit", code => process.exitCode = code ?? 1);
