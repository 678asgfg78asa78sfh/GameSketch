import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-nodes-"));
const { createProject } = await import("./projects.js");
const { createNode, listNodes, getNode, updateNode, moveNode, deleteNode, nodeHistory, restoreNode } = await import("./nodes.js");
const { nodePath } = await import("./paths.js");

const author = { name: "ms", email: "ms@local" };

test("create/list/get node", async () => {
  const p = await createProject({ title: "T" }, author);
  const n = await createNode(p.slug, { pillar: "gameloop", title: "Loop", body: "v1" }, author);
  assert.equal(n.title, "Loop");
  assert.equal(n.status, "core");
  assert.equal(n.kind, "idea");
  const all = await listNodes(p.slug);
  assert.equal(all.length, 1);
  assert.equal((await getNode(p.slug, n.id)).body, "v1");
});

test("update bumps history; restore brings old body back", async () => {
  const p = await createProject({ title: "T2" }, author);
  const n = await createNode(p.slug, { pillar: "content", title: "X", body: "first" }, author);
  await updateNode(p.slug, n.id, { body: "second" }, author);
  const hist = await nodeHistory(p.slug, n.id);
  assert.ok(hist.length >= 2);
  await restoreNode(p.slug, n.id, hist[hist.length - 1].commit, author);
  assert.equal((await getNode(p.slug, n.id)).body, "first");
});

test("move changes parent/order; delete removes file", async () => {
  const p = await createProject({ title: "T3" }, author);
  const a = await createNode(p.slug, { pillar: "threads", title: "A" }, author);
  const b = await createNode(p.slug, { pillar: "threads", title: "B" }, author);
  await moveNode(p.slug, b.id, { parent: a.id, order: 0 }, author);
  assert.equal((await getNode(p.slug, b.id)).parent, a.id);
  await deleteNode(p.slug, b.id, author);
  assert.equal(await getNode(p.slug, b.id), null);
});

test("move across pillars adopts target pillar and cascades to descendants", async () => {
  const p = await createProject({ title: "T4" }, author);
  const target = await createNode(p.slug, { pillar: "scope", title: "Target" }, author);
  const parent = await createNode(p.slug, { pillar: "gameloop", title: "Parent" }, author);
  const child = await createNode(p.slug, { pillar: "gameloop", parent: parent.id, title: "Child" }, author);

  await moveNode(p.slug, parent.id, { parent: target.id }, author);

  assert.equal((await getNode(p.slug, parent.id)).parent, target.id);
  assert.equal((await getNode(p.slug, parent.id)).pillar, "scope"); // adopts target pillar
  assert.equal((await getNode(p.slug, child.id)).pillar, "scope");  // subtree cascades
  // old file under gameloop is gone (listNodes wouldn't double-count, but verify by pillar)
  const all = await listNodes(p.slug);
  assert.equal(all.filter((n) => n.id === parent.id).length, 1);
});

test("un-nest: move a child to root of another category sets parent=null and the new pillar", async () => {
  const p = await createProject({ title: "U" }, author);
  const parent = await createNode(p.slug, { pillar: "gameloop", title: "P" }, author);
  const child = await createNode(p.slug, { pillar: "gameloop", parent: parent.id, title: "C" }, author);
  await moveNode(p.slug, child.id, { parent: null, pillar: "scope", order: 0 }, author);
  const c = await getNode(p.slug, child.id);
  assert.equal(c.parent, null);
  assert.equal(c.pillar, "scope");
});

test("move into own descendant is rejected (no cycle, node stays)", async () => {
  const p = await createProject({ title: "T5" }, author);
  const a = await createNode(p.slug, { pillar: "content", title: "A" }, author);
  const b = await createNode(p.slug, { pillar: "content", parent: a.id, title: "B" }, author);
  await assert.rejects(() => moveNode(p.slug, a.id, { parent: b.id }, author), /descendant/);
  // a is untouched and still reachable
  assert.equal((await getNode(p.slug, a.id)).parent, null);
});

test("progress: defaults to 'new' on create and can be cycled", async () => {
  const p = await createProject({ title: "Prog" }, author);
  const n = await createNode(p.slug, { pillar: "gameloop", title: "N" }, author);
  assert.equal(n.progress, "new");
  await updateNode(p.slug, n.id, { progress: "complete" }, author);
  assert.equal((await getNode(p.slug, n.id)).progress, "complete");
});

test("migration: a pre-existing node file without `progress` reads as 'new'", async () => {
  const p = await createProject({ title: "Mig" }, author);
  // Simulate a node saved before the `progress` field existed (no `progress` in frontmatter).
  const raw = "---\nid: OLDNODE1\ntitle: Old\npillar: gameloop\nstatus: core\nkind: idea\nparent: null\n---\n\nold body\n";
  writeFileSync(nodePath(p.slug, "gameloop", "OLDNODE1"), raw);
  assert.equal((await getNode(p.slug, "OLDNODE1")).progress, "new"); // defaulted on read
  // and once the node is saved again, the field is persisted (still 'new')
  await updateNode(p.slug, "OLDNODE1", { title: "Old edited" }, author);
  assert.equal((await getNode(p.slug, "OLDNODE1")).progress, "new");
});
