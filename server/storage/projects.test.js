import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-proj-"));
const { createProject, listProjects, getProject } = await import("./projects.js");

test("create -> unique slug, git repo, listable, getable", async () => {
  const author = { name: "ms", email: "ms@local" };
  const a = await createProject({ title: "My Game" }, author);
  const b = await createProject({ title: "My Game" }, author); // dup title
  assert.equal(a.slug, "my-game");
  assert.notEqual(a.slug, b.slug);
  const list = await listProjects();
  assert.equal(list.length, 2);
  const got = await getProject(a.slug);
  assert.equal(got.title, "My Game");
  assert.deepEqual(got.nodes, []);
});
