import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";

const apply = process.argv.includes("--apply");
const newsId = "c619ca8f-2cc6-4ad9-a38c-e6c74587d41b";
const callupId = "SEL-MARTI-HOMAR-2025-M18-EUROPE";
const sourceUrl = "https://ferugby.es/son-de-oro-los-leones-m18-superan-a-georgia-11-16-y-levanta-el-titulo-europeo-de-la-categoria-por-primera-vez-en-la-historia/";
const news = {
  id: newsId, type: "noticia", player_id: "JUG0308", date_or_season: "22/11/25",
  title: "Martí Homar, campeón de Europa M18 con España", url: sourceUrl, published: true,
  participation: null, selection: null, image_updated_at: null, updated_at: new Date().toISOString(),
};
const callup = {
  id: callupId, action: "include", player_id: "JUG0308", player_name: "Martí Homar",
  federation_id: "FN003", scope: "Nacional", category: "M18", format: "XV", season_label: "2025/2026",
  club_text: "Barça Rugby", notes: "Campeón de Europa M18 2025. España venció a Georgia por 16-11 en la final disputada en Praga.", created_at: new Date().toISOString(),
};
if (!apply) { console.log(JSON.stringify({ mode: "dry-run", news, callup }, null, 2)); process.exit(0); }
if (!process.argv.includes("--confirm")) throw new Error("La escritura exige --apply --confirm.");
const destination = await likidHubEnv();
const db = createClient(destination.url, destination.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
async function append(namespace, key, id, record) {
  const current = await db.schema("app_private").from("operational_documents").select("payload").eq("namespace", namespace).eq("document_key", key).single();
  if (current.error) throw new Error(`${namespace}/${key}: ${current.error.message}`);
  const records = Array.isArray(current.data.payload) ? current.data.payload : [];
  const next = [record, ...records.filter((item) => item?.id !== id)];
  const saved = await db.schema("app_private").from("operational_documents").upsert({ namespace, document_key: key, payload: next, source_sha256: createHash("sha256").update(JSON.stringify(next)).digest("hex"), updated_at: new Date().toISOString() }, { onConflict: "namespace,document_key" });
  if (saved.error) throw new Error(`${namespace}/${key}: ${saved.error.message}`);
}
await append("news", "player-news", newsId, news);
await append("hito", "manual-selection-callups", callupId, callup);
console.log(JSON.stringify({ mode: "apply", news_id: newsId, hito_id: callupId }, null, 2));
