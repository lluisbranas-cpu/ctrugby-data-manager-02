import Link from "@/app/components/sport-link";
import Image from "next/image";
import { AppVersion } from "./app-version";

/** Pie legal común. Los textos jurídicos se mantienen en sus rutas originales. */
export function LegalFooter({ dataOrigin: _dataOrigin }: { dataOrigin: string }) {
  return (
    <footer className="relative z-[1] mt-auto border-t border-[#183d63] bg-[#061e38] text-white" aria-label="Información legal y de la plataforma">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-14">
        <div className="space-y-3">
          <Link href="/" aria-label="LikidHub, volver a inicio" className="inline-flex items-center gap-3 no-underline">
            <Image src="/likid-logo-inverse.png" alt="LIKID" width={96} height={50} className="h-auto w-[96px] object-contain" />
            <span className="border-l border-white/30 pl-3 text-[11px] font-extrabold uppercase tracking-[.22em] text-[#c9e1fa]">Sport Hub</span>
          </Link>
          <p className="max-w-sm text-[13px] leading-6 text-[#adc4dc]">Una comunidad deportiva conectada. Información, clubes y protagonistas en un mismo lugar.</p>
        </div>
        <nav aria-label="Enlaces legales" className="grid grid-cols-2 gap-x-5 gap-y-4 text-[13px] font-semibold sm:grid-cols-4 md:justify-items-end">
          <Link href="/aviso-legal" className="text-[#e6f2ff] underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Aviso legal</Link>
          <Link href="/privacidad" className="text-[#e6f2ff] underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Privacidad</Link>
          <Link href="/condiciones-de-uso" className="text-[#e6f2ff] underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Condiciones de uso</Link>
          <Link href="/cookies" className="text-[#e6f2ff] underline-offset-4 transition hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Cookies</Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-4 text-[11px] text-[#93afcb] sm:px-8 lg:px-14">
          <span>© {new Date().getFullYear()} LIKID MK Services · Todos los derechos reservados.</span>
          <AppVersion />
        </div>
      </div>
    </footer>
  );
}
