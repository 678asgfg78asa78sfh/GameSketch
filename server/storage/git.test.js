import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureRepo, commitAll, fileHistory, fileAtCommit } from "./git.js";

test("ensureRepo + commitAll + history + show round-trips", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-git-"));
  await ensureRepo(dir);
  writeFileSync(join(dir, "a.md"), "v1");
  await commitAll(dir, { name: "ms", email: "ms@local", message: "add a" });
  writeFileSync(join(dir, "a.md"), "v2");
  await commitAll(dir, { name: "ms", email: "ms@local", message: "edit a" });

  const hist = await fileHistory(dir, "a.md");
  assert.equal(hist.length, 2);
  assert.equal(hist[0].author, "ms");           // newest first
  const old = await fileAtCommit(dir, hist[1].commit, "a.md");
  assert.equal(old, "v1");
});

test("commitAll skips when nothing changed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-git2-"));
  await ensureRepo(dir);
  writeFileSync(join(dir, "a.md"), "x");
  await commitAll(dir, { name: "ms", email: "ms@local", message: "one" });
  const second = await commitAll(dir, { name: "ms", email: "ms@local", message: "noop" });
  assert.equal(second, null);
});
