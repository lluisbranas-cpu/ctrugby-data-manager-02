import "server-only";
import { catalogServiceClient } from "@/lib/catalog";
import { operationalMediaBucket } from "@/lib/operational-store";
import { canonicalLikidHubPlayerId } from "@/lib/likidhub-jug-ctr-bridge.generated";

export function likidHubPreviewReadOnly() {
  const value = process.env.LIKIDHUB_PREVIEW_READ_ONLY;
  if (value === undefined || value === "0") return false;
  if (value === "1") return true;
  throw new Error("LIKIDHUB_PREVIEW_READ_ONLY debe ser 0 o 1.");
}

function previewClient() {
  if (!likidHubPreviewReadOnly()) throw new Error("La preview de LikidHub no está activa.");
  return catalogServiceClient();
}

export async function previewLikidHubPlayers() {
  const result = await previewClient().rpc("likidhub_preview_players");
  if (result.error) throw new Error(`No se pudo leer el directorio LikidHub: ${result.error.message}`);
  return result.data ?? [];
}

export type LikidHubPreviewClub = { id: string; name: string; published: boolean; version: number };
export type LikidHubPreviewClientType = { id: string; name: string; characteristics: string; track_participations: boolean; version: number };
export type LikidHubPreviewClient = { id: string; name: string; type_id: string; characteristics: string; participations: number | null; primary_color: string; secondary_color: string; accent_color: string; surname_color: string; style: string; typography: string; logo: string; version: number };
export type LikidHubPreviewFeaturedSummary = { player_id: string; featured_rank: number; milestone_count: number; selected_federation_ids: string[]; selected_federation_counts: Record<string, number>; professional_club_records: Array<{ club_name?: string; [key: string]: unknown }>; source_sha256: string; source_updated_at: string };

/**
 * The preview catalog intentionally selects only fields that exist in the
 * LikidHub operational schema. Do not enrich these rows from local catalogs.
 */
export async function previewLikidHubClubs(): Promise<LikidHubPreviewClub[]> {
  const result = await previewClient().from("catalog_clubs").select("id,name,published,version").order("name");
  if (result.error) throw new Error(`No se pudieron leer los clubs LikidHub: ${result.error.message}`);
  return (result.data ?? []) as LikidHubPreviewClub[];
}

export async function previewLikidHubClients(): Promise<{ types: LikidHubPreviewClientType[]; clients: LikidHubPreviewClient[] }> {
  const client = previewClient();
  const [types, clients] = await Promise.all([
    client.from("catalog_client_types").select("id,name,characteristics,track_participations,version").order("name"),
    client.from("catalog_clients").select("id,name,type_id,characteristics,participations,primary_color,secondary_color,accent_color,surname_color,style,typography,logo,version").order("name"),
  ]);
  if (types.error) throw new Error(`No se pudieron leer los tipos de cliente LikidHub: ${types.error.message}`);
  if (clients.error) throw new Error(`No se pudieron leer los clientes LikidHub: ${clients.error.message}`);
  return { types: (types.data ?? []) as LikidHubPreviewClientType[], clients: (clients.data ?? []) as LikidHubPreviewClient[] };
}

export async function previewLikidHubFeaturedSummaries(): Promise<LikidHubPreviewFeaturedSummary[]> {
  const result = await previewClient().rpc("likidhub_preview_featured_summary");
  if (result.error) throw new Error(`No se pudieron leer los destacados LikidHub: ${result.error.message}`);
  return (result.data ?? []) as LikidHubPreviewFeaturedSummary[];
}

export async function previewLikidHubPlayer(id: string) {
  const canonicalId = canonicalLikidHubPlayerId(id);
  if (!canonicalId) return null;
  const result = await previewClient().rpc("likidhub_preview_player", { p_player_id: canonicalId });
  if (result.error) throw new Error(`No se pudo leer el jugador LikidHub: ${result.error.message}`);
  return result.data;
}

