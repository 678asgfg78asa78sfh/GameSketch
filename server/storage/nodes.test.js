import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-nodes-"));
const { createProject } = await import("./projects.js");
const { createNode, listNodes, getNode, updateNode, moveNode, deleteNode, nodeHistory, restoreNode } = await import("./nodes.js");

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
