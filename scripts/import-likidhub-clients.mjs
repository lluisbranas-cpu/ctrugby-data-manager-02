import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const parseEnv = (text) => Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#")).map((line) => {
  const index = line.indexOf("=");
  const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  return [line.slice(0, index).trim(), value];
}));
const sourceEnv = parseEnv(await readFile(".env.local", "utf8"));
if (!sourceEnv.SUPABASE_URL || !sourceEnv.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
const source = createClient(sourceEnv.SUPABASE_URL, sourceEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const [typesResult, clientsResult] = await Promise.all([
  source.from("catalog_client_types").select("id,name,characteristics,track_participations,version").order("name"),
  source.from("catalog_clients").select("id,name,type_id,characteristics,participations,primary_color,secondary_color,accent_color,surname_color,style,typography,logo,version").order("name"),
]);
if (typesResult.error) throw new Error(`No se pudieron leer los tipos de origen: ${typesResult.error.message}`);
if (clientsResult.error) throw new Error(`No se pudieron leer los clientes de origen: ${clientsResult.error.message}`);
const types = typesResult.data ?? [];
const clients = clientsResult.data ?? [];
const expectedTypeNames = ["Campus", "Club", "Federación", "Jugador"];
const campus = types.find((type) => type.name === "Campus");
const targetClient = clients.find((client) => client.name === "CTRugby");
const valid = types.length === 4 && types.map((type) => type.name).every((name) => expectedTypeNames.includes(name)) && Boolean(campus) && clients.length === 1 && Boolean(targetClient) && targetClient.type_id === campus?.id;
const summary = { mode: apply ? "apply" : "dry-run", writes: 0, planned: { client_types: types.map((type) => ({ id: type.id, name: type.name })), clients: clients.map((client) => ({ id: client.id, name: client.name, type_id: client.type_id, logo_inline: Boolean(client.logo) })) }, valid_source_scope: valid };
if (!apply) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("Requiere --apply --confirm.");
if (!valid) throw new Error("El origen no coincide con los 4 tipos aprobados y el único cliente CTRugby · Campus.");
const targetEnv = await likidHubEnv();
const target = createClient(targetEnv.url, targetEnv.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
for (const type of types) {
  const result = await target.rpc("likidhub_upsert_client_type", { p_row: type });
  if (result.error) throw new Error(`${type.name}: ${result.error.message}`);
  summary.writes++;
}
for (const client of clients) {
  const result = await target.rpc("likidhub_upsert_client", { p_row: client });
  if (result.error) throw new Error(`${client.name}: ${result.error.message}`);
  summary.writes++;
}
console.log(JSON.stringify(summary, null, 2));
