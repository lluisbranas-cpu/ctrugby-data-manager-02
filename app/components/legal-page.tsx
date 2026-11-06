import Link from "@/app/components/sport-link";
import type { ReactNode } from "react";

type Section = { title: string; content: ReactNode };

export function LegalPage({ eyebrow, title, updated, sections }: { eyebrow: string; title: string; updated: string; sections: Section[] }) {
  return <main className="min-h-full bg-neutral-50 px-4 py-8 sm:px-6 sm:py-12">
    <article className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <header className="border-b border-neutral-200 bg-neutral-900 px-6 py-8 text-white sm:px-10">
        <p className="text-xs font-black tracking-[.16em] text-red-400">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm text-neutral-300">Última actualización: {updated}</p>
      </header>
      <div className="space-y-8 px-6 py-8 text-sm leading-7 text-neutral-700 sm:px-10 sm:py-10">
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"><strong>Documento provisional.</strong> Los campos marcados como XXXX deben ser completados y este contenido revisado antes de su publicación definitiva.</p>
        {sections.map((section) => <section key={section.title}><h2 className="mb-3 text-xl font-black tracking-tight text-neutral-900">{section.title}</h2><div className="space-y-3">{section.content}</div></section>)}
        <p className="border-t border-neutral-200 pt-6"><Link href="/" className="font-bold text-red-700 hover:underline">← Volver al inicio</Link></p>
      </div>
    </article>
  </main>;
}
