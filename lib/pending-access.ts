import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret() {
  const key = process.env.CTRUGBY_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("La confirmación privada no está configurada.");
  return key;
}

function encryptionKey() {
  return createHash("sha256").update(`ctrugby-private-cookie:${secret()}`).digest();
}

export function sealPending(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(`ctrugby-pending:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function sealPrivate(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openPrivate<T>(value: string): T | null {
  try {
    if (value.length > 12_000) return null;
    const [version, encodedIv, encodedTag, encodedData, extra] = value.split(".");
    if (version !== "v1" || !encodedIv || !encodedTag || !encodedData || extra) return null;
    const iv = Buffer.from(encodedIv, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    if (iv.length !== 12 || tag.length !== 16) return null;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encodedData, "base64url")), decipher.final()]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
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
