export type ParticipationOrigin = {kind: string; record: Record<string, unknown>};
export type NewsParticipation = {
  kind?: "campus" | "club"; campus_id?: string; year?: string | null; registration_number?: string; count?: number; pending_year?: boolean; email_enabled?: boolean;
  amount_paid?: number | null;
  category: string; club_id: string | null; club_name: string; club_category: string;
  notes?: string | null; season_label?: string | null; player_name?: string; created_at?: string; legacy_id?: string;
  migration_sources?: ParticipationOrigin[];
};
export function participationFromBody(value: unknown): NewsParticipation | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.category !== "string" || (data.kind !== "campus" && !data.category.trim()) || data.category.length > 80) return null;
  if (data.club_id !== null && data.club_id !== undefined && (typeof data.club_id !== "string" || !/^[A-Z0-9_-]{1,40}$/.test(data.club_id))) return null;
  if (data.club_name !== undefined && (typeof data.club_name !== "string" || data.club_name.length > 160)) return null;
  if (data.club_category !== undefined && (typeof data.club_category !== "string" || data.club_category.length > 100)) return null;
  if (data.notes !== undefined && data.notes !== null && (typeof data.notes !== "string" || data.notes.length > 2000)) return null;
  if (data.amount_paid !== undefined && data.amount_paid !== null && (typeof data.amount_paid !== "number" || !Number.isFinite(data.amount_paid) || data.amount_paid < 0 || data.amount_paid > 100000)) return null;
  if (data.season_label !== undefined && data.season_label !== null && (typeof data.season_label !== "string" || data.season_label.length > 40)) return null;
  if (data.kind !== undefined && data.kind !== "campus" && data.kind !== "club") return null;
  if (data.kind === "campus") {
    if (typeof data.campus_id !== "string" || !/^[A-Z0-9_-]{1,40}$/.test(data.campus_id)) return null;
    if (data.year !== null && (typeof data.year !== "string" || !/^20\d{2}$/.test(data.year))) return null;
    if (data.count !== undefined && (!Number.isInteger(data.count) || Number(data.count) < (data.year ? 1 : 0) || Number(data.count) > 99 || data.year && data.count !== 1)) return null;
    if (data.registration_number !== undefined && (typeof data.registration_number !== "string" || data.registration_number.length > 24)) return null;
    if (data.email_enabled !== undefined && typeof data.email_enabled !== "boolean") return null;
    if (data.pending_year !== undefined && typeof data.pending_year !== "boolean") return null;
    if (!data.year && data.pending_year !== true) return null;
  }
  const origins = Array.isArray(data.migration_sources) ? data.migration_sources.filter((item): item is ParticipationOrigin => Boolean(item && typeof item === "object" && typeof item.kind === "string" && item.record && typeof item.record === "object" && !Array.isArray(item.record))) : undefined;
  return {...(data.kind === "campus" ? {kind: "campus" as const, campus_id: data.campus_id as string, year: data.year as string | null, registration_number: String(data.registration_number ?? "").trim(), count: data.count === undefined ? 1 : Number(data.count), pending_year: !data.year || data.pending_year === true, email_enabled: data.email_enabled !== false} : {}), amount_paid: typeof data.amount_paid === "number" ? Math.round(data.amount_paid * 100) / 100 : null, category: data.category.trim(), club_id: typeof data.club_id === "string" ? data.club_id : null, club_name: typeof data.club_name === "string" ? data.club_name.trim() : "", club_category: typeof data.club_category === "string" ? data.club_category.trim() : "", notes: typeof data.notes === "string" ? data.notes.trim() || null : null, ...(data.season_label !== undefined ? {season_label: data.season_label as string | null} : {}), ...(typeof data.player_name === "string" ? {player_name: data.player_name} : {}), ...(typeof data.created_at === "string" ? {created_at: data.created_at} : {}), ...(typeof data.legacy_id === "string" ? {legacy_id: data.legacy_id} : {}), ...(origins ? {migration_sources: origins} : {})};
}
