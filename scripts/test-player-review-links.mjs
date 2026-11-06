import test from "node:test";
import assert from "node:assert/strict";
import { createReviewLinkRepository, newReviewLink } from "../lib/player-review-links.mjs";

function fixture() {
  const objects = new Map();
  const store = {
    async read(key) { return objects.get(key) ?? null; },
    async create(key, value) { if (objects.has(key)) return false; objects.set(key, structuredClone(value)); return true; },
  };
  return { objects, store, repository: createReviewLinkRepository(store) };
}
test("Repeated publications preserve every existing token and URL", async () => {
  const { store, repository } = fixture();
  const first = await repository.ensure("JUG0001");
  const nextPublication = createReviewLinkRepository(store);
  const second = await nextPublication.ensure("JUG0001");
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.deepEqual(second.record, first.record);
  assert.equal((await nextPublication.ensure("JUG0002")).created, true);
});
test("Existing local links migrate without changing their URLs", async () => {
  const { repository } = fixture();
  const seed = newReviewLink("JUG0001");
  const { record } = await repository.ensure("JUG0001", seed);
  assert.deepEqual(record, seed);
  assert.equal((await repository.read("codes", seed.code)).token, seed.token);
  assert.equal((await repository.read("tokens", seed.token)).player_id, seed.player_id);
});
test("Concurrent publications converge on one link per player", async () => {
  const { repository } = fixture();
  const [a,b] = await Promise.all([repository.ensure("JUG0001"), repository.ensure("JUG0001")]);
  assert.deepEqual(a.record, b.record);
  assert.equal(Number(a.created) + Number(b.created), 1);
});
test("Interrupted index writes are repaired without changing the link", async () => {
  const { objects, repository } = fixture();
  const record = newReviewLink("JUG0001");
  objects.set("player-edit-links/players/JUG0001.json", record);
  assert.equal((await repository.ensure("JUG0001")).created, false);
  assert.deepEqual(await repository.read("codes", record.code), record);
});
test("Unknown and malformed private links do not resolve", async () => {
  const { repository } = fixture();
  assert.equal(await repository.read("codes", "../../secret"), null);
  assert.equal(await repository.read("tokens", "a".repeat(48)), null);
});
test("Storage failures never silently replace a valid link", async () => {
  const repository = createReviewLinkRepository({read: async () => {throw new Error("offline");}, create: async () => {throw new Error("must not run");}});
  await assert.rejects(repository.ensure("JUG0001"), /offline/);
});
