import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const destination = process.env.CTRUGBY_PLAYER_EDIT_DRIVE_DIR || "G:\\Mi unidad\\CTRUGBY_PLAYER_EDIT_DRIVE_DIR";
const bucket = process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan las credenciales de Supabase para sincronizar los PDF.");
const storage = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket);

async function list(prefix: string): Promise<string[]> {
  const { data, error } = await storage.list(prefix, { limit: 1000 });
  if (error) throw new Error("No se han podido leer las copias privadas.");
  const paths: string[] = [];
  for (const item of data ?? []) {
    const child = `${prefix}/${item.name}`;
    if (item.id) paths.push(child);
    else paths.push(...await list(child));
  }
  return paths;
}

const remotePdfs = (await list("player-reviews")).filter((file) => file.endsWith(".pdf"));
let copied = 0;
for (const remote of remotePdfs) {
  const parts = remote.split("/");
  const player = parts[1] || "sin-jugador";
  const output = path.join(destination, "revisiones-publicadas", player, parts.at(-1)!);
  try { await access(output); continue; } catch { /* Copy only files not already present. */ }
  const { data, error } = await storage.download(remote);
  if (error || !data) throw new Error("No se ha podido descargar una copia privada.");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(await data.arrayBuffer()));
  copied += 1;
}
console.log(`PDF de revisiones sincronizados: ${copied} nuevos, ${remotePdfs.length} encontrados.`);
