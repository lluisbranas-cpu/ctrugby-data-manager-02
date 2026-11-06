import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { readSeasonCategories, saveSeasonCategories } from "../lib/player-season-categories.ts";
const previous = process.cwd();
const directory = await mkdtemp(path.join(os.tmpdir(), "ctrugby-category-test-"));
process.chdir(directory);
try {
  assert.deepEqual(await readSeasonCategories("JUG9999"), {});
  await saveSeasonCategories("JUG9999", [{ season_year: 2027, playing_category: "S16" }, { season_year: 2026, playing_category: "S14" }]);
  assert.deepEqual(await readSeasonCategories("JUG9999"), { 2027: "S16", 2026: "S14" });
  await saveSeasonCategories("JUG9999", [{ season_year: 2027 }]);
  assert.deepEqual(await readSeasonCategories("JUG9999"), { 2027: "S16" });
  await saveSeasonCategories("JUG9999", [{ season_year: 2027, playing_category: null }]);
  assert.deepEqual(await readSeasonCategories("JUG9999"), {});
  console.log("OK: category persistence, preservation, deleted seasons and clearing.");
} finally {
  process.chdir(previous);
  if (directory.startsWith(path.join(os.tmpdir(), "ctrugby-category-test-"))) await rm(directory, { recursive: true });
}
