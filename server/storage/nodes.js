import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "../util/ids.js";
import { nodesDir, nodePath, projectDir, projectMeta } from "./paths.js";
import { commitAll, fileHistory, findFileAtCommit } from "./git.js";
import { isCategorySlug, readCategories } from "./categories.js";
import { projectWrite } from "./lock.js";
import { projectFile, problem } from "./files.js";
import { readCanvas, writeCanvas } from "./canvas.js";
import { validateTracking, changeTracking } from "./tracking.js";
import { trackingProgress } from "../../shared/tracking.js";

function nowIso() { return new Date().toISOString(); }

function fileToNode(raw) {
  const { data, content } = matter(raw);
  // `progress` (work status) was added later; default it here so pre-existing nodes migrate
  // on read (and get persisted the next time the node is saved) — no bulk file rewrite needed.
  return { progress: "new", ...data, body: content.replace(/^\n/, "").replace(/\n$/, "") };
}

function nodeToFile(n) {
  const { body, ...fm } = n;
  return matter.stringify(body ? `\n${body}\n` : "\n", fm);
}

function requireCategory(slug, pillar) {
  if (!isCategorySlug(pillar) || !readCategories(slug).some((c) => c.slug === pillar))
    throw new Error(`bad category: ${pillar}`);
}

export async function listNodes(slug) {
  const base = nodesDir(slug);
  if (!existsSync(base)) return [];
  const out = [];
  // Iterate every category folder that exists — categories are per-project, not a fixed list.
  for (const pillar of readdirSync(base)) {
    const dir = join(base, pillar);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      out.push(fileToNode(readFileSync(join(dir, f), "utf8")));
    }
  }
  return out;
}

export async function getNode(slug, id) {
  return (await listNodes(slug)).find((n) => n.id === id) || null;
}

export const createNode = projectWrite(async (slug, input, author) => {
  const tracking = input.tracking === undefined ? null : validateTracking(input.tracking);
  if (!existsSync(projectMeta(slug))) throw problem("PROJECT_NOT_FOUND", 404);
  const all = await listNodes(slug);
  const parent = input.parent ? all.find((n) => n.id === input.parent) : null;
  if (input.parent && !parent) throw new Error("parent not found");
  const pillar = parent ? parent.pillar : input.pillar;
  requireCategory(slug, pillar);
  const siblings = all.filter((n) => n.pillar === pillar && (n.parent ?? null) === (input.parent ?? null));
  const id = ulid();
  const ts = nowIso();
  const n = {
    id, title: input.title || "Neue Idee",
    pillar, status: input.status || "core",
    kind: input.kind || "idea", progress: input.progress || "new", parent: input.parent ?? null,
    order: input.order ?? siblings.reduce((max, n) => Math.max(max, n.order ?? 0), -1) + 1,
    alternatives_to: input.alternatives_to ?? null,
    attachments: input.attachments || [], canvas: input.canvas ?? null,
    created_by: author.name, created_at: ts, updated_by: author.name, updated_at: ts,
    body: input.body || "", tracking,
  };
  if (tracking?.enabled) n.progress = trackingProgress(n).status;
  mkdirSync(nodesDir(slug, n.pillar), { recursive: true });
  writeFileSync(nodePath(slug, n.pillar, id), nodeToFile(n));
  await commitAll(projectDir(slug), { ...author, message: `node: create "${n.title}"` });
  return n;
});

export const updateNode = projectWrite(async (slug, id, patch, author) => {
  let n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const { parent, order, pillar, id: _id, created_by: _createdBy, created_at: _createdAt,
    continued_from: _continuedFrom, version: _version, ...fields } = patch;
  if (fields.tracking !== undefined) fields.tracking = validateTracking(fields.tracking);
  // Preserve compatibility with clients that still write the three-state work status.
  if (fields.progress !== undefined && fields.tracking === undefined && n.tracking?.enabled) {
    if (!["new", "needs_work", "complete"].includes(fields.progress)) throw problem("INVALID_TRACKING");
    fields.tracking = { ...n.tracking, completed: fields.progress === "complete" };
  }
  if (parent !== undefined || order !== undefined || pillar !== undefined)
    n = await moveNode(slug, id, { parent, order, pillar }, author);
  if (!Object.keys(fields).length) return n;
  const next = { ...n, ...fields, id: n.id,
    updated_by: author.name, updated_at: nowIso() };
  if (next.tracking?.enabled) next.progress = trackingProgress(next).status;
  mkdirSync(nodesDir(slug, next.pillar), { recursive: true });
  writeFileSync(nodePath(slug, next.pillar, id), nodeToFile(next));
  await commitAll(projectDir(slug), { ...author, message: `node: edit "${next.title}"` });
  return next;
});

export const updateTracking = projectWrite(async (slug, id, input, author) => {
  const node = await getNode(slug, id);
  if (!node) throw problem("NODE_NOT_FOUND", 404);
  return updateNode(slug, id, { tracking: changeTracking(node, input) }, author);
});

