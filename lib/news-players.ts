import path from "node:path";
import { readFile } from "./bounded-file-reads";

type NewsPlayer = { id: string; first_name?: string | null; last_name?: string | null };
export async function localNewsPlayers(): Promise<NewsPlayer[]> {
  const players = JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8")) as NewsPlayer[];
  return players.filter(player => /^JUG\d{4}$/.test(player.id) && player.first_name?.trim());
}
