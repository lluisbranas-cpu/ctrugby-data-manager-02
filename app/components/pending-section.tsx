import Image from "next/image";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";

export function PendingSection({ current, title, description }: { current: "participations" | "staff" | "milestones"; title: string; description: string }) {
  return <main className="catalog-app"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="Rugby" width={100} height={54}/><span><strong>RUGBY</strong></span></Link><ManagerMenu current={current}/></header><section className="catalog-workspace"><div className="catalog-content"><header className="territory-heading"><p>RUGBY · GESTIÓN</p><h1>{title}</h1><span>{description}</span></header><section className="catalog-warning"><b>Preparación del módulo</b><span>La navegación y el contador ya están listos. Construiremos este listado en el siguiente paso.</span></section></div></section></main>;
}
