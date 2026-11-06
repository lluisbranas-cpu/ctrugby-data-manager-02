import { randomUUID } from "node:crypto";
import { catalogClient } from "@/lib/catalog";

export type LoginContact = { subject_kind: "administrator" | "player" | "club"; subject_id: string; phone_e164: string | null };
export const ACCESS_PENDING_COOKIE = "ctrugby-access-pending";
export type PendingAccess = {
  purpose?: "club";
  provider?: "google";
  token: string;
  createdAt: number;
  contact?: LoginContact;
  factorId?: string;
  challengeId?: string;
};
export const normalizePhone = (value: string) => value.replace(/[\s().-]/g, "");
export const destinationFor = (contact: LoginContact) => contact.subject_kind === "administrator" ? "/jugadores" : contact.subject_kind === "player" ? `/jugadores/${contact.subject_id}` : `/clubs/${contact.subject_id}`;

export async function loginContacts(token: string): Promise<LoginContact[]> {
  const db = catalogClient(token);
  const user = await db.auth.getUser(token);
  if (user.error || !user.data.user?.email_confirmed_at) return [];
  const result = await db.rpc("app_login_contacts");
  if (result.error) throw new Error("El acceso privado requiere actualizar la configuración de seguridad en Supabase.");
  return (result.data ?? []) as LoginContact[];
}

type Factor = { id: string; factor_type: string; status: string; friendly_name?: string };
type AuthReply = { id?: string; access_token?: string; factors?: Factor[]; totp?: { qr_code: string; secret: string; uri: string } };
async function authRequest(token: string, resource: string, body?: object, method?: string): Promise<AuthReply> {
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/${resource}`, {
    method: method ?? (body ? "POST" : "GET"), cache: "no-store", signal: AbortSignal.timeout(15_000),
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY!, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(response.status === 429 ? "Demasiados intentos. Espera antes de volver a intentarlo." : "No se ha podido validar la app autenticadora. Comprueba el código y vuelve a intentarlo.");
  return response.json() as Promise<AuthReply>;
}

export async function beginAuthenticator(token: string) {
  const user = await authRequest(token, "user");
  let factor = user.factors?.find((item) => item.factor_type === "totp" && item.status === "verified");
  let setup: { qrCode: string; secret: string } | undefined;
  if (!factor) {
    // Only discard unfinished CTRugby enrollments; never reset a verified factor.
    for (const unfinished of user.factors ?? []) {
      if (unfinished.factor_type === "totp" && unfinished.status === "unverified" && unfinished.friendly_name?.startsWith("CTRugby ")) {
        await authRequest(token, `factors/${encodeURIComponent(unfinished.id)}`, undefined, "DELETE");
      }
    }
    const enrolled = await authRequest(token, "factors", { factor_type: "totp", issuer: "CTRugby", friendly_name: `CTRugby ${randomUUID()}` });
    if (!enrolled.id || !enrolled.totp?.qr_code || !enrolled.totp.secret) throw new Error("No se ha podido preparar la app autenticadora.");
    factor = { id: enrolled.id, factor_type: "totp", status: "unverified" };
    setup = { qrCode: enrolled.totp.qr_code.startsWith("data:image/svg+xml") ? enrolled.totp.qr_code : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrolled.totp.qr_code)}`, secret: enrolled.totp.secret };
  }
  const challenge = await authRequest(token, `factors/${encodeURIComponent(factor.id)}/challenge`, {});
  if (!challenge.id) throw new Error("No se ha podido preparar la confirmación de acceso.");
  return { factorId: factor.id, challengeId: challenge.id, setup };
}

export async function finishAuthenticator(token: string, factorId: string, challengeId: string, code: string) {
  const user = await authRequest(token, "user");
  if (!user.id || !user.factors?.some((factor) => factor.id === factorId && factor.factor_type === "totp")) throw new Error("La app autenticadora no pertenece a esta cuenta.");
  const verified = await authRequest(token, `factors/${encodeURIComponent(factorId)}/verify`, { challenge_id: challengeId, code });
  if (!verified.access_token) throw new Error("El código de la app autenticadora no es válido.");
  const db = catalogClient(verified.access_token);
  const checked = await db.auth.getUser(verified.access_token);
  if (checked.error || checked.data.user?.id !== user.id) throw new Error("La sesión no es válida.");
  const access = await db.rpc("app_has_private_access");
  if (access.error || access.data !== true) throw new Error("La cuenta ya no tiene acceso privado autorizado.");
  return verified.access_token;
}
