import { createHash } from "node:crypto";
import { catalogServiceClient } from "@/lib/catalog";

export type OperationalDocument<T> = {
  namespace: string;
  key: string;
  payload: T;
  source_sha256: string | null;
  version: number;
};

export const operationalHash = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

export async function readOperationalDocument<T>(namespace: string, key: string): Promise<OperationalDocument<T> | null> {
  const result = await catalogServiceClient().schema("app_private").from("operational_documents")
    .select("namespace,document_key,payload,source_sha256,version")
    .eq("namespace", namespace).eq("document_key", key).maybeSingle();
  if (result.error) throw new Error(`No se pudo leer ${namespace}/${key}: ${result.error.message}`);
  if (!result.data) return null;
  return { namespace: result.data.namespace, key: result.data.document_key, payload: result.data.payload as T, source_sha256: result.data.source_sha256, version: result.data.version };
}

export async function upsertOperationalDocument(namespace: string, key: string, payload: unknown, sourceSha256 = operationalHash(payload)) {
  const result = await catalogServiceClient().schema("app_private").from("operational_documents").upsert({
    namespace, document_key: key, payload, source_sha256: sourceSha256, updated_at: new Date().toISOString(),
  }, { onConflict: "namespace,document_key" });
  if (result.error) throw new Error(`No se pudo guardar ${namespace}/${key}: ${result.error.message}`);
}

export const operationalMediaBucket = "catalog-operational-private";
