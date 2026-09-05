import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-workspace-"));
const { createProject, getProject, updateProject } = await import("./projects.js");
const { createNode, getNode, updateNode, moveNode, deleteNode, listTrash, restoreTrash, duplicateNode, nodeHistory } = await import("./nodes.js");
const { recordAction, undoAction, listActions } = await import("./actions.js");
const { exportBackup, importBackup } = await import("./backups.js");
const { saveAsset } = await import("./assets.js");
const { writeCanvas, readCanvas } = await import("./canvas.js");
const author = { name: "tester", email: "tester@local" };

test("trash restores a whole subtree with its attachments and sketch", async () => {
  const p = await createProject({ title: "Trash" }, author);
  const root = await createNode(p.slug, { pillar: "gameloop", title: "Root" }, author);
  const asset = await saveAsset(p.slug, root.id, { filename: "ref.txt", buffer: Buffer.from("reference") }, author);
  const child = await createNode(p.slug, { pillar: "gameloop", parent: root.id, attachments: [asset] }, author);
  await writeCanvas(p.slug, child.id, { elements: [{ id: "shape" }], files: {} }, author);
  const entry = await deleteNode(p.slug, root.id, author);
  assert.equal((await getProject(p.slug)).nodes.length, 0);
  assert.equal((await listTrash(p.slug))[0].count, 2);
  await restoreTrash(p.slug, entry.id, author);
  assert.equal((await getNode(p.slug, child.id)).parent, root.id);
  assert.deepEqual((await getNode(p.slug, child.id)).attachments, [asset]);
  assert.equal((await readCanvas(p.slug, child.id)).elements[0].id, "shape");
  assert.equal((await listTrash(p.slug)).length, 0);
});

test("undo never orphans a child created after the action", async () => {
  const p = await createProject({ title: "New child after action" }, author);
  const first = await recordAction(p.slug, "create", author, () => createNode(p.slug, { pillar: "gameloop" }, author));
  const child = await createNode(p.slug, { parent: first.result.id }, author);
  await assert.rejects(() => undoAction(p.slug, first.action.id, author), { code: "CHANGED_SINCE_ACTION" });
  assert.equal((await getNode(p.slug, child.id)).parent, first.result.id);
  assert.ok(await getNode(p.slug, first.result.id));
});

test("restoring a deleted child follows a parent moved to another category", async () => {
  const p = await createProject({ title: "Moved parent" }, author);
  const root = await createNode(p.slug, { pillar: "gameloop" }, author);
  const child = await createNode(p.slug, { parent: root.id }, author);
  const nested = await createNode(p.slug, { parent: child.id }, author);
  const entry = await deleteNode(p.slug, child.id, author);
  await moveNode(p.slug, root.id, { pillar: "content" }, author);
  await restoreTrash(p.slug, entry.id, author);
  assert.equal((await getNode(p.slug, child.id)).pillar, "content");
  assert.equal((await getNode(p.slug, nested.id)).pillar, "content");
});

test("undoing duplication cannot hide newer edits to a copied drawing", async () => {
  const p = await createProject({ title: "Protect drawing" }, author);
  const n = await createNode(p.slug, { pillar: "gameloop" }, author);
  await writeCanvas(p.slug, n.id, { elements: [{ id: "before" }] }, author);
  await updateNode(p.slug, n.id, { canvas: `canvases/${n.id}.excalidraw` }, author);
  const copy = await recordAction(p.slug, "duplicate", author, () => duplicateNode(p.slug, n.id, "Copy", author));
  await writeCanvas(p.slug, copy.result.id, { elements: [{ id: "newer drawing" }] }, author);
  await assert.rejects(() => undoAction(p.slug, copy.action.id, author), { code: "CHANGED_SINCE_ACTION" });
  assert.ok(await getNode(p.slug, copy.result.id));
});

