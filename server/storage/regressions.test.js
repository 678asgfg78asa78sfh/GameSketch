import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-regressions-"));
const { createProject } = await import("./projects.js");
const { createNode, getNode, updateNode, moveNode, nodeHistory, restoreNode } = await import("./nodes.js");
const { writeCategories, readCategories } = await import("./categories.js");
const author = { name: "tester", email: "tester@local" };

test("reordering a child preserves its parent and category", async () => {
  const p = await createProject({ title: "Reorder" }, author);
  const parent = await createNode(p.slug, { pillar: "content", title: "Parent" }, author);
  const child = await createNode(p.slug, { pillar: "content", parent: parent.id }, author);
  const moved = await moveNode(p.slug, child.id, { order: 42 }, author);
  assert.equal(moved.parent, parent.id);
  assert.equal(moved.pillar, "content");
  assert.equal(moved.order, 42);
});

test("new children inherit their parent's category and append after existing siblings", async () => {
  const p = await createProject({ title: "Create children" }, author);
  const parent = await createNode(p.slug, { pillar: "scope" }, author);
  const first = await createNode(p.slug, { pillar: "scope", parent: parent.id, order: 99999 }, author);
  const second = await createNode(p.slug, { pillar: "gameloop", parent: parent.id }, author);
  assert.equal(second.pillar, "scope");
  assert.ok(second.order > first.order);
});

test("concurrent edits preserve both fields and commit each author's change", async () => {
  const p = await createProject({ title: "Concurrent edits" }, author);
  const n = await createNode(p.slug, { pillar: "content", title: "Original", body: "Original" }, author);
  const outcomes = await Promise.allSettled([
    updateNode(p.slug, n.id, { title: "New title" }, { name: "Alice", email: "alice@local" }),
    updateNode(p.slug, n.id, { body: "New body" }, { name: "Bob", email: "bob@local" }),
  ]);
  assert.deepEqual(outcomes.map((o) => o.status), ["fulfilled", "fulfilled"]);
  const saved = await getNode(p.slug, n.id);
  assert.equal(saved.title, "New title");
  assert.equal(saved.body, "New body");
  assert.deepEqual((await nodeHistory(p.slug, n.id)).slice(0, 2).map((h) => h.author), ["Bob", "Alice"]);
});

test("history restores content from before a category move without undoing the current hierarchy", async () => {
  const p = await createProject({ title: "Moved history" }, author);
  const n = await createNode(p.slug, { pillar: "content", title: "Idea", body: "First draft" }, author);
  const original = (await nodeHistory(p.slug, n.id))[0].commit;
  const target = await createNode(p.slug, { pillar: "scope", title: "Target" }, author);
  const child = await createNode(p.slug, { pillar: "content", parent: n.id }, author);
  await updateNode(p.slug, n.id, { body: "Second draft" }, author);
  await moveNode(p.slug, n.id, { parent: target.id }, author);
  assert.ok((await nodeHistory(p.slug, n.id)).some((h) => h.commit === original));
  await restoreNode(p.slug, n.id, original, { name: "Restorer", email: "restore@local" });
  const restored = await getNode(p.slug, n.id);
  assert.equal(restored.body, "First draft");
  assert.equal(restored.parent, target.id);
  assert.equal(restored.pillar, "scope");
  assert.equal(restored.updated_by, "Restorer");
  assert.equal((await getNode(p.slug, child.id)).pillar, "scope");
});

test("category removal cannot orphan a concurrently created idea", async () => {
  const p = await createProject({ title: "Concurrent categories" }, author);
  const results = await Promise.allSettled([
    createNode(p.slug, { pillar: "content", title: "Keep this idea" }, author),
    writeCategories(p.slug, [{ slug: "scope", label: "Scope", color: "#41d3ff" }], author),
  ]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[1].status, "rejected");
  assert.match(results[1].reason.message, /category not empty/);
  assert.ok(readCategories(p.slug).some((c) => c.slug === "content"));
});
