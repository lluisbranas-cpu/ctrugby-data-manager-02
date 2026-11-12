import Image from "next/image";
import Link from "@/app/components/sport-link";

const sports = [
  { name: "Rugby", icon: "🏉", href: "/rugby/likid/jugadores", description: "Jugadores, clubs, federaciones y convocatorias" },
  { name: "Fútbol", icon: "⚽", href: "/deportes/futbol", description: "Próximamente" },
  { name: "Básquet", icon: "🏀", href: "/deportes/basquet", description: "Próximamente" },
  { name: "Hockey", icon: "🏑", href: "/deportes/hockey", description: "Próximamente" },
];

export default function Home() {
  return <main className="min-h-screen bg-[#f5f6f6] text-[#252d32]">
    <header className="flex h-[76px] items-center bg-[#1b4980] px-5 shadow-[0_3px_14px_rgba(14,42,75,.22)] sm:px-8">
      <Image src="/likid-logo-inverse.png" alt="LIKID" width={116} height={60} priority />
    </header>
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs font-black tracking-[.18em] text-[#1b4980]">LIKID SPORT HUB</p>
      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl">Elige tu deporte</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-600 sm:text-lg">Accede a la comunidad, protagonistas y actividad de cada deporte.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {sports.map((sport) => <Link key={sport.name} href={sport.href} className="group rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#1b4980] hover:shadow-md">
          <span className="text-4xl" aria-hidden="true">{sport.icon}</span>
          <h2 className="mt-5 text-2xl font-black">{sport.name}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">{sport.description}</p>
          <span className="mt-5 inline-block text-sm font-black text-[#1b4980]">Entrar →</span>
        </Link>)}
      </div>
    </section>
  </main>;
}
