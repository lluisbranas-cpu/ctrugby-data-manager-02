import Link from "@/app/components/sport-link";
import type { ReactNode } from "react";

type Entry = { id: string; name: string };

export function EntityPagination({ entries, currentId, hrefPrefix, leading }: { entries: Entry[]; currentId: string; hrefPrefix: string; leading?: ReactNode }) {
  const ordered = [...entries].sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
  const index = ordered.findIndex((entry) => entry.id === currentId);
  if (index < 0) return null;
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  if (!previous && !next) return null;
  return <nav aria-label="Navegación entre fichas" className="mb-3 flex justify-end gap-1 text-sm">{leading}{previous ? <Link href={`${hrefPrefix}/${previous.id}`} aria-label={`Ficha anterior: ${previous.name}`} title={`Anterior: ${previous.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-semibold text-neutral-600 hover:bg-white hover:text-red-700">←</Link> : null}{next ? <Link href={`${hrefPrefix}/${next.id}`} aria-label={`Ficha siguiente: ${next.name}`} title={`Siguiente: ${next.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg font-semibold text-neutral-600 hover:bg-white hover:text-red-700">→</Link> : null}</nav>;
}
