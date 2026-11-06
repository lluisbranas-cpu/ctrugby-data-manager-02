// Server-only storage: never import this module from a client component.
type ReviewToken = { token: string; player_id: string };
type ReviewFile = { field: string; filename: string; bytes: Buffer; type: string };
type Submission = { token: string; player_id: string; submitted_at: string; payload: Record<string, unknown> };

// Las revisiones se guardan siempre en Supabase cuando la aplicación está
// configurada. El respaldo local solo queda disponible para las pruebas sin
// credenciales de Supabase.
export const usesRemoteReviewStorage = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function configuration() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("El guardado online de revisiones no esta configurado. Contacta con CTRugby.");
  return { url: url.replace(/\/$/, ""), key, bucket: process.env.CTRUGBY_REVIEW_BUCKET || "catalog-media-private" };
}

async function request(resource: string, method = "GET", body?: BodyInit, contentType = "application/json") {
  const { url, key } = configuration();
  const response = await fetch(`${url}/storage/v1/${resource}`, {
    method, body, cache: "no-store", signal: AbortSignal.timeout(20_000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": contentType },
  });
  if (!response.ok) throw new Error("No se ha podido acceder al almacen privado de revisiones. Contacta con CTRugby.");
  return response;
}

async function privateBucket() {
  const { bucket } = configuration();
  const info = await (await request(`bucket/${encodeURIComponent(bucket)}`)).json() as { public?: boolean };
  if (info.public !== false) throw new Error("Las revisiones requieren un almacen privado. Contacta con CTRugby.");
  return bucket;
}

function prefix(record: ReviewToken) {
  if (!/^JUG\d{4}$/.test(record.player_id) || !/^[a-f0-9]{48}$/.test(record.token)) throw new Error("Enlace no valido.");
  return `player-reviews/${record.player_id}/${record.token}`;
}

export async function saveRemoteReview(record: ReviewToken, payload: Record<string, unknown>, files: ReviewFile[], id: string, submittedAt: string, pdf?: Buffer, pdfFilename?: string) {
  const root = prefix(record);
  const bucket = await privateBucket();
  const folder = `${root}/${id}`;
  const savedFiles: Array<{ field: string; filename: string; original_filename: string; type: string; size: number }> = [];
  const uploaded: string[] = [];
  try {
    if (pdf) {
      const backup = `${root}/${pdfFilename || `${id}.pdf`}`;
      await request(`object/${encodeURIComponent(bucket)}/${backup}`, "POST", new Uint8Array(pdf), "application/pdf");
      uploaded.push(backup);
    }
    for (const [index, file] of files.entries()) {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const name = `${String(index + 1).padStart(2, "0")}.${extension}`;
      const object = `${folder}/imagenes/${name}`;
      await request(`object/${encodeURIComponent(bucket)}/${object}`, "POST", new Uint8Array(file.bytes), file.type);
      uploaded.push(object);
      savedFiles.push({ field: file.field, filename: name, original_filename: file.filename, type: file.type, size: file.bytes.length });
    }
    // Write the manifest last. Incomplete submissions are never returned to the form.
    await request(`object/${encodeURIComponent(bucket)}/${root}/${id}.json`, "POST", JSON.stringify({
      player_id: record.player_id, token: record.token, submitted_at: submittedAt,
      status: "pending_import", payload, files: savedFiles, image_prefix: `${folder}/imagenes`,
    }));
  } catch (error) {
    if (uploaded.length) await request(`object/${encodeURIComponent(bucket)}`, "DELETE", JSON.stringify({ prefixes: uploaded })).catch(() => undefined);
    throw error;
  }
  return { submitted_at: submittedAt, files: savedFiles.length };
}

export async function readRemoteReview(record: ReviewToken) {
  const root = prefix(record);
  const bucket = await privateBucket();
  // ISO-based names sort chronologically. Paginate because folders also count as entries.
  let offset = 0;
  while (true) {
    const entries = await (await request(`object/list/${encodeURIComponent(bucket)}`, "POST", JSON.stringify({
      prefix: root, limit: 100, offset, sortBy: { column: "name", order: "desc" },
    }))).json() as Array<{ name: string }>;
    for (const entry of entries) {
      if (!/^[\w-]+\.json$/.test(entry.name)) continue;
      const saved = await (await request(`object/authenticated/${encodeURIComponent(bucket)}/${root}/${entry.name}`)).json() as Submission;
      if (saved.token === record.token && saved.player_id === record.player_id && typeof saved.submitted_at === "string" && saved.payload && typeof saved.payload === "object") {
        return { submitted_at: saved.submitted_at, payload: saved.payload };
      }
    }
    if (entries.length < 100) return null;
    offset += entries.length;
  }
}