export const continueNode = projectWrite(async (slug, id, input, author) => {
  const all = await listNodes(slug);
  const source = all.find((n) => n.id === id);
  if (!source) throw problem("NODE_NOT_FOUND", 404);
  // Retrying a request must not create a second, indistinguishable next version.
  const existing = all.find((n) => n.continued_from === id);
  if (existing) return existing;
  if (!trackingProgress(source).complete) throw problem("VERSION_NOT_COMPLETE", 409);
  if (input?.title !== undefined && (typeof input.title !== "string" || !input.title.trim() || input.title.length > 500)) throw problem("INVALID_VERSION");
  if (input?.carryTasks !== undefined && typeof input.carryTasks !== "boolean") throw problem("INVALID_VERSION");
  const nextId = ulid(), ts = nowIso(), version = (source.version || 1) + 1;
  const baseTitle = source.version ? source.title.replace(/ · v\d+$/, "") : source.title;
  const copy = { ...source, id: nextId, parent: source.id, continued_from: source.id, version,
    title: input?.title?.trim() || `${baseTitle} · v${version}`,
    order: all.filter((n) => n.parent === source.id).reduce((max, n) => Math.max(max, n.order || 0), -1) + 1,
    progress: "new", tracking: { enabled: true, completed: false,
      tasks: input?.carryTasks ? (source.tracking?.tasks || []).map((task) => ({ ...task, id: ulid(), done: false })) : [] },
    canvas: source.canvas ? `canvases/${nextId}.excalidraw` : null,
    created_by: author.name, created_at: ts, updated_by: author.name, updated_at: ts };
  // Read before writing so a broken source drawing cannot leave a half-created version.
  const drawing = source.canvas ? await readCanvas(slug, source.id) : null;
  writeFileSync(nodePath(slug, copy.pillar, nextId), nodeToFile(copy));
  if (drawing) await writeCanvas(slug, nextId, drawing, author);
  await commitAll(projectDir(slug), { ...author, message: `node: continue "${source.title}" as v${version}` });
  return copy;
});

// Collect the ids of every descendant of `id` from a flat node list.
function descendantsOf(all, id) {
  const out = new Set();
  const walk = (pid) => {
    for (const c of all) if (c.parent === pid && !out.has(c.id)) { out.add(c.id); walk(c.id); }
  };
  walk(id);
  return out;
}

// Re-parent a node. Drop onto another node => becomes its child and adopts its pillar
// (the whole subtree follows into the new pillar). Guards against cycles so a node can
// never be moved into itself or one of its own descendants (which made it vanish before).
export const moveNode = projectWrite(async (slug, id, { parent, order, pillar }, author) => {
  const all = await listNodes(slug);
  const n = all.find((x) => x.id === id);
  if (!n) throw new Error("node not found");

  const newParent = parent === undefined ? (n.parent ?? null) : parent;
  if (newParent === id) throw new Error("cannot move a node into itself");
  const descendants = descendantsOf(all, id);
  if (newParent && descendants.has(newParent))
    throw new Error("cannot move a node into its own descendant");

  const parentNode = newParent ? all.find((x) => x.id === newParent) : null;
  if (newParent && !parentNode) throw new Error("parent not found");
  // child: inherit parent's category. root: use the explicit target category, else keep current.
  const newPillar = parentNode ? parentNode.pillar : (pillar ?? n.pillar);
  requireCategory(slug, newPillar);
  const ts = nowIso();

  // Write `node` into `newPillar`, removing its old file if the pillar actually changed.
  const writeAt = (node, oldPillar) => {
    mkdirSync(nodesDir(slug, newPillar), { recursive: true });
    writeFileSync(nodePath(slug, newPillar, node.id), nodeToFile({ ...node, pillar: newPillar }));
    if (newPillar !== oldPillar) rmSync(nodePath(slug, oldPillar, node.id));
  };

  const moved = { ...n, parent: newParent, order: order ?? n.order ?? 0,
    updated_by: author.name, updated_at: ts };
  writeAt(moved, n.pillar);

  // Cascade the pillar change down the subtree so files live in the right folder.
  if (newPillar !== n.pillar) {
    for (const d of all) {
      if (!descendants.has(d.id) || d.pillar === newPillar) continue;
      writeAt({ ...d, updated_by: author.name, updated_at: ts }, d.pillar);
    }
  }

  await commitAll(projectDir(slug), { ...author, message: `node: move "${n.title}"` });
  return { ...moved, pillar: newPillar };
});

