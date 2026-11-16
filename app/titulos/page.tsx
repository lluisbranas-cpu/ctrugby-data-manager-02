import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";
import PlayerTitlesManager from "./title-manager";

export default function TitlesPage() {
  return <main className="catalog-app">
    <header className="catalog-topbar"><Link href="/" className="catalog-brand"><strong>RUGBY - HUB</strong></Link><ManagerMenu current="titles" /></header>
    <div className="catalog-shell"><section className="catalog-workspace"><div className="catalog-content"><PlayerTitlesManager /></div></section></div>
  </main>;
}
