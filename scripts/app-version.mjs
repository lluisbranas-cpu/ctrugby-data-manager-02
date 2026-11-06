import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// Calculated from saved files, never from the time a visitor opens the page.
export async function appVersion() {
  const root = process.cwd();
  const files = [];
  async function walk(relative) {
    let entries;
    try { entries = await readdir(path.join(root, relative), { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || /\.(?:bak|backup|tmp)|\.before-/i.test(entry.name)) continue;
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await walk(name);
      else files.push(name);
    }
  }
  for (const dir of ["app", "lib", "scripts", "public", "data/staging"]) await walk(dir);
  for (const file of ["next.config.ts", "proxy.ts", "package.json", "package-lock.json", "tsconfig.json"]) {
    try { await stat(path.join(root, file)); files.push(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const hash = createHash("sha256");
  let latest = 0;
  for (const file of files.sort()) {
    const info = await stat(path.join(root, file));
    latest = Math.max(latest, info.mtimeMs);
    hash.update(file.replaceAll("\\", "/") + ":" + info.size + ":" + info.mtimeMs + "\n");
  }
  const date = new Date(latest || Date.now());
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = type => parts.find(item => item.type === type).value;
  return {
    version: "v" + part("year") + "." + part("month") + "." + part("day") + "." + hash.digest("hex").slice(0, 8),
    updated: part("day") + "/" + part("month") + "/" + part("year") + " · " + new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit" }).format(date),
  };
}
