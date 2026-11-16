import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { readOperationalDocument, upsertOperationalDocument } from "@/lib/operational-store";
import { normalizeRugbyCabreraWebConfig, normalizeRugbyCabreraWebDocument, rugbyCabreraWebDefaults } from "@/lib/web-page-config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// `operational_documents.document_key` only accepts lowercase keys. The URL may
// use ESP022, but persistence must use the normalized storage key.
const keyFor = (client: string, page: string) => `${client.toLowerCase()}/${page.toLowerCase()}`;
const allowed = (client: string, page: string) => client.toUpperCase() === "ESP022" && page.toLowerCase() === "home";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: NextRequest, context: RouteContext<"/api/web/[client]/[page]">) {
  const { client, page } = await context.params;
  if (!allowed(client, page)) return reply({ error: "Página no encontrada." }, 404);
  const stored = await readOperationalDocument<unknown>("web-pages", keyFor(client, page)).catch(() => null);
  const document = normalizeRugbyCabreraWebDocument(stored?.payload ?? rugbyCabreraWebDefaults);
  if (request.nextUrl.searchParams.get("mode") === "editor") {
    if (!(await catalogAccess(request)).admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    return reply({ config: document.draft, published: document.published, version: stored?.version ?? 0 });
  }
  // The club website renders the saved working version so editor changes are
  // visible as soon as they are saved, without a separate publishing step.
  return reply({ config: document.draft, version: stored?.version ?? 0 });
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/web/[client]/[page]">) {
  const { client, page } = await context.params;
  if (!allowed(client, page) || !sameOrigin(request)) return reply({ error: "Solicitud no permitida." }, 403);
  const access = await catalogAccess(request);
  if (!access.admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return reply({ error: "Configuración no válida." }, 400);
  const stored = await readOperationalDocument<unknown>("web-pages", keyFor(client, page)).catch(() => null);
  const document = normalizeRugbyCabreraWebDocument(stored?.payload ?? rugbyCabreraWebDefaults);
  const config = normalizeRugbyCabreraWebConfig((body as { config?: unknown }).config);
  // The in-app constructor is the live editor: saving a block, logo or color
  // must be reflected on the public club site immediately.
  const updated = { ...document, draft: config, published: config };
  await upsertOperationalDocument("web-pages", keyFor(client, page), updated);
  return reply({ ok: true, config: updated.draft, published: updated.published });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/web/[client]/[page]">) {
  const { client, page } = await context.params;
  if (!allowed(client, page) || !sameOrigin(request)) return reply({ error: "Solicitud no permitida." }, 403);
  if (!(await catalogAccess(request)).admin) return reply({ error: "Acceso de administrador requerido." }, 403);
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  if (body?.action !== "publish") return reply({ error: "Acción no válida." }, 400);
  const stored = await readOperationalDocument<unknown>("web-pages", keyFor(client, page)).catch(() => null);
  const document = normalizeRugbyCabreraWebDocument(stored?.payload ?? rugbyCabreraWebDefaults);
  const updated = { draft: document.draft, published: document.draft };
  await upsertOperationalDocument("web-pages", keyFor(client, page), updated);
  return reply({ ok: true, config: updated.published });
}
