import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "../util/ids.js";
import { nodesDir, nodePath, projectDir } from "./paths.js";
import { commitAll, fileHistory, fileAtCommit } from "./git.js";

const PILLARS = ["gameloop", "artstyle", "content", "threads", "scope"];

function nowIso() { return new Date().toISOString(); }

function fileToNode(raw) {
  const { data, content } = matter(raw);
  return { ...data, body: content.replace(/^\n/, "").replace(/\n$/, "") };
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
  for (const pillar of PILLARS) {
    const dir = join(base, pillar);
    if (!existsSync(dir)) continue;
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
    kind: input.kind || "idea", parent: input.parent ?? null,
    order: input.order ?? Date.now() % 100000,
    alternatives_to: input.alternatives_to ?? null,
    attachments: input.attachments || [], canvas: input.canvas ?? null,
    created_by: author.name, created_at: ts, updated_by: author.name, updated_at: ts,
    body: input.body || "",
  };
  if (!PILLARS.includes(n.pillar)) throw new Error(`bad pillar: ${n.pillar}`);
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

export async function moveNode(slug, id, { parent, order }, author) {
  return updateNode(slug, id, { parent: parent ?? null, order: order ?? 0 }, author);
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
