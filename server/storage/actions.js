import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { projectDir } from "./paths.js";
import { projectWrite } from "./lock.js";
import { snapshot, projectFile, writeSnapshotFile, problem } from "./files.js";
import { commitAll } from "./git.js";
import { ulid } from "../util/ids.js";
import { createHash } from "node:crypto";
import { listNodes } from "./nodes.js";
import { readCategories, categoriesFromMeta } from "./categories.js";

function delta(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((path) => before[path] !== after[path])
    .map((path) => ({ path, before: before[path] ?? null, after: after[path] ?? null }));
}

function nodeFrom(value) {
  if (value == null) return null;
  const { data, content } = matter(Buffer.from(value, "base64").toString("utf8"));
  return { ...data, body: content.trim() };
}

function canvasHash(slug, id) {
  const path = projectFile(slug, `canvases/${id}.excalidraw`);
  return existsSync(path) ? createHash("sha256").update(readFileSync(path)).digest("hex") : null;
}

export function describeChanges(files) {
  const byId = new Map();
  for (const file of files.filter((f) => f.path.startsWith("nodes/"))) {
    const before = nodeFrom(file.before), after = nodeFrom(file.after);
    const id = (after || before).id;
    const entry = byId.get(id) || { id, before: null, after: null };
    if (before) entry.before = before;
    if (after) entry.after = after;
    byId.set(id, entry);
  }
  const fields = ["title", "body", "pillar", "parent", "order", "status", "kind", "progress", "attachments", "canvas", "tracking", "continued_from", "version"];
  return [...byId.values()].map(({ id, before, after }) => ({
    id, title: (after || before).title, type: !before ? "create" : !after ? "delete" : "update",
    fields: fields.filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
      .map((key) => ({ key, before: before?.[key] ?? null, after: after?.[key] ?? null })),
  }));
}

export const recordAction = projectWrite(async (slug, kind, author, change, actionId = ulid()) => {
  const existing = projectFile(slug, `actions/${actionId}.json`);
  if (existsSync(existing)) {
    const { files, result, ...action } = JSON.parse(readFileSync(existing, "utf8"));
    return { result, action: { ...action, changes: describeChanges(files) }, alreadyApplied: true };
  }
  const before = snapshot(slug);
  let result;
  try { result = await change(); }
  catch (error) {
    const failed = delta(before, snapshot(slug));
    for (const file of failed) writeSnapshotFile(slug, file.path, file.before);
    if (failed.length) await commitAll(projectDir(slug), { ...author, message: `rollback: ${kind}` });
    throw error;
  }
  const files = delta(before, snapshot(slug));
  if (!files.length) return { result, action: null };
  const canvasHashes = Object.fromEntries(describeChanges(files).filter((c) => c.type === "create").map((c) => [c.id, canvasHash(slug, c.id)]));
  const action = { id: actionId, kind, author: author.name, date: new Date().toISOString(), files, result, canvasHashes, undone: false };
  mkdirSync(join(projectDir(slug), "actions"), { recursive: true });
  writeFileSync(projectFile(slug, `actions/${action.id}.json`), JSON.stringify(action));
  await commitAll(projectDir(slug), { ...author, message: `action: ${kind}` });
  return { result, action: { ...action, files: undefined, result: undefined, changes: describeChanges(files) } };
});

export const listActions = projectWrite(async (slug) => {
  const dir = join(projectDir(slug), "actions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 50).map((f) => {
    const { files, result, ...action } = JSON.parse(readFileSync(projectFile(slug, `actions/${f}`), "utf8"));
    return { ...action, changes: describeChanges(files) };
  });
});

export const undoAction = projectWrite(async (slug, id, author) => {
  const path = projectFile(slug, `actions/${id}.json`);
  if (!existsSync(path)) throw problem("ACTION_NOT_FOUND", 404);
  const action = JSON.parse(readFileSync(path, "utf8"));
  if (action.undone) throw problem("ALREADY_UNDONE", 409);
  for (const [id, hash] of Object.entries(action.canvasHashes || {})) if (canvasHash(slug, id) !== hash) throw problem("CHANGED_SINCE_ACTION", 409);
  for (const file of action.files) {
    const currentPath = projectFile(slug, file.path);
    const value = existsSync(currentPath) ? readFileSync(currentPath).toString("base64") : null;
    if (value !== file.after) throw problem("CHANGED_SINCE_ACTION", 409);
  }
  // A later child/category dependency may not have touched the recorded files.
  // Validate the resulting hierarchy before writing any undo changes.
  const candidates = new Map((await listNodes(slug)).map((n) => [n.id, n]));
  for (const file of action.files.filter((f) => f.path.startsWith("nodes/"))) {
    const after = nodeFrom(file.after); if (after) candidates.delete(after.id);
  }
  for (const file of action.files.filter((f) => f.path.startsWith("nodes/"))) {
    const before = nodeFrom(file.before); if (before) candidates.set(before.id, before);
  }
  const meta = action.files.find((f) => f.path === "project.md");
  const categories = meta?.before ? categoriesFromMeta(matter(Buffer.from(meta.before, "base64").toString("utf8")).data) : readCategories(slug);
  for (const node of candidates.values()) {
    const parent = node.parent ? candidates.get(node.parent) : null;
    if (!categories.some((c) => c.slug === node.pillar) || (node.parent && (!parent || parent.pillar !== node.pillar))) throw problem("CHANGED_SINCE_ACTION", 409);
    const seen = new Set([node.id]); let ancestor = parent;
    while (ancestor) { if (seen.has(ancestor.id)) throw problem("CHANGED_SINCE_ACTION", 409); seen.add(ancestor.id); ancestor = candidates.get(ancestor.parent); }
  }
  for (const file of action.files) writeSnapshotFile(slug, file.path, file.before);
  action.undone = true;
  action.undoneAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(action));
  await commitAll(projectDir(slug), { ...author, message: `undo: ${action.kind}` });
  return { ok: true };
});
