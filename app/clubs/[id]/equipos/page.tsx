"use client";

import { ClubPageClose } from "@/app/components/club-page-close";
import { AlellaClub } from "@/app/components/alella-club";
import { BadalonaClub } from "@/app/components/badalona-club";
import { CabreraClub } from "@/app/components/cabrera-club";
import { useParams, useRouter } from "@/lib/sport-navigation";
import { useEffect, useState } from "react";

type Player = { id: string; first_name: string; last_name: string | null; birth_year?: number | null; position_text: string | null; roster_category?: string; current_club?: boolean; season_year?: number | null; club_seasons?: { season_year: number; position_text: string | null }[] };
type State = { admin: boolean; players: Player[] };

export default function ClubTeamsPage() { return <><ClubPageClose /><ClubTeamsContent /></>; }

function ClubTeamsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id).toUpperCase();
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!["ESP0022", "ESP0023", "ESP0010"].includes(id)) return;
    const controller = new AbortController();
    void fetch(`/api/clubs/${id}?view=teams`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<State>; })
      .then(setState)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [id]);

  if (!["ESP0022", "ESP0023", "ESP0010"].includes(id) || failed) return <main className="directory-app p-8"><p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">No se ha podido cargar la página de equipos.</p></main>;
  if (!state) return <main className="directory-app p-8 text-neutral-500">Cargando equipos…</main>;
  if (id === "ESP0010") return <AlellaClub players={state.players} />;
  if (id === "ESP0023") return <BadalonaClub players={state.players} />;
  return <CabreraClub players={state.players} admin={state.admin} onManagement={() => router.push(`/clubs/${id}`)} />;
}
