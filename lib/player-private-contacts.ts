import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type LocalPlayerContacts = {
  player_email: string | null;
  player_phone_e164: string | null;
  tutor1_name: string | null;
  tutor1_email: string | null;
  tutor1_phone_e164: string | null;
  tutor2_name: string | null;
  tutor2_email: string | null;
  tutor2_phone_e164: string | null;
  updated_at?: string | null;
};

const contactsDir = () => path.join(process.cwd(), "data", "staging", "player-private-contacts");
const contactsFilename = (id: string) => path.join(contactsDir(), `${id}.json`);
const cleanText = (value: unknown, maximum = 160) => typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : null;
const cleanEmail = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim().toLowerCase() : null;
const cleanPhone = (value: unknown) => typeof value === "string" && /^\+[1-9][0-9]{7,14}$/.test(value.trim()) ? value.trim() : null;

export const blankPlayerContacts = (): LocalPlayerContacts => ({
  player_email: null,
  player_phone_e164: null,
  tutor1_name: null,
  tutor1_email: null,
  tutor1_phone_e164: null,
  tutor2_name: null,
  tutor2_email: null,
  tutor2_phone_e164: null,
});

export async function readLocalPlayerContacts(id: string): Promise<LocalPlayerContacts | null> {
  try {
    const raw = JSON.parse(await readFile(contactsFilename(id), "utf8")) as Record<string, unknown>;
    return {
      player_email: cleanEmail(raw.player_email),
      player_phone_e164: cleanPhone(raw.player_phone_e164),
      tutor1_name: cleanText(raw.tutor1_name),
      tutor1_email: cleanEmail(raw.tutor1_email),
      tutor1_phone_e164: cleanPhone(raw.tutor1_phone_e164),
      tutor2_name: cleanText(raw.tutor2_name),
      tutor2_email: cleanEmail(raw.tutor2_email),
      tutor2_phone_e164: cleanPhone(raw.tutor2_phone_e164),
      updated_at: cleanText(raw.updated_at, 40),
    };
  } catch {
    return null;
  }
}

export async function saveLocalPlayerContacts(id: string, contacts: LocalPlayerContacts) {
  await mkdir(contactsDir(), { recursive: true });
  const next = {
    ...blankPlayerContacts(),
    ...contacts,
    updated_at: new Date().toISOString(),
  };
  await writeFile(contactsFilename(id), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}
