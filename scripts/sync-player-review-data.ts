import * as nextEnv from "@next/env";
import { loadLocalPlayerReviewData } from "../lib/player-edit-review";
import { catalogServiceClient } from "../lib/catalog";
import { retryStorageUpload, uploadErrorStatus } from "../lib/storage-upload-retry";
import { access, readFile } from "node:fs/promises";

nextEnv.loadEnvConfig(process.cwd());
async function main() {
  try { await access("data/staging/players.json"); } catch {
    console.log("Fichas privadas: se conserva la copia persistente; no hay datos locales para sincronizar.");
    return;
  }
  const db = catalogServiceClient();
  const bucket = process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private";
  const info = await db.storage.getBucket(bucket);
  if (info.error || info.data?.public !== false) throw new Error("Se requiere almacenamiento privado.");
  const links = JSON.parse(await readFile("data/staging/player-review-short-links.json", "utf8")) as { player_id: string; status: string }[];
  const ids = [...new Set(links.filter((link) => link.status === "active").map((link) => link.player_id))];
  let count = 0;
  for (let offset = 0; offset < ids.length; offset += 2) {
    await Promise.all(ids.slice(offset, offset + 2).map(async (id) => {
      const data = await loadLocalPlayerReviewData(id);
      if (!data) throw new Error("Falta ficha " + id);
      const result = await retryStorageUpload(() => db.storage.from(bucket).upload(
        "player-review-data/" + id + ".json", JSON.stringify(data),
        { contentType: "application/json", upsert: true, cacheControl: "0" },
      ));
      if (result.error) throw new Error("No se pudo guardar ficha " + id + " (estado " + uploadErrorStatus(result.error) + ").");
      count++;
    }));
    if (count % 40 === 0 || count === ids.length) console.log("Fichas privadas sincronizadas: " + count + "/" + ids.length);
  }
}
main().catch((cause) => {
  if (cause instanceof Error && /^(Falta ficha CTR|No se pudo guardar ficha CTR|Se requiere almacenamiento privado)/.test(cause.message)) console.error(cause.message);
  console.error("No se completó la sincronización de fichas privadas");
  process.exitCode = 1;
});
