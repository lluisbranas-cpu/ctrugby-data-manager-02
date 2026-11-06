import { readFile as readNodeFile } from "node:fs/promises";

// Vercel shares its file descriptor limit across concurrent requests. Reserve
// slots here rather than opening every news/season file with Promise.all.
const maximumReads = 32;
let activeReads = 0;
const waiting: Array<() => void> = [];

export function readFile(filename: string, encoding: "utf8"): Promise<string>;
export function readFile(filename: string): Promise<Buffer>;
export async function readFile(filename: string, encoding?: "utf8"): Promise<string | Buffer> {
  if (activeReads >= maximumReads) await new Promise<void>((resolve) => waiting.push(resolve));
  else activeReads++;
  try {
    return encoding ? await readNodeFile(filename, encoding) : await readNodeFile(filename);
  } finally {
    const next = waiting.shift();
    if (next) next();
    else activeReads--;
  }
}
