import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const key = process.env.CTRUGBY_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("La confirmación privada no está configurada.");
  return key;
}

export function sealPending(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(`ctrugby-pending:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function openPending<T>(value: string): T | null {
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra || value.length > 12_000) return null;
    const expected = createHmac("sha256", secret()).update(`ctrugby-pending:${payload}`).digest();
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch { return null; }
}
