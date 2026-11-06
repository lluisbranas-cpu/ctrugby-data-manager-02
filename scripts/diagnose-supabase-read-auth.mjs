import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());
const url = process.env.SUPABASE_URL;
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const claims = (value) => {
  const parts = String(value ?? "").split(".");
  if (parts.length !== 3) return { format: "opaque", iat: null, nbf: null, exp: null };
  try { const body = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")); return { format: "jwt", iat: body.iat ?? null, nbf: body.nbf ?? null, exp: body.exp ?? null }; } catch { return { format: "unreadable", iat: null, nbf: null, exp: null }; }
};
const probe = async (label, key, schema, table) => {
  if (!url || !key) return { label, configured: false };
  const result = await createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).schema(schema).from(table).select("id", { head: true, count: "exact" }).limit(1);
  return { label, configured: true, table: `${schema}.${table}`, ok: !result.error, count: result.count ?? null, error: result.error ? { message: result.error.message, code: result.error.code ?? null, status: result.error.status ?? null } : null };
};
const now = Math.floor(Date.now() / 1000);
const idProbe = async (key) => {
  const result = await createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).from("catalog_players").select("id,first_name,last_name").in("id", ["CTR0270", "CTR0275"]);
  return result.error ? { ok: false, error: result.error.message } : { ok: true, ids: (result.data ?? []).map((row) => row.id) };
};
console.log(JSON.stringify({
  local_clock: { epoch_seconds: now, iso: new Date().toISOString() },
  variables: { public: "SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY", administrative: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" },
  administrative_token_timing: claims(service),
  probes: await Promise.all([
    probe("public-catalog", publishable, "public", "catalog_players"),
    probe("public-private-denied-expected", publishable, "app_private", "player_profiles"),
    probe("administrative-catalog", service, "public", "catalog_players"),
    probe("administrative-private", service, "app_private", "player_profiles"),
  ]),
  requested_ctr_ids: await idProbe(service),
}, null, 2));
