"use client";

import { ChevronDown, Trophy } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function TitleSummary({ count, loading = false, children }: { count: number | string; loading?: boolean; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  return <section className="mt-4 w-full min-w-0 border-t border-neutral-200 pt-3" aria-label="Títulos deportivos">
    <h3 className="mb-2 text-center text-[10px] font-black uppercase tracking-[.14em] text-neutral-500">TÍTULOS</h3>
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold shadow-sm disabled:cursor-wait disabled:opacity-60"
      aria-expanded={expanded}
      aria-controls={detailsId}
      aria-label={`${expanded ? "Ocultar" : "Ver"} ${count} títulos deportivos`}
      disabled={loading}
      onClick={() => setExpanded((current) => !current)}
    >
      <Trophy size={18} aria-hidden="true" className="shrink-0 text-red-600" />
      <b className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-white">{count}</b>
      <span>{expanded ? "Ocultar" : "Ver"}</span>
      <ChevronDown size={15} aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <div id={detailsId} className="mt-3">{children}</div>}
  </section>;
}
