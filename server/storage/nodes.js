import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "../util/ids.js";
import { nodesDir, nodePath, projectDir } from "./paths.js";
import { commitAll, fileHistory, fileAtCommit } from "./git.js";
import { isCategorySlug } from "./categories.js";

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

function relFor(n) { return join("nodes", n.pillar, `${n.id}.md`); }

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

export async function createNode(slug, input, author) {
  const id = ulid();
  const ts = nowIso();
  const n = {
    id, title: input.title || "Neue Idee",
    pillar: input.pillar, status: input.status || "core",
    kind: input.kind || "idea", progress: input.progress || "new", parent: input.parent ?? null,
    order: input.order ?? Date.now() % 100000,
    alternatives_to: input.alternatives_to ?? null,
    attachments: input.attachments || [], canvas: input.canvas ?? null,
    created_by: author.name, created_at: ts, updated_by: author.name, updated_at: ts,
    body: input.body || "",
  };
  if (!isCategorySlug(n.pillar)) throw new Error(`bad category: ${n.pillar}`);
  mkdirSync(nodesDir(slug, n.pillar), { recursive: true });
  writeFileSync(nodePath(slug, n.pillar, id), nodeToFile(n));
  await commitAll(projectDir(slug), { ...author, message: `node: create "${n.title}"` });
  return n;
}

export async function updateNode(slug, id, patch, author) {
  const n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const next = { ...n, ...patch, id: n.id, pillar: patch.pillar || n.pillar,
    updated_by: author.name, updated_at: nowIso() };
  if (next.pillar !== n.pillar) rmSync(nodePath(slug, n.pillar, id));
  mkdirSync(nodesDir(slug, next.pillar), { recursive: true });
  writeFileSync(nodePath(slug, next.pillar, id), nodeToFile(next));
  await commitAll(projectDir(slug), { ...author, message: `node: edit "${next.title}"` });
  return next;
}

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
export async function moveNode(slug, id, { parent, order, pillar }, author) {
  const all = await listNodes(slug);
  const n = all.find((x) => x.id === id);
  if (!n) throw new Error("node not found");

  const newParent = parent ?? null;
  if (newParent === id) throw new Error("cannot move a node into itself");
  const descendants = descendantsOf(all, id);
  if (newParent && descendants.has(newParent))
    throw new Error("cannot move a node into its own descendant");

  const parentNode = newParent ? all.find((x) => x.id === newParent) : null;
  if (newParent && !parentNode) throw new Error("parent not found");
  // child: inherit parent's category. root: use the explicit target category, else keep current.
  const newPillar = parentNode ? parentNode.pillar : (isCategorySlug(pillar) ? pillar : n.pillar);
  const ts = nowIso();

  // Write `node` into `newPillar`, removing its old file if the pillar actually changed.
  const writeAt = (node, oldPillar) => {
    if (newPillar !== oldPillar) rmSync(nodePath(slug, oldPillar, node.id));
    mkdirSync(nodesDir(slug, newPillar), { recursive: true });
    writeFileSync(nodePath(slug, newPillar, node.id), nodeToFile({ ...node, pillar: newPillar }));
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
}

export async function deleteNode(slug, id, author) {
  const n = await getNode(slug, id);
  if (!n) return;
  rmSync(nodePath(slug, n.pillar, id));
  await commitAll(projectDir(slug), { ...author, message: `node: delete "${n.title}"` });
}

export async function nodeHistory(slug, id) {
  const n = await getNode(slug, id);
  if (!n) return [];
  return fileHistory(projectDir(slug), relFor(n));
}

export async function restoreNode(slug, id, commit, author) {
  const n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const raw = await fileAtCommit(projectDir(slug), commit, relFor(n));
  writeFileSync(nodePath(slug, n.pillar, id), raw);
  await commitAll(projectDir(slug), { ...author, message: `node: restore "${n.title}"` });
  return fileToNode(raw);
}
