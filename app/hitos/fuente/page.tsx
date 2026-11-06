"use client";

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { useEffect, useMemo, useState } from "react";

type Milestone = {
  id: string;
  participant_name: string;
  category: string | null;
  source_url: string | null;
};

type State = { milestones: Milestone[] };

export default function MilestoneSourcePage() {
  const [hitoId] = useState(() =>
    typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("hito") ?? ""
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/hitos", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data as State;
      })
      .then((data) => { if (!controller.signal.aborted) setMilestones(data.milestones); })
      .catch((error) => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se ha podido cargar la fuente."); });
    return () => controller.abort();
  }, []);

  const milestone = useMemo(() => milestones.find((item) => item.id === hitoId) ?? null, [hitoId, milestones]);
  const sourceUrl = milestone?.source_url ?? "";
  const title = milestone?.participant_name ?? (hitoId || "Fuente del hito");

  return <main className="min-h-screen bg-neutral-100">
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={82} height={44} priority/>
          <span className="hidden text-sm font-bold sm:block">RUGBY - HUB</span>
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <b className="block truncate text-sm">{title} (borrar)</b>
          <small className="block truncate text-neutral-500">{milestone?.category ?? "Fuente original"}</small>
        </div>
        <Link href={hitoId ? `/hitos?hito=${encodeURIComponent(hitoId)}` : "/hitos"} className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-bold text-neutral-800 shadow-sm hover:border-red-200 hover:text-red-700">Volver a hitos</Link>
      </div>
    </header>
    <section className="h-[calc(100vh-69px)]">
      {notice && <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white p-5 text-sm shadow-sm">{notice}</div>}
      {!notice && !milestone && <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white p-5 text-sm text-neutral-500 shadow-sm">Cargando fuente...</div>}
      {!notice && milestone && !sourceUrl && <div className="mx-auto mt-8 max-w-2xl rounded-xl bg-white p-5 text-sm shadow-sm">Este hito no tiene fuente real cargada.</div>}
      {sourceUrl && <iframe src={sourceUrl} title={`Fuente de ${milestone?.id ?? hitoId}`} className="h-full w-full border-0 bg-white" referrerPolicy="no-referrer-when-downgrade" sandbox="allow-forms allow-popups allow-same-origin allow-scripts"/>}
    </section>
  </main>;
}