export const deleteNode = projectWrite(async (slug, id, author) => {
  const all = await listNodes(slug);
  const n = all.find((node) => node.id === id);
  if (!n) return;
  const ids = descendantsOf(all, id);
  ids.add(id);
  const nodes = all.filter((node) => ids.has(node.id));
  const entry = { id: ulid(), rootId: id, title: n.title, nodes,
    categories: readCategories(slug), deletedAt: nowIso(), deletedBy: author.name };
  mkdirSync(join(projectDir(slug), "trash"), { recursive: true });
  writeFileSync(projectFile(slug, `trash/${entry.id}.json`), JSON.stringify(entry));
  for (const node of nodes) rmSync(nodePath(slug, node.pillar, node.id));
  await commitAll(projectDir(slug), { ...author, message: `node: delete "${n.title}"` });
  return { id: entry.id, title: entry.title, count: nodes.length };
});

export const listTrash = projectWrite(async (slug) => {
  const dir = join(projectDir(slug), "trash");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse().map((f) => {
    const { nodes, categories, ...entry } = JSON.parse(readFileSync(projectFile(slug, `trash/${f}`), "utf8"));
    return { ...entry, count: nodes.length };
  });
});

export const restoreTrash = projectWrite(async (slug, entryId, author) => {
  const path = projectFile(slug, `trash/${entryId}.json`);
  if (!existsSync(path)) throw problem("TRASH_NOT_FOUND", 404);
  const entry = JSON.parse(readFileSync(path, "utf8"));
  const active = await listNodes(slug);
  if (entry.nodes.some((n) => active.some((a) => a.id === n.id))) throw problem("RESTORE_CONFLICT", 409);
  const categories = readCategories(slug);
  const missing = entry.categories.filter((c) => entry.nodes.some((n) => n.pillar === c.slug) && !categories.some((a) => a.slug === c.slug));
  if (missing.length) {
    const { writeCategories } = await import("./categories.js");
    await writeCategories(slug, [...categories, ...missing], author);
  }
  const ids = new Set([...active, ...entry.nodes].map((n) => n.id));
  const root = entry.nodes.find((n) => n.id === entry.rootId);
  const externalParent = active.find((n) => n.id === root?.parent);
  for (const n of entry.nodes) {
    const restored = { ...n, pillar: externalParent?.pillar || n.pillar, parent: ids.has(n.parent) ? n.parent : null, updated_at: nowIso(), updated_by: author.name };
    mkdirSync(nodesDir(slug, restored.pillar), { recursive: true });
    writeFileSync(nodePath(slug, restored.pillar, n.id), nodeToFile(restored));
  }
  rmSync(path);
  await commitAll(projectDir(slug), { ...author, message: `trash: restore "${entry.title}"` });
  return { id: entry.rootId, count: entry.nodes.length };
});

export const duplicateNode = projectWrite(async (slug, id, title, author) => {
  const all = await listNodes(slug);
  const source = all.find((n) => n.id === id);
  if (!source) throw problem("NODE_NOT_FOUND", 404);
  const included = descendantsOf(all, id); included.add(id);
  const copies = all.filter((n) => included.has(n.id));
  const ids = new Map(copies.map((n) => [n.id, ulid()]));
  for (const n of copies) {
    const nextId = ids.get(n.id);
    const copy = { ...n, id: nextId, parent: ids.get(n.parent) || n.parent,
      title: n.id === id ? (title || `${n.title} (copy)`) : n.title,
      order: n.id === id ? (n.order ?? 0) + 0.5 : n.order,
      alternatives_to: ids.get(n.alternatives_to) || n.alternatives_to,
      continued_from: ids.get(n.continued_from) || null,
      version: ids.has(n.continued_from) ? n.version : null,
      body: (n.body || "").replace(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g, (match, ref, label = "") => ids.has(ref) ? `[[${ids.get(ref)}${label}]]` : match),
      created_by: author.name, created_at: nowIso(), updated_by: author.name, updated_at: nowIso(),
      canvas: n.canvas ? `canvases/${nextId}.excalidraw` : null };
    writeFileSync(nodePath(slug, copy.pillar, nextId), nodeToFile(copy));
    if (n.canvas) await writeCanvas(slug, nextId, await readCanvas(slug, n.id), author);
  }
  await commitAll(projectDir(slug), { ...author, message: `node: duplicate "${source.title}"` });
  return getNode(slug, ids.get(id));
});

export async function nodeHistory(slug, id) {
  const n = await getNode(slug, id);
  if (!n) return [];
  return fileHistory(projectDir(slug), `:(glob)nodes/*/${n.id}.md`, { follow: false });
}

export const restoreNode = projectWrite(async (slug, id, commit, author) => {
  const n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const raw = await findFileAtCommit(projectDir(slug), commit, "nodes", `${n.id}.md`);
  // Restore content while keeping today's placement, attachment links and canvas.
  // Restoring an old parent could create a cycle or orphan an already moved subtree.
  const old = fileToNode(raw);
  const restored = { ...n, title: old.title, body: old.body, status: old.status,
    kind: old.kind, progress: old.progress, tracking: old.tracking || null, updated_by: author.name, updated_at: nowIso() };
  writeFileSync(nodePath(slug, n.pillar, id), nodeToFile(restored));
  await commitAll(projectDir(slug), { ...author, message: `node: restore "${n.title}"` });
  return restored;
});
