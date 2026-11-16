import Link from "next/link";
import { ManagerMenu } from "@/app/components/manager-menu";

const categories = [
  { id: "CAT-S06", name: "S6" }, { id: "CAT-S08", name: "S8" }, { id: "CAT-S10", name: "S10" },
  { id: "CAT-S12", name: "S12" }, { id: "CAT-S14", name: "S14" }, { id: "CAT-S16", name: "S16" },
  { id: "CAT-S17", name: "S17" }, { id: "CAT-S18", name: "S18" }, { id: "CAT-S20", name: "S20" },
  { id: "CAT-S23", name: "S23" }, { id: "CAT-SEN", name: "Sénior" },
];

export default function SportsCategoriesPage() {
  return (
    <main className="catalog-app min-h-screen">
      <header className="catalog-header">
        <Link href="/jugadores" className="catalog-brand"><strong>RUGBY - HUB</strong></Link>
        <ManagerMenu />
      </header>

      <section className="mx-auto max-w-4xl px-5 py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Convocatoria partidos</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Categorías deportivas FCR</h1>
        <p className="mt-3 text-slate-600">Categorías de la Federació Catalana de Rugby (FCR) disponibles para organizar las convocatorias de partidos.</p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <caption className="sr-only">Tabla de categorías deportivas</caption>
            <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-500">
              <tr><th scope="col" className="px-5 py-4">ID</th><th scope="col" className="px-5 py-4">Categoría</th></tr>
            </thead>
            <tbody>
              {categories.map((category) => <tr key={category.id} className="border-t border-slate-200"><td className="px-5 py-4 font-mono text-sm text-slate-600">{category.id}</td><td className="px-5 py-4 font-bold text-slate-900">{category.name}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
