import { NextResponse } from "next/server";

// Password changes always use the account recovery flow, including on localhost.
export async function POST() {
  return NextResponse.json({ error: "Usa la recuperación de contraseña por correo desde Acceso privado." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
