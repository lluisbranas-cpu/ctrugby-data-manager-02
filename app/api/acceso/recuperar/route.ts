import { requestOrigin } from "@/lib/request-origin";
import { NextRequest, NextResponse } from "next/server";
import { catalogClient, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";
const requests = new Map<string, number>();

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (!catalogConfigured()) return NextResponse.json({ error: "El acceso todavía no está configurado." }, { status: 503 });
  try {
    const body = await request.json() as { email?: unknown };
    if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return NextResponse.json({ error: "Indica un correo válido." }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    const previous = requests.get(email) || 0;
    if (Date.now() - previous >= 60_000) {
      const result = await catalogClient().auth.resetPasswordForEmail(email, { redirectTo: new URL("/restablecer", requestOrigin(request)!).toString() });
      if (result.error) {
        const failure = result.error as { code?: string; status?: number; message: string };
        if (failure.code === "over_email_send_rate_limit" || failure.status === 429) return NextResponse.json({ error: "Se ha alcanzado el límite temporal de envíos. Espera unos minutos antes de solicitar otro enlace." }, { status: 429 });
        if (/redirect|url/i.test(failure.message)) return NextResponse.json({ error: "La URL de recuperación todavía no está autorizada en Supabase." }, { status: 503 });
        return NextResponse.json({ error: "No se ha podido enviar el enlace. Vuelve a intentarlo en unos instantes." }, { status: 503 });
      }
      requests.set(email, Date.now());
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "No se ha podido procesar la solicitud." }, { status: 400 }); }
}
