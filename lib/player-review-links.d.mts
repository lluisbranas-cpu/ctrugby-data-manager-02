export type ReviewLink = { player_id: string; token: string; code: string; created_at: string; expires_at: string; status: "active" | "closed" };
export type LinkStore = { read(path: string): Promise<unknown>; create(path: string, data: unknown): Promise<boolean> };
export type LinkRepository = { read(kind: "tokens" | "codes", key: string): Promise<ReviewLink | null>; ensure(playerId: string, seed?: ReviewLink): Promise<{ record: ReviewLink; created: boolean }> };
export function newReviewLink(playerId: string, seed?: ReviewLink): ReviewLink;
export function createReviewLinkRepository(store: LinkStore): LinkRepository;
export function remoteReviewLinks(): Promise<LinkRepository>;
export function reviewPublicOrigin(fallback: string): string;
