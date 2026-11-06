"use client";
import Link from "@/app/components/sport-link";
import { useEffect, useMemo, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { FeaturedOrderTable } from "../featured-order-table";

type Player = { id: string; first_name: string; last_name: string | null; milestone_count?: number; selected_federation_ids?: string[]; professional_club_records?: unknown[] };
export default function FeaturedOrderPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [admin, setAdmin] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([fetch("/api/jugadores?view=public", { cache: "no-store", signal: controller.signal }), fetch("/api/destacados/order", { cache: "no-store", signal: controller.signal })]).then(async ([playersResponse, orderResponse]) => {
      const [data, orderData] = await Promise.all([playersResponse.json(), orderResponse.json()]);
      if (!playersResponse.ok || !orderResponse.ok) throw new Error(data.error || orderData.error);
      setPlayers(data.players ?? []); setOrder(orderData.order); setAdmin(data.admin); setLoaded(true);
    }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "No se ha podido cargar la tabla."); });
    return () => controller.abort();
  }, []);
  const featured = useMemo(() => players.filter((player) => (player.milestone_count ?? 0) > 0 || (player.selected_federation_ids?.length ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0), [players]);
  return <main className="catalog-app"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu current="featuredOrder" /></header><div className="catalog-shell"><section className="catalog-workspace"><div className="catalog-content"><h1 className="text-2xl font-black">Tabla de orden de destacados</h1><p className="text-sm text-neutral-600">El orden guardado se aplica a la página de Destacados.</p>{error && <p role="alert">{error}</p>}{!loaded && !error && <p>Cargando tabla…</p>}{loaded && (admin ? <FeaturedOrderTable players={featured} order={order} onSaved={setOrder} defaultOpen /> : <p>Acceso de administrador requerido.</p>)}<Link href="/jugadores/destacados" className="text-sm font-bold text-red-700">Ver Destacados →</Link></div></section></div></main>;
}
