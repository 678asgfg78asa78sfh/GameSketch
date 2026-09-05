import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { dataDir, projectDir } from "../storage/paths.js";
import { projectWrite } from "../storage/lock.js";
import { getProject } from "../storage/projects.js";
import { createNode, updateNode } from "../storage/nodes.js";
import { recordAction } from "../storage/actions.js";
import { problem } from "../storage/files.js";
import { ulid } from "../util/ids.js";

function proposalPath(slug, id) {
  projectDir(slug); // validate the project name before constructing the path
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw problem("PROPOSAL_NOT_FOUND", 404);
  return join(dataDir(), "proposals", slug, `${id}.json`);
}

export function prepareProposal(project, actions, author) {
  if (!Array.isArray(actions) || actions.length > 50) throw problem("INVALID_PROPOSAL");
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const expected = new Map();
  const normalized = [], changes = [];
  const track = (node) => { expected.set(node.id, node.updated_at ?? null); };
  for (const action of actions) {
    if (!action || !["create_node", "update_node"].includes(action.type)) throw problem("INVALID_PROPOSAL");
    const fields = {};
    for (const key of ["title", "body", "status", "kind", "progress"]) {
      if (action[key] === undefined) continue;
      if (typeof action[key] !== "string") throw problem("INVALID_PROPOSAL");
      fields[key] = action[key].slice(0, key === "body" ? 200000 : 200);
    }
    for (const [key, allowed] of Object.entries({ status: ["core", "side", "future"], kind: ["idea", "alternative", "note"], progress: ["new", "needs_work", "complete"] })) {
      if (fields[key] !== undefined && !allowed.includes(fields[key])) throw problem("INVALID_PROPOSAL");
    }
    if (action.type === "create_node") {
      const parent = action.parent ? byId.get(action.parent) : null;
      if (action.parent && !parent) throw problem("INVALID_PROPOSAL");
      const pillar = parent?.pillar || action.pillar;
      if (!project.categories.some((c) => c.slug === pillar)) throw problem("INVALID_PROPOSAL");
      if (parent) track(parent);
      const input = { ...fields, title: fields.title || "Untitled", pillar, parent: parent?.id || null };
      normalized.push({ type: "create_node", input });
      changes.push({ type: "create", title: input.title, fields: Object.entries(input).map(([key, after]) => ({ key, before: null, after })) });
    } else {
      const node = byId.get(action.id);
      if (!node) throw problem("INVALID_PROPOSAL");
      if (!Object.keys(fields).length) continue;
      track(node);
      let update = normalized.find((a) => a.type === "update_node" && a.id === node.id);
      if (update) Object.assign(update.patch, fields);
      else { update = { type: "update_node", id: node.id, patch: fields }; normalized.push(update); }
      const preview = { type: "update", id: node.id, title: update.patch.title || node.title,
        fields: Object.entries(update.patch).filter(([key, value]) => value !== node[key]).map(([key, after]) => ({ key, before: node[key] ?? null, after })) };
      const index = changes.findIndex((c) => c.type === "update" && c.id === node.id);
      if (index < 0) changes.push(preview); else changes[index] = preview;
    }
  }
  const planned = normalized.filter((a) => a.type === "create_node" || changes.some((c) => c.id === a.id && c.fields.length));
  const visibleChanges = changes.filter((c) => c.type === "create" || c.fields.length);
  if (!planned.length) return null;
  const proposal = { id: ulid(), slug: project.slug, author: author.name, date: new Date().toISOString(),
    expected: Object.fromEntries(expected), actions: planned, changes: visibleChanges };
  const dir = join(dataDir(), "proposals", project.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(proposalPath(project.slug, proposal.id), JSON.stringify(proposal));
  return { id: proposal.id, slug: project.slug, changes: visibleChanges, date: proposal.date };
}

export const applyProposal = projectWrite(async (slug, id, author) => {
  const path = proposalPath(slug, id);
  if (!existsSync(path)) throw problem("PROPOSAL_NOT_FOUND", 404);
  const proposal = JSON.parse(readFileSync(path, "utf8"));
  if (proposal.author !== author.name) throw problem("PROPOSAL_OWNER", 403);
  const response = await recordAction(slug, "copilot", author, async () => {
    const project = await getProject(slug);
    if (!project) throw problem("PROJECT_NOT_FOUND", 404);
    for (const [nodeId, updatedAt] of Object.entries(proposal.expected)) {
      const node = project.nodes.find((n) => n.id === nodeId);
      if (!node || (node.updated_at ?? null) !== updatedAt) throw problem("STALE_PROPOSAL", 409);
    }
    const applied = [];
    for (const action of proposal.actions) {
      const node = action.type === "create_node"
        ? await createNode(slug, action.input, author)
        : await updateNode(slug, action.id, action.patch, author);
      applied.push({ id: node.id, title: node.title, type: action.type === "create_node" ? "create" : "update" });
    }
    return applied;
  }, proposal.id);
  return { applied: response.result, action: response.action, alreadyApplied: !!response.alreadyApplied, changed: !response.alreadyApplied };
});
