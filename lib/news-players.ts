import path from "node:path";
import { readFile } from "./bounded-file-reads";

type NewsPlayer = { id: string; first_name?: string | null; last_name?: string | null };
export async function localNewsPlayers(): Promise<NewsPlayer[]> {
  const players = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8")) as NewsPlayer[];
  return players.filter(player => /^JUG\d{4}$/.test(player.id) && player.first_name?.trim());
}

export async function localNewsStaff(): Promise<NewsPlayer[]> {
  const staff = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "staff.json"), "utf8")) as NewsPlayer[];
  return staff.filter(person => /^STF\d{4}$/.test(person.id) && person.first_name?.trim());
}
