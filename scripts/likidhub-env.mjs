import { readFile } from "node:fs/promises";
import path from "node:path";

const unquote = (value) => {
  const trimmed = value.trim();
  return (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")) ? trimmed.slice(1, -1) : trimmed;
};
const parse = (text) => Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
  const normalized = line.replace(/^export\s+/, ""); const index = normalized.indexOf("=");
  return [normalized.slice(0, index).trim(), unquote(normalized.slice(index + 1))];
}));
export async function likidHubEnv() {
  const values = parse(await readFile(path.join(process.cwd(), ".env.likidhub.local"), "utf8"));
  if (!values.LIKIDHUB_SUPABASE_URL || !values.LIKIDHUB_SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan valores de destino en .env.likidhub.local.");
  return { url: values.LIKIDHUB_SUPABASE_URL, publishableKey: values.LIKIDHUB_SUPABASE_PUBLISHABLE_KEY || null, serviceRoleKey: values.LIKIDHUB_SUPABASE_SERVICE_ROLE_KEY };
}
