"use client";

import { CabreraWebRenderer } from "@/app/components/cabrera-web-renderer";
import { useRouter } from "@/lib/sport-navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeRugbyCabreraWebConfig, rugbyCabreraWebDefaults, type RugbyCabreraWebConfig } from "@/lib/web-page-config";

type Player = {
  id: string;
  first_name: string;
  last_name: string | null;
  nickname?: string | null;
  birth_year?: number | null;
  position_text: string | null;
  roster_category?: string;
  current_club?: boolean;
  season_year?: number | null;
  club_seasons?: { season_year: number; position_text: string | null; registration_number?: string | null }[];
};
type State = { admin: boolean; players: Player[] };

// /rugby/ESP022/web/home is the public, client-scoped Rugby Cabrera portal.
export default function RugbyCabreraWebPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<State | null>(null);
  const [content, setContent] = useState<RugbyCabreraWebConfig>(rugbyCabreraWebDefaults);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      fetch("/api/clubs/ESP0022?view=teams", { cache: "no-store", signal: controller.signal }),
      fetch("/api/web/ESP022/home", { cache: "no-store", signal: controller.signal }),
    ]).then(async ([clubResponse, webResponse]) => {
        if (!clubResponse.ok) throw new Error();
        const [club, web] = await Promise.all([clubResponse.json() as Promise<State>, webResponse.ok ? webResponse.json() as Promise<{ config?: RugbyCabreraWebConfig }> : Promise.resolve(null)]);
        setState(club);
        const useDraftPreview = searchParams.get("borrador") === "1";
        if (useDraftPreview) {
          try {
            const storedDraft = window.sessionStorage.getItem("rugby-cabrera-web-draft-preview");
            if (storedDraft) { setContent(normalizeRugbyCabreraWebConfig(JSON.parse(storedDraft))); return; }
          } catch { /* A corrupt preview is ignored and falls back to saved content. */ }
        }
        if (web?.config) setContent(web.config);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [searchParams]);

  if (failed) return <main className="directory-app p-8"><p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">No se ha podido cargar la web de Rugby Cabrera.</p></main>;
  if (!state) return <main className="directory-app p-8 text-neutral-500">Cargando Rugby Cabrera…</main>;
  return <CabreraWebRenderer content={content} admin={state.admin} onEdit={() => router.push("/web/home/editar")} />;
}
