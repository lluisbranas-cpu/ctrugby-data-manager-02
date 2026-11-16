"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { playerTitleLabel, playerTitleYear, type PlayerTitle } from "@/lib/player-titles";
import { TitleSummary } from "./title-summary";

export function StaffTitles({staffId}: {staffId: string}) {
  const [titles, setTitles] = useState<PlayerTitle[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/player-titles?staff_id=${encodeURIComponent(staffId)}`, {cache: "no-store", signal: controller.signal})
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.titles)) throw new Error(data.error || "No se han podido cargar los títulos.");
        return data.titles as PlayerTitle[];
      })
      .then((records) => {if (!controller.signal.aborted) setTitles(records);})
      .catch((reason) => {if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se han podido cargar los títulos.");});
    return () => controller.abort();
  }, [staffId]);

  const loading = titles === null && !error;
  return <TitleSummary count={loading ? "…" : error ? "!" : titles?.length ?? 0} loading={loading}>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : titles?.length ? <ul className="grid gap-2">{titles.map((title) => <li key={title.id} className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      {title.image_updated_at && <Image unoptimized src={`/api/player-titles/${encodeURIComponent(title.id)}/image?v=${encodeURIComponent(title.image_updated_at)}`} alt="" width={72} height={48} className="h-12 w-[72px] rounded object-cover" />}
      <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-wide text-red-700">{playerTitleYear(title) ?? "—"}</p><p className="text-sm font-bold">{playerTitleLabel(title)}</p>{title.competition && <p className="text-xs text-neutral-700">{title.competition}</p>}{[title.team, title.result, title.date].filter(Boolean).length > 0 && <p className="mt-1 text-xs text-neutral-600">{[title.team, title.result, title.date].filter(Boolean).join(" · ")}</p>}{title.source_url && <a href={title.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-bold text-red-700 underline">Fuente{title.source_name ? `: ${title.source_name}` : ""}</a>}</div>
    </li>)}</ul> : <p className="text-sm text-neutral-500">Sin títulos asociados.</p>}
  </TitleSummary>;
}
