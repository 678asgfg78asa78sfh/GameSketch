import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-tracking-"));
const { createProject, getProject } = await import("./projects.js");
const { createNode, updateNode, updateTracking, continueNode, getNode, listNodes, nodeHistory, restoreNode, duplicateNode } = await import("./nodes.js");
const { writeCanvas, readCanvas } = await import("./canvas.js");
const { nodePath } = await import("./paths.js");
const { recordAction, undoAction } = await import("./actions.js");
const { exportBackup, importBackup } = await import("./backups.js");
const { flattenToMarkdown } = await import("./tree.js");
const author = { name: "tester", email: "tester@local" };
const task = (id, kind = "task") => ({ id, title: `Step ${id}`, kind });

async function setup(title) {
  const project = await createProject({ title }, author);
  const node = await createNode(project.slug, { title: "Idea", pillar: "gameloop", body: "Original design" }, author);
  const change = (op) => updateTracking(project.slug, node.id, op, author);
  await change({ operation: "enable" });
  return { slug: project.slug, node, change };
}

test("concurrent task operations merge by ID, retries are idempotent, closing retains unfinished tasks", async () => {
  const { slug, node, change } = await setup("Concurrent tracker");
  await Promise.all([change({ operation: "add", task: task("a") }), change({ operation: "add", task: task("b", "milestone") })]);
  await change({ operation: "add", task: task("a") });
  assert.equal((await getNode(slug, node.id)).tracking.tasks.length, 2);
  await change({ operation: "edit", taskId: "a", patch: { done: true } });
  let n = await change({ operation: "complete" });
  assert.equal(n.progress, "complete"); assert.equal(n.tracking.tasks[1].done, false);
  await assert.rejects(change({ operation: "edit", taskId: "b", patch: { done: true } }), { code: "TRACKING_CLOSED" });
  n = await change({ operation: "reopen" });
  assert.equal(n.progress, "needs_work");
  await Promise.all([change({ operation: "edit", taskId: "a", patch: { title: "Updated step" } }), change({ operation: "edit", taskId: "b", patch: { done: true } })]);
  n = await getNode(slug, node.id);
  assert.equal(n.progress, "complete"); assert.equal(n.tracking.tasks[0].title, "Updated step");
  await change({ operation: "disable" });
  n = await change({ operation: "enable" });
  assert.equal(n.tracking.tasks.length, 2); assert.equal(n.tracking.tasks.every((t) => t.done), true);
});

test("invalid task updates never change files or move the node", async () => {
  const { slug, node, change } = await setup("Validation tracker");
  await change({ operation: "add", task: task("a") });
  const path = nodePath(slug, node.pillar, node.id), before = readFileSync(path, "utf8");
  for (const patch of [{ done: "yes" }, { title: " " }, { title: "x".repeat(501) }, { kind: "invalid" }, { id: "changed" }]) {
    await assert.rejects(change({ operation: "edit", taskId: "a", patch }), { code: "INVALID_TRACKING" });
    assert.equal(readFileSync(path, "utf8"), before);
  }
  await assert.rejects(updateNode(slug, node.id, { pillar: "scope", tracking: { tasks: "invalid" } }, author), { code: "INVALID_TRACKING" });
  assert.equal((await getNode(slug, node.id)).pillar, "gameloop");
  await assert.rejects(change({ operation: "edit", taskId: "missing", patch: { done: true } }), { code: "TASK_NOT_FOUND" });
  await assert.rejects(change({ operation: "add", task: { ...task("a"), title: 42 } }), { code: "INVALID_TRACKING" });
  await assert.rejects(change({ operation: "unknown" }), { code: "INVALID_TRACKING" });
});

test("continue preserves the original, clones canvas independently, resets tasks and can be undone", async () => {
  const { slug, node, change } = await setup("Version tracker");
  await assert.rejects(continueNode(slug, node.id, {}, author), { code: "VERSION_NOT_COMPLETE" });
  await change({ operation: "add", task: task("a", "milestone") });
  await change({ operation: "complete" });
  await updateNode(slug, node.id, { canvas: `canvases/${node.id}.excalidraw` }, author);
  const drawing = { elements: [{ id: "drawing" }], appState: { theme: "light" } };
  await writeCanvas(slug, node.id, drawing, author);
  const original = readFileSync(nodePath(slug, node.pillar, node.id), "utf8");
  const child = await createNode(slug, { parent: node.id, title: "Other subidea" }, author);
  const result = await recordAction(slug, "continue", author, () => continueNode(slug, node.id, { carryTasks: true }, author));
  const next = result.result;
  assert.equal(next.parent, node.id); assert.equal(next.continued_from, node.id); assert.equal(next.version, 2);
  assert.equal(next.body, node.body); assert.equal(next.title, "Idea · v2"); assert.equal(next.progress, "new");
  assert.equal(next.tracking.completed, false); assert.equal(next.tracking.tasks[0].done, false);
  assert.notEqual(next.tracking.tasks[0].id, "a");
  assert.deepEqual(await readCanvas(slug, next.id), drawing);
  assert.equal(readFileSync(nodePath(slug, node.pillar, node.id), "utf8"), original);
  assert.equal((await listNodes(slug)).length, 3);
  assert.equal((await continueNode(slug, node.id, {}, author)).id, next.id);
  await undoAction(slug, result.action.id, author);
  assert.equal(await getNode(slug, next.id), null); assert.ok(await getNode(slug, child.id));
  const fresh = await continueNode(slug, node.id, {}, author);
  assert.equal(fresh.tracking.tasks.length, 0);
  await writeCanvas(slug, fresh.id, { elements: [] }, author);
  assert.deepEqual(await readCanvas(slug, node.id), drawing);
  await updateTracking(slug, fresh.id, { operation: "complete" }, author);
  const v3 = await continueNode(slug, fresh.id, {}, author);
  assert.equal(v3.version, 3); assert.equal(v3.title, "Idea · v3"); assert.equal(v3.parent, fresh.id);
});

test("history, backups, duplicates and Markdown preserve tracker content and version links", async () => {
  const { slug, node, change } = await setup("Tracker roundtrip");
  await change({ operation: "add", task: task("a", "milestone") });
  const history = await nodeHistory(slug, node.id);
  await change({ operation: "edit", taskId: "a", patch: { done: true } });
  await restoreNode(slug, node.id, history[0].commit, author);
  assert.equal((await getNode(slug, node.id)).tracking.tasks[0].done, false);
  await change({ operation: "complete" });
  const next = await continueNode(slug, node.id, {}, author);
  const copied = await duplicateNode(slug, node.id, "Copy", author);
  const all = await listNodes(slug), copiedNext = all.find((n) => n.parent === copied.id);
  assert.equal(copiedNext.continued_from, copied.id);
  const project = await getProject(slug), md = flattenToMarkdown(project, project.nodes);
  assert.match(md, /Progress: 100% \(manually completed\)/); assert.match(md, /- \[ \] ◆ Milestone: Step a/);
  const imported = await importBackup(await exportBackup(slug), author);
  assert.deepEqual((await getNode(imported.slug, node.id)).tracking, (await getNode(slug, node.id)).tracking);
  assert.equal((await getNode(imported.slug, next.id)).continued_from, node.id);
});
