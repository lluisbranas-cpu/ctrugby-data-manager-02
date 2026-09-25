export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-red-900">
      <div className="text-center">
        <h1 className="text-6xl font-black text-white">
          CTRugby
        </h1>

        <h2 className="mt-4 text-3xl font-semibold text-red-500">
          Diseño App
        </h2>

        <p className="mt-8 text-neutral-300">
          Nueva generación del Data Manager
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <a href="/clubs" className="inline-block rounded-full bg-red-600 px-6 py-3 font-semibold text-white">Ver clubs publicados</a>
          <a href="/federaciones" className="inline-block rounded-full border border-white/40 px-6 py-3 font-semibold text-white">Ver federaciones</a>
        </div>
      </div>
    </main>
  );
}
