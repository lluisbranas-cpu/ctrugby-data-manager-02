import Image from "next/image";
import Link from "@/app/components/sport-link";

const sports: Record<string, { name: string; icon: string }> = {
  futbol: { name: "Fútbol", icon: "⚽" },
  basquet: { name: "Básquet", icon: "🏀" },
  hockey: { name: "Hockey", icon: "🏑" },
};

export default async function SportPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const item = sports[sport] ?? { name: "Deporte", icon: "🏅" };
  return <main className="min-h-screen bg-[#f5f6f6] text-[#252d32]">
    <header className="flex h-[72px] items-center bg-[#1b4980] px-4 shadow-[0_3px_14px_rgba(14,42,75,.22)] sm:px-7">
      <Link href="/" aria-label="Volver a LIKID Sport Hub"><Image src="/likid-logo-inverse.png" alt="LIKID" width={116} height={60} priority /></Link>
    </header>
    <section className="mx-auto max-w-4xl px-5 py-20 sm:px-8"><p className="text-xs font-black tracking-[.16em] text-[#1b4980]">LIKID SPORT HUB</p><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl"><span aria-hidden="true">{item.icon} </span>{item.name}</h1><p className="mt-6 max-w-xl text-lg leading-8 text-neutral-600">Estamos preparando este espacio. Muy pronto podrás descubrir su comunidad, protagonistas y actividad.</p><Link href="/" className="mt-10 inline-flex rounded-full border border-[#1b4980] bg-[#1b4980] px-5 py-3 text-sm font-bold text-white hover:bg-[#12365f]">Volver a deportes</Link></section>
  </main>;
}
