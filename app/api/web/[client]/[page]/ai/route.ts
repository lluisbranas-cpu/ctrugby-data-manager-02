import { catalogAccess, sameOrigin } from "@/lib/catalog";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: NextRequest, context: RouteContext<"/api/web/[client]/[page]/ai">) {
  const { client, page } = await context.params;
  if (client.toUpperCase() !== "ESP022" || page.toLowerCase() !== "home" || !sameOrigin(request)) return reply({ error: "Solicitud no permitida." }, 403);
  if (!(await catalogAccess(request)).admin) return reply({ error: "Acceso de administrador requerido." }, 403);

  const body = await request.json().catch(() => null) as { prompt?: unknown; current?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 4000) : "";
  const current = body?.current && typeof body.current === "object" && !Array.isArray(body.current) ? body.current as Record<string, unknown> : null;
  if (!prompt) return reply({ error: "Escribe una instrucción para la IA." }, 400);
  if (!current || !Object.keys(current).length) return reply({ error: "Bloque no válido." }, 400);

  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_WEB_BUILDER_MODEL;
  if (!key || !model) return reply({ error: "La IA todavía no está configurada. Añade OPENAI_API_KEY y OPENAI_WEB_BUILDER_MODEL en el entorno seguro." }, 503);

  // The HTML template is manual code. AI edits only the structured fields.
  const editableKeys = Object.keys(current).filter(field => field !== "html");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: `Ets editor d'una web de rugby. No necessites HTML ni cap referència de disseny: construeix només el contingut estructurat del bloc. Respon únicament amb JSON vàlid, sense Markdown ni explicacions. Conserva exactament aquestes claus i retorna sempre valors de text: ${JSON.stringify(editableKeys)}.\n\nInstrucció del bloc:\n${prompt}\n\nValors actuals, només com a context de dades:\n${JSON.stringify(current)}`,
      max_output_tokens: 900,
    }),
  }).catch(() => null);
  if (!response?.ok) return reply({ error: "No se ha podido generar el texto. Revisa la configuración de IA." }, 502);

  const result = await response.json() as { output_text?: unknown };
  const text = typeof result.output_text === "string" ? result.output_text.trim().replace(/^```json\s*|\s*```$/g, "") : "";
  let generated: Record<string, unknown>;
  try {
    generated = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return reply({ error: "La IA no ha devuelto un bloque válido." }, 502);
  }
  const fields = Object.fromEntries(editableKeys.map(field => [field, typeof generated[field] === "string" ? generated[field].trim().slice(0, 1600) : current[field]]));
  return reply({ fields });
}
