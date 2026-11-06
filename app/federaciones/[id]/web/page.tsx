"use client";
/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
import Link from "@/app/components/sport-link";
import { useParams } from "@/lib/sport-navigation";
import { useEffect, useState } from "react";
import { ManagerMenu } from "@/app/components/manager-menu";
import { federationShieldUrl } from "@/app/lib/federation-shields";

type Federation = { id: string; name: string; website: string | null };
type State = { federations: Federation[] };

export default function FederationWebsitePage() {
  const params = useParams<{ id: string }>();
  const [federation, setFederation] = useState<Federation | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/federaciones", { cache: "no-store", signal: controller.signal }).then((response) => response.json()).then((data: State) => setFederation(data.federations?.find((item) => item.id === params.id) ?? null)).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [params.id]);
  return <main className="directory-app min-h-screen"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="federations"/></header><div className="mx-auto max-w-6xl px-5 py-5 sm:px-8">{failed ? <p className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">No se ha podido cargar esta federación.</p> : !federation ? <p className="p-5 text-neutral-500">Cargando ficha…</p> : <><div className="federation-web-head"><div>{federationShieldUrl(federation.id) && <img src={federationShieldUrl(federation.id)!} alt=""/>}<div><p>WEB OFICIAL</p><h1>{federation.name}</h1></div></div></div>{federation.website ? <iframe src={`/api/federaciones/${federation.id}/web`} title={`Web de ${federation.name}`} className="federation-web-frame" sandbox="" /> : <p className="rounded-xl bg-white p-5 text-neutral-600">Esta federación todavía no tiene una web registrada.</p>}</>}</div></main>;
}