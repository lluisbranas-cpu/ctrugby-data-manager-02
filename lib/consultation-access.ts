import { NextRequest, NextResponse } from "next/server";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export async function requireConsultation(request: NextRequest) {
  if (catalogConfigured()) {
    try {
      const access = await catalogAccess(request);
      if (access.authenticated || access.guest) return null;
    } catch { /* Fail closed when the identity service is unavailable. */ }
  }
  return NextResponse.json({ error: "Regístrate como invitado y confirma tu correo, o inicia sesión en tu acceso privado.", accessRequired: true }, {
    status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
