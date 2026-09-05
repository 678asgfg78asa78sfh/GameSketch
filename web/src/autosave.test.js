import { test } from "node:test";
import assert from "node:assert/strict";
import { createAutosave } from "./autosave.js";

test("autosave merges title and body within one debounce window", async () => {
  const writes = [];
  const saver = createAutosave(async (patch) => { writes.push(patch); });
  saver.queue({ title: "New title" });
  saver.queue({ body: "New body" });
  await saver.flush();
  assert.deepEqual(writes, [{ title: "New title", body: "New body" }]);
  assert.equal(saver.isPending(), false);
});

test("autosave waits for an in-flight request before saving newer edits", async () => {
  const writes = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const states = [];
  const saver = createAutosave(async (patch) => {
    writes.push(patch);
    if (writes.length === 1) await gate;
  }, { onState: (s) => states.push(s) });
  saver.queue({ body: "First" });
  const done = saver.flush();
  await Promise.resolve();
  saver.queue({ body: "Second" });
  assert.equal(saver.flush(), done);
  assert.deepEqual(writes, [{ body: "First" }]);
  assert.equal(states.at(-1).saved, false);
  release();
  await done;
  assert.deepEqual(writes, [{ body: "First" }, { body: "Second" }]);
  assert.equal(states.at(-1).saved, true);
});

test("retry preserves a failed field and newer edits", async () => {
  let fail = true;
  const writes = [];
  const saver = createAutosave(async (patch) => {
    if (fail) throw new Error("Offline");
    writes.push(patch);
  });
  saver.queue({ title: "Title", body: "Old body" });
  await assert.rejects(saver.flush(), /Offline/);
  assert.equal(saver.isPending(), true);
  saver.queue({ body: "New body" });
  fail = false;
  await saver.flush();
  assert.deepEqual(writes, [{ title: "Title", body: "New body" }]);
});
