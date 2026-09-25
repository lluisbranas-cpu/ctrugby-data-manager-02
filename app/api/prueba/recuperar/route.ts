import { NextRequest, NextResponse } from "next/server";
import { client, configured, sameOrigin, COOKIE } from "@/lib/pilot";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status,
  headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!configured()) return reply({ error: "Servicio no configurado." }, 503);
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
  if (!token || token.length > 8192) return reply({ error: "Abre un enlace de recuperación válido." }, 401);
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply({ error: "Formulario demasiado grande." }, 413);
    const { password } = JSON.parse(raw);
    if (typeof password !== "string" || password.length < 12 || password.length > 128)
      return reply({ error: "Usa entre 12 y 128 caracteres." }, 400);
    const db = client(token);
    const user = await db.auth.getUser(token);
    if (user.error || !user.data.user) return reply({ error: "El enlace ha caducado. Necesitas un correo de recuperación nuevo." }, 401);
    const role = await db.rpc("pilot_is_admin");
    if (role.error || role.data !== true) return reply({ error: "Cuenta no autorizada para esta prueba." }, 403);
    const response = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
      method: "PUT", cache: "no-store",
      headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const error = await response.json();
      if (error.code === "same_password") return reply({ error: "Elige una contraseña distinta de la anterior." }, 400);
      return reply({ error: "No se pudo cambiar la contraseña. Comprueba que el enlace sigue vigente y usa una contraseña más fuerte." }, 400);
    }
    await db.auth.admin.signOut(token, "global");
    const result = reply({ ok: true });
    result.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return result;
  } catch { return reply({ error: "No se pudo completar la recuperación. Inténtalo de nuevo." }, 400); }
}
