import { NextRequest, NextResponse } from "next/server";
import { catalogClient, catalogConfigured, sameOrigin } from "@/lib/catalog";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (!catalogConfigured()) return NextResponse.json({ error: "El acceso todavía no está configurado." }, { status: 503 });
  try {
    const body = await request.json() as { accessToken?: unknown; password?: unknown };
    if (typeof body.accessToken !== "string" || typeof body.password !== "string" || body.password.length < 10 || body.password.length > 1024) return NextResponse.json({ error: "La contraseña debe tener entre 10 y 1024 caracteres." }, { status: 400 });
    const client = catalogClient(body.accessToken);
    const user = await client.auth.getUser(body.accessToken);
    if (user.error || !user.data.user) return NextResponse.json({ error: "El enlace ha caducado. Solicita uno nuevo." }, { status: 401 });
    const updated = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, { method: "PUT", headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${body.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: body.password }) });
    if (!updated.ok) return NextResponse.json({ error: "No se ha podido cambiar la contraseña. Solicita un enlace nuevo." }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "No se ha podido completar el restablecimiento." }, { status: 400 }); }
}
