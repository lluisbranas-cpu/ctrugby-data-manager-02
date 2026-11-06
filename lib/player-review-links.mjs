// Server-only: link secrets must never be imported by client components.
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function newReviewLink(playerId, seed) {
  if (!/^JUG\d{4}$/.test(playerId)) throw new Error("Jugador no válido.");
  if (seed && (seed.player_id !== playerId || !/^[a-f0-9]{48}$/.test(seed.token) || !/^[A-Za-z0-9_-]{8,16}$/.test(seed.code))) throw new Error("Enlace privado guardado no válido.");
  const now = new Date();
  return seed ?? { player_id: playerId, token: randomBytes(24).toString("hex"), code: randomBytes(9).toString("base64url"), created_at: now.toISOString(), expires_at: new Date(now.getTime() + 365 * 86400000).toISOString(), status: "active" };
}

// Separate immutable player objects prevent simultaneous builds from replacing each other's links.
export function createReviewLinkRepository(store) {
  const root = "player-edit-links";
  const playerPath = (id) => `${root}/players/${id}.json`;
  async function read(kind, key) {
    if (kind === "tokens" && !/^[a-f0-9]{48}$/.test(key)) return null;
    if (kind === "codes" && !/^[A-Za-z0-9_-]{8,16}$/.test(key)) return null;
    const index = await store.read(`${root}/${kind}/${key}.json`);
    if (!index || !/^JUG\d{4}$/.test(index.player_id)) return null;
    const record = await store.read(playerPath(index.player_id));
    return record && (kind === "tokens" ? record.token === key : record.code === key) ? record : null;
  }
  return {
    read,
    async ensure(playerId, seed) {
      let record = await store.read(playerPath(playerId));
      let created = false;
      if (!record) {
        const proposed = newReviewLink(playerId, seed);
        created = await store.create(playerPath(playerId), proposed);
        record = created ? proposed : await store.read(playerPath(playerId));
      }
      if (!record) throw new Error("No se ha podido recuperar el enlace privado.");
      newReviewLink(playerId, record); // Validate existing data before using it as an object path.
      for (const [kind, value] of [["tokens", record.token], ["codes", record.code]]) {
        const object = `${root}/${kind}/${value}.json`;
        const index = await store.read(object);
        if (index && index.player_id !== playerId) throw new Error("Conflicto entre enlaces privados.");
        if (!index) {
          await store.create(object, { player_id: playerId });
          const saved = await store.read(object);
          if (!saved || saved.player_id !== playerId) throw new Error("No se ha podido guardar el índice privado.");
        }
      }
      return { record, created };
    },
  };
}

export async function remoteReviewLinks() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new Error("El almacén privado de enlaces no está configurado. Contacta con CTRugby.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const bucketName = process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private";
  async function storageRequest(request) {
    for (let attempt = 0; ; attempt += 1) {
      const result = await request();
      if (!["429", "500", "502", "503", "504"].includes(String(result.error?.statusCode)) || attempt >= 6) return result;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 16000)));
    }
  }
  const info = await storageRequest(() => db.storage.getBucket(bucketName));
  if (info.error || info.data?.public !== false) throw new Error("Los enlaces requieren un almacén privado. Contacta con CTRugby.");
  const bucket = db.storage.from(bucketName);
  return createReviewLinkRepository({
    async read(object) {
      const { data, error } = await storageRequest(() => bucket.download(object));
      if (error) {
        if (String(error.statusCode) === "404" || error.message === "Object not found") return null;
        throw new Error("No se ha podido leer el almacén privado de enlaces. Contacta con CTRugby.");
      }
      return JSON.parse(await data.text());
    },
    async create(object, value) {
      const { error } = await storageRequest(() => bucket.upload(object, JSON.stringify(value), { contentType: "application/json", cacheControl: "0", upsert: false }));
      if (!error) return true;
      if (String(error.statusCode) === "409" || error.message === "The resource already exists") return false;
      throw new Error(`No se ha podido guardar el enlace privado. Estado: ${String(error.statusCode).replace(/[^0-9]/g, "").slice(0, 3)}; tipo: ${String(error.name).replace(/[^A-Za-z]/g, "").slice(0, 40)}.`);
    },
  });
}

export function reviewPublicOrigin(fallback) {
  const configured = process.env.CTRUGBY_PUBLIC_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = configured ? (/^https?:\/\//.test(configured) ? configured : `https://${configured}`) : fallback;
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("El dominio público no es válido.");
  return url.origin;
}



