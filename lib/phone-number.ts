/** Spanish numbers default to +34; explicit international prefixes are preserved. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  if (/^[0-9]{9}$/.test(phone)) return "+34" + phone;
  return phone;
}
export function formatSpanishPhone(value: unknown): string {
  const phone = normalizePhone(value);
  if (!phone) return "";
  const match = /^\+34([0-9]{3})([0-9]{3})([0-9]{3})$/.exec(phone);
  return match ? "+34 " + match[1] + " " + match[2] + " " + match[3] : phone;
}
