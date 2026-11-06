import { likidHubEnv } from "./likidhub-env.mjs";
const env = await likidHubEnv();
const clean = (value) => value.trim().replace(/^['"]|['"]$/g, "");
const baseUrl = clean(env.url).replace(/\/$/, "");
const key = clean(env.serviceRoleKey);
// Las claves modernas sb_secret son opacas: Supabase resuelve su rol desde
// apikey. Enviarlas como Bearer JWT provoca 401 en RPC y Storage.
const headers = { apikey: key };
const preview = async (response) => (await response.text()).slice(0, 1000) || null;
const table = async (schema, name) => {
  try { const response = await fetch(`${baseUrl}/rest/v1/${name}?select=id&limit=1`, { headers: { ...headers, Accept: "application/json", "Accept-Profile": schema } }); const protectedSchema = schema === "app_private" && response.status === 406; return { schema, table: name, ok: response.ok || protectedSchema, protected: protectedSchema, http_status: response.status, http_status_text: response.statusText, error: response.ok || protectedSchema ? null : await preview(response) }; }
  catch (error) { return { schema, table: name, ok: false, http_status: null, http_status_text: null, error: error instanceof Error ? error.message : String(error) }; }
};
const bucket = async () => {
  try { const response = await fetch(`${baseUrl}/storage/v1/bucket/catalog-operational-private`, { headers }); const body = await preview(response); let parsed = null; try { parsed = body ? JSON.parse(body) : null; } catch {} return { id: "catalog-operational-private", ok: response.ok, http_status: response.status, http_status_text: response.statusText, public: parsed?.public ?? null, error: response.ok ? null : body }; }
  catch (error) { return { id: "catalog-operational-private", ok: false, http_status: null, http_status_text: null, public: null, error: error instanceof Error ? error.message : String(error) }; }
};
const privateStructure = async () => {
  try { const response = await fetch(`${baseUrl}/rest/v1/rpc/likidhub_critical_structure`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: "{}" }); return { ok: response.ok, http_status: response.status, http_status_text: response.statusText, result: response.ok ? JSON.parse((await response.text()) || "[]") : null, error: response.ok ? null : await preview(response) }; }
  catch (error) { return { ok: false, http_status: null, http_status_text: null, result: null, error: error instanceof Error ? error.message : String(error) }; }
};
const tables = await Promise.all([["public", "catalog_players"], ["app_private", "player_profiles"], ["app_private", "player_seasons"], ["app_private", "player_season_photos"], ["app_private", "operational_media"]].map(([schema, name]) => table(schema, name)));
const storage = await bucket();
const structure = await privateStructure();
const bucketWarning = !storage.ok && storage.http_status === 404 ? "El bucket puede existir pero Storage API no lo enumera con esta clave; validar mediante la RPC SQL de estructura." : null;
console.log(JSON.stringify({ mode: "read-only", endpoint: new URL(baseUrl).host, administrative_key: { prefix: key.slice(0, 9), length: key.length, value_exposed: false }, administrative_request_headers: Object.keys(headers), tables, bucket: storage, bucket_warning: bucketWarning, private_structure_rpc: structure }, null, 2));
process.exitCode = tables.some((entry) => !entry.ok) || (storage.http_status !== 404 && !storage.ok) || (structure.http_status !== 404 && !structure.ok) ? 1 : 0;
