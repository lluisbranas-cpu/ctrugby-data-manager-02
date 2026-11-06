"use client";
import Link from "@/app/components/sport-link";
import { usePathname } from "@/lib/sport-navigation";
import type { ReactNode } from "react";

export function PlayerActivityLink({playerId, kind, federation, children, className, title, "aria-label": ariaLabel}: {
  playerId: string; kind: "participaciones" | "convocatorias"; federation?: string; children: ReactNode; className?: string; title?: string; "aria-label"?: string;
}) {
  const pathname = usePathname();
  const query = new URLSearchParams({volver: pathname + "#player-activity-" + playerId});
  if (federation) query.set("federacion", federation);
  return <Link href={"/jugadores/" + encodeURIComponent(playerId) + "/" + kind + "?" + query.toString()} className={className} title={title} aria-label={ariaLabel}>{children}</Link>;
}