export async function previewLikidHubParticipations(id?: string) {
  const canonicalId = id ? canonicalLikidHubPlayerId(id) : null;
  if (id && !canonicalId) return { available: false, rows: [], reason: "ID de jugador no conciliado" };
  const result = await previewClient().rpc("likidhub_preview_participations", { p_player_id: canonicalId });
  if (result.error) throw new Error(`No se pudieron leer las participaciones LikidHub: ${result.error.message}`);
  return result.data;
}

export async function previewLikidHubSeasonPhoto(id: string, seasonYear: number) {
  const canonicalId = canonicalLikidHubPlayerId(id);
  if (!canonicalId) return null;
  const result = await previewClient().rpc("likidhub_preview_player_season_photo", { p_player_id: canonicalId, p_season_year: seasonYear });
  if (result.error) throw new Error(`No se pudo leer la foto de temporada LikidHub: ${result.error.message}`);
  return result.data?.[0] ?? null;
}

export async function previewLikidHubMedia(entityType: string, entityId: string, variant: string) {
  if (!/^[a-z-]{3,40}$/.test(entityType) || !/^[A-Z0-9-]{3,80}$/.test(entityId) || !/^[a-z0-9-]{3,80}$/.test(variant)) throw new Error("Referencia de medio no válida.");
  const result = await previewClient().rpc("likidhub_preview_media", { p_entity_type: entityType, p_entity_id: entityId, p_variant: variant });
  if (result.error) throw new Error(`No se pudo leer el medio LikidHub: ${result.error.message}`);
  return result.data?.[0] ?? null;
}

export async function previewLikidHubSignedMediaUrl(storageKey: string, expiresIn = 300) {
  if (!storageKey || storageKey.startsWith("/") || storageKey.includes("..") || expiresIn < 30 || expiresIn > 3600) throw new Error("Clave o vencimiento de medio no válidos.");
  const result = await previewClient().storage.from(operationalMediaBucket).createSignedUrl(storageKey, expiresIn);
  if (result.error || !result.data?.signedUrl) throw new Error(`No se pudo firmar el medio LikidHub: ${result.error?.message ?? "sin URL"}`);
  return result.data.signedUrl;
}

export async function previewLikidHubMediaUrl(entityType: string, entityId: string, variant: string, expiresIn = 300) {
  const media = await previewLikidHubMedia(entityType, entityId, variant);
  return media ? previewLikidHubSignedMediaUrl(media.object_key, expiresIn) : null;
}

export async function previewLikidHubSeasonPhotoUrl(id: string, seasonYear: number, expiresIn = 300) {
  const photo = await previewLikidHubSeasonPhoto(id, seasonYear);
  return photo ? previewLikidHubSignedMediaUrl(photo.storage_key, expiresIn) : null;
}

/**
 * Reads only the player's private LikidHub season-photo prefix. Each candidate
 * is then confirmed through the season-photo RPC, so an unassociated object
 * can never become a portrait fallback.
 */
export async function previewLikidHubLatestSeasonPhotoUrl(id: string, expiresIn = 300) {
  const canonicalId = canonicalLikidHubPlayerId(id);
  if (!canonicalId) return null;
  const prefix = `player-season-photos/${canonicalId}`;
  const listed = await previewClient().storage.from(operationalMediaBucket).list(prefix, { limit: 100, sortBy: { column: "name", order: "desc" } });
  if (listed.error) throw new Error(`No se pudieron listar las fotos de temporada LikidHub: ${listed.error.message}`);
  const seasons = [...new Set((listed.data ?? []).map((item) => item.name.match(/^(20\d{2})\.png$/)?.[1]).filter((year): year is string => Boolean(year)))].sort((left, right) => Number(right) - Number(left));
  for (const season of seasons) {
    const photo = await previewLikidHubSeasonPhoto(canonicalId, Number(season));
    if (photo) return previewLikidHubSignedMediaUrl(photo.storage_key, expiresIn);
  }
  return null;
}
