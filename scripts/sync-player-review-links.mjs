import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { newReviewLink, remoteReviewLinks, reviewPublicOrigin } from "../lib/player-review-links.mjs";

nextEnv.loadEnvConfig(process.cwd());
const base = path.join(process.cwd(), "data", "staging");
async function readJson(filename, fallback) {
  try { return JSON.parse(await readFile(filename, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}
async function saveJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filename);
}

async function main() {
  const production = (process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && Boolean(process.env.VERCEL))) || process.argv.includes("--publish");
  const online = production || process.env.CTRUGBY_REVIEW_STORAGE === "supabase" || process.argv.includes("--sync");
  if (process.env.VERCEL_ENV === "preview" && !process.argv.includes("--sync")) {
    console.log("Enlaces privados: la vista previa conserva el almacén de producción.");
    return;
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para sincronizar todos los jugadores.");
  }
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const ids = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("catalog_players").select("id").order("id").range(offset, offset + 999);
    if (error) throw new Error("No se ha podido leer el catálogo actual para generar los enlaces.");
    ids.push(...data.map((player) => player.id).filter((id) => /^JUG\d{4}$/.test(id)));
    if (data.length < 1000) break;
  }
  const tokenDirectory = path.join(base, "player-edit-tokens");
  await mkdir(tokenDirectory, { recursive: true });
  const tokens = [];
  for (const name of await readdir(tokenDirectory)) {
    if (/^[a-f0-9]{48}\.json$/.test(name)) tokens.push(await readJson(path.join(tokenDirectory, name), null));
  }
  const shortLinksFile = path.join(base, "player-review-short-links.json");
  const links = await readJson(shortLinksFile, []);
  const remote = online ? await remoteReviewLinks() : null;
  const records = [];
  let created = 0;
  // Bounded batches keep deployment time predictable without flooding the private store.
  for (let offset = 0; offset < ids.length; offset += 2) {
    const batch = await Promise.all(ids.slice(offset, offset + 2).map(async (id) => {
      const link = links.find((item) => item.player_id === id && item.status === "active");
      const token = (link && tokens.find((item) => item?.token === link.token && item.player_id === id)) || tokens.find((item) => item?.player_id === id && item.status === "active");
      const seed = token ? { ...token, code: link?.token === token.token ? link.code : newReviewLink(id).code } : undefined;
      const result = remote ? await remote.ensure(id, seed) : { record: newReviewLink(id, seed), created: !seed };
      if (result.created) created += 1;
      return result.record;
    }));
    records.push(...batch);
    if (records.length % 50 === 0 || records.length === ids.length) console.log(`Enlaces privados comprobados: ${records.length}/${ids.length}.`);
  }
  for (const record of records) {
    const { code, ...token } = record;
    await saveJson(path.join(tokenDirectory, `${token.token}.json`), token);
    const index = links.findIndex((item) => item.player_id === record.player_id && item.status === "active");
    const link = { code, token: record.token, player_id: record.player_id, created_at: record.created_at, status: record.status };
    if (index >= 0) links[index] = link;
    else links.push(link);
  }
  await saveJson(shortLinksFile, links);
  const origin = reviewPublicOrigin("http://localhost:3000");
  await saveJson(path.join(base, "player-edit-urls.json"), records.map((record) => ({ player_id: record.player_id, url: `${origin}/r/${record.code}`, path: `/r/${record.code}`, status: record.status })));
  console.log(`Enlaces privados: ${records.length} jugadores, ${created} creados, ${records.length - created} conservados. Copia local guardada${online ? " y almacén privado sincronizado" : ""}.`);
}

main().catch((error) => { if (error instanceof Error && /^(Configura SUPABASE_|No se ha podido|Los enlaces requieren|El almacén privado|Enlace privado guardado|Conflicto entre)/.test(error.message)) console.error(error.message); console.error("No se ha completado la sincronización de enlaces privados. Revisa el catálogo, las credenciales y el almacén privado antes de publicar."); process.exitCode = 1; });



