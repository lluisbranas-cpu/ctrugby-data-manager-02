import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd());
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = ["CTR0270", "CTR0275"];
const found = await db.from("catalog_players").select("id,first_name,last_name,published,version").in("id", ids);
if (found.error) throw new Error(found.error.message);
const rows = found.data ?? [];
const changed = [];
for (const row of rows.filter((item) => !item.published)) {
  const update = await db.from("catalog_players").update({ published: true, version: row.version + 1, updated_at: new Date().toISOString() }).eq("id", row.id).eq("version", row.version).eq("published", false).select("id,published,version").maybeSingle();
  if (update.error || !update.data) throw new Error(`${row.id}: ${update.error?.message ?? "conflicto de versión"}`);
  changed.push(update.data);
}
console.log(JSON.stringify({ checked: rows.map(({ id, published, version }) => ({ id, published, version })), changed }, null, 2));
