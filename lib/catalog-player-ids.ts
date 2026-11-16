/** The shared catalogue and the public application use the same JUG key. */
export function catalogPlayerId(id: string) {
  return id.trim().toUpperCase();
}

/** Normalizes player identifiers read from the shared catalogue. */
export function localPlayerIdsFromCatalog(ids: Iterable<string>) {
  return new Set([...ids].map(catalogPlayerId));
}

/** Player IDs no longer require a display alias. */
export function publicPlayerId(id: string) {
  return catalogPlayerId(id);
}
