import Image from "next/image";
import Link from "@/app/components/sport-link";
import { ManagerMenu } from "@/app/components/manager-menu";

export default function WorldRugbyPage() {
  return <main className="directory-app min-h-screen"><header className="catalog-topbar"><Link href="/" className="catalog-brand"><Image src="/ctrugby-logo-contrast.webp" alt="CTRugby" width={100} height={54} priority/><span><strong>RUGBY - HUB</strong></span></Link><ManagerMenu current="federations"/></header><div className="mx-auto max-w-6xl px-5 py-5 sm:px-8"><div className="federation-web-head"><div><img src="/world-rugby-logo.png" alt="World Rugby"/><div><p>AFILIACIÓN INTERNACIONAL</p><h1>World Rugby</h1></div></div></div><iframe src="/api/world-rugby/web" title="Web oficial de World Rugby" className="federation-web-frame" sandbox="" /></div></main>;
}
