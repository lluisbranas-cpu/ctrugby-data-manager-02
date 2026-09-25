import { NextRequest, NextResponse } from "next/server";
import { access, client, configured, COOKIE, PLAYER, sameOrigin } from "@/lib/pilot";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, {
  status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
});
const recoveryRequests = new Map<string, number>();
export async function GET(request: NextRequest) {
  if (!configured()) return reply({ configured: false, admin: false });
  try {
    const { db, admin } = await access(request);
    const { data, error } = await db.from("pilot_players")
      .select("id,name,season,version,photo_key,pilot_clubs(name)").eq("id", PLAYER).maybeSingle();
    if (error) return reply({ error: "No se pueden leer las tablas. Comprueba la conexión y la migración SQL." }, 503);
    let notes: string | undefined;
    if (admin) {
      const result = await db.from("pilot_assessments").select("notes").eq("player_id", PLAYER).maybeSingle();
      if (result.error) return reply({ error: "No se ha podido cargar la evaluación privada." }, 503);
      notes = result.data?.notes ?? "";
    }
    const photoUrl = data?.photo_key
      ? db.storage.from("pilot-media-public").getPublicUrl(data.photo_key).data.publicUrl : null;
    return reply({ configured: true, admin, player: data ? { ...data, photoUrl } : null,
      ...(admin ? { notes } : {}) });
  } catch { return reply({ error: "No se ha podido conectar con el almacenamiento." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({ error: "Origen no permitido." }, 403);
  if (!configured()) return reply({ error: "La prueba todavía no está conectada." }, 503);
  try {
    const raw = await request.text();
    if (raw.length > 16000) return reply({ error: "Formulario demasiado grande." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "logout") {
      const token = request.cookies.get(COOKIE)?.value;
      if (token) await client(token).auth.admin.signOut(token, "local");
      const response = reply({ ok: true });
      response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
      return response;
    }
    if (body.action === "recover") {
      if (typeof body.email !== "string" || body.email.length > 254)
        return reply({ error: "Indica un correo válido." }, 400);
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return reply({ error: "Indica un correo válido." }, 400);
      const previous = recoveryRequests.get(email) ?? 0;
      if (Date.now() - previous < 60_000)
        return reply({ ok: true });
      const result = await client().auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/recuperar", request.nextUrl.origin).toString(),
      });
      if (result.error) {
        if (/redirect|url/i.test(result.error.message))
          return reply({ error: "La URL local de recuperación todavía no está autorizada en Supabase." }, 503);
        return reply({ error: "No se ha podido solicitar la recuperación. Vuelve a intentarlo en unos instantes." }, 503);
      }
      recoveryRequests.set(email, Date.now());
      return reply({ ok: true });
    }
    if (body.action === "login") {
      if (typeof body.email !== "string" || typeof body.password !== "string" ||
          body.email.length > 254 || body.password.length > 1024)
        return reply({ error: "Credenciales inválidas." }, 400);
      const db = client();
      const result = await db.auth.signInWithPassword({ email: body.email.trim().toLowerCase(), password: body.password });
      if (result.error || !result.data.session) {
        const code = result.error?.code;
        if (code === "invalid_credentials") return reply({ error: "Correo o contraseña incorrectos. Usa la contraseña del usuario de la app, no la de GitHub ni la de la base de datos." }, 401);
        if (code === "email_not_confirmed") return reply({ error: "El correo de esta cuenta todavía no está confirmado." }, 401);
        if (result.error?.status === 429) return reply({ error: "Demasiados intentos. Espera unos minutos antes de volver a entrar." }, 429);
        return reply({ error: "No se ha podido conectar con el servicio de acceso. Vuelve a intentarlo en unos instantes." }, 503);
      }
      const token = result.data.session.access_token;
      const role = await client(token).rpc("pilot_is_admin");
      if (role.error || role.data !== true) {
        await db.auth.signOut();
        return reply({ error: "Esta cuenta no es administradora de la prueba." }, 403);
      }
      const response = reply({ ok: true });
      response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "strict",
        secure: process.env.NODE_ENV === "production", path: "/",
        maxAge: Math.min(result.data.session.expires_in, 3600) });
      return response;
    }
    const { db, admin } = await access(request);
    if (!admin) return reply({ error: "Acceso de administrador requerido." }, 403);
    if (body.action !== "save" ||
        ![body.name, body.club, body.season, body.notes].every(value => typeof value === "string") ||
        !body.name.trim() || body.name.length > 100 || !body.club.trim() || body.club.length > 100 ||
        !/^\d{4}\/\d{4}$/.test(body.season) || body.notes.length > 2000 ||
        !Number.isInteger(body.version) || body.version < 0)
      return reply({ error: "Revisa nombre, club, temporada y evaluación." }, 400);
    const result = await db.rpc("pilot_save", {
      p_name: body.name.trim(), p_club: body.club.trim(), p_season: body.season,
      p_notes: body.notes, p_version: body.version,
    });
    if (result.error) return reply({ error: result.error.code === "40001"
      ? "Otra sesión ha cambiado la ficha. Recarga antes de guardar."
      : "No se ha podido guardar la ficha." }, result.error.code === "40001" ? 409 : 503);
    return reply({ ok: true });
  } catch { return reply({ error: "No se ha podido procesar la petición." }, 400); }
}
