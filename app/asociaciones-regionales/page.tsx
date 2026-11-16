import Link from "@/app/components/sport-link";
import { RegionalAssociationsTable } from "@/app/asociaciones-regionales/regional-associations-table";
import { ManagerMenu } from "@/app/components/manager-menu";

export default function RegionalAssociationsPage() {
  return <main className="directory-app min-h-screen">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="federations" /></header>
    <section className="directory-cover"><div className="directory-cover-copy"><p><i className="ctrugby-marker" /><b>Rugby</b><i />DIRECTORIO CONTINENTAL</p><h1>CONFEDERACIONES REGIONALES</h1><span>Las seis confederaciones regionales de rugby</span></div></section>
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8"><RegionalAssociationsTable /></div>
  </main>;
}