test("one undo restores a multi-node move; conflicts preserve newer edits", async () => {
  const p = await createProject({ title: "Undo" }, author);
  const root = await createNode(p.slug, { pillar: "gameloop", title: "Root" }, author);
  const child = await createNode(p.slug, { pillar: "gameloop", parent: root.id }, author);
  const { action } = await recordAction(p.slug, "move", author, () => moveNode(p.slug, root.id, { pillar: "scope" }, author));
  assert.equal(action.changes.length, 2);
  await undoAction(p.slug, action.id, author);
  assert.equal((await getNode(p.slug, child.id)).pillar, "gameloop");
  assert.equal((await listActions(p.slug))[0].undone, true);
  const deletion = await recordAction(p.slug, "trash", author, () => deleteNode(p.slug, root.id, author));
  await undoAction(p.slug, deletion.action.id, author);
  const edit = await recordAction(p.slug, "edit", author, () => updateNode(p.slug, root.id, { body: "First" }, author));
  await updateNode(p.slug, root.id, { body: "Keep my newer draft" }, author);
  await assert.rejects(() => undoAction(p.slug, edit.action.id, author), { code: "CHANGED_SINCE_ACTION" });
  assert.equal((await getNode(p.slug, root.id)).body, "Keep my newer draft");
});

test("backup roundtrip includes Git history, trash and canvas, with a new project slug", async () => {
  const p = await createProject({ title: "Backup" }, author);
  const root = await createNode(p.slug, { pillar: "content", body: "First" }, author);
  await updateNode(p.slug, root.id, { body: "Second" }, author);
  await writeCanvas(p.slug, root.id, { elements: [{ id: "drawing" }], files: { ref: { dataURL: "data:image/png;base64,AAAA" } } }, author);
  const deleted = await createNode(p.slug, { pillar: "scope", title: "In trash" }, author);
  await deleteNode(p.slug, deleted.id, author);
  const history = await nodeHistory(p.slug, root.id);
  const backup = await exportBackup(p.slug);
  const restored = await importBackup(backup, author);
  assert.notEqual(restored.slug, p.slug);
  assert.equal((await getNode(restored.slug, root.id)).body, "Second");
  assert.equal((await readCanvas(restored.slug, root.id)).elements[0].id, "drawing");
  assert.equal((await listTrash(restored.slug))[0].title, "In trash");
  assert.ok((await nodeHistory(restored.slug, root.id)).some((h) => h.commit === history.at(-1).commit));
  assert.equal((await getProject(p.slug)).title, "Backup");
  await assert.rejects(() => importBackup(Buffer.from("Not a backup"), author), { code: "INVALID_BACKUP" });
});

test("duplicating a subtree gives new ids, remaps links, and keeps independent drawings", async () => {
  const p = await createProject({ title: "Duplicate" }, author);
  const root = await createNode(p.slug, { pillar: "content", title: "Root" }, author);
  const child = await createNode(p.slug, { pillar: "content", parent: root.id }, author);
  await updateNode(p.slug, root.id, { body: `See [[${child.id}]]`, canvas: `canvases/${root.id}.excalidraw` }, author);
  await writeCanvas(p.slug, root.id, { elements: [{ id: "shape" }] }, author);
  const copy = await duplicateNode(p.slug, root.id, "Copy", author);
  const copiedChild = (await getProject(p.slug)).nodes.find((n) => n.parent === copy.id);
  assert.notEqual(copy.id, root.id);
  assert.equal(copy.body, `See [[${copiedChild.id}]]`);
  assert.deepEqual(await readCanvas(p.slug, copy.id), await readCanvas(p.slug, root.id));
  await updateProject(p.slug, { title: "Renamed", archived: true }, author);
  const renamed = await getProject(p.slug);
  assert.equal(renamed.slug, p.slug);
  assert.equal(renamed.title, "Renamed");
  assert.equal(renamed.archived, true);
});

test("a backup containing an empty attachment can be imported", async () => {
  const p = await createProject({ title: "Empty attachment" }, author);
  const node = await createNode(p.slug, { pillar: "gameloop", title: "Placeholder file" }, author);
  const path = await saveAsset(p.slug, node.id, { filename: "empty.txt", buffer: Buffer.alloc(0) }, author);
  await updateNode(p.slug, node.id, { attachments: [path] }, author);
  const restored = await importBackup(await exportBackup(p.slug), author);
  assert.deepEqual((await getNode(restored.slug, node.id)).attachments, [path]);
});
