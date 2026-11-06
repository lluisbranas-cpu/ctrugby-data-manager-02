import Link from "@/app/components/sport-link";

export function LegalFooter({ dataOrigin }: { dataOrigin: string }) {
  return <footer className="mt-auto border-t border-neutral-200 bg-white px-4 py-5 text-center text-xs text-neutral-500 sm:px-6">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
      <span>© {new Date().getFullYear()} LIKID MK Services</span>
      <span className="text-neutral-400">Origen de datos: {dataOrigin}</span>
      <Link className="font-semibold hover:text-red-700" href="/aviso-legal">Aviso legal</Link>
      <Link className="font-semibold hover:text-red-700" href="/privacidad">Privacidad</Link>
      <Link className="font-semibold hover:text-red-700" href="/cookies">Cookies</Link>
      <Link className="font-semibold hover:text-red-700" href="/condiciones-de-uso">Condiciones de uso</Link>
    </div>
  </footer>;
}
