export const GUEST_COOKIE = "ctrugby-guest-session";
export const GUEST_PENDING_COOKIE = "ctrugby-guest-pending";
export type GuestRegistration = { kind: "guest-registration"; name: string; email: string; phone: string; createdAt: number };

export function guestFields(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/[\s().-]/g, "") : "";
  if (name.length < 2 || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+[1-9][0-9]{7,14}$/.test(phone)) return null;
  return { name, email, phone };
}
