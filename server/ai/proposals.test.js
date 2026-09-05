import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-proposals-"));
const { createProject, getProject } = await import("../storage/projects.js");
const { createNode, updateNode, getNode } = await import("../storage/nodes.js");
const { prepareProposal, applyProposal } = await import("./proposals.js");
const { undoAction } = await import("../storage/actions.js");
const { writeCategories } = await import("../storage/categories.js");
const author = { name: "tester", email: "tester@local" };

test("a proposal previews without writing, applies once and undoes all its changes", async () => {
  const p = await createProject({ title: "AI review" }, author);
  const node = await createNode(p.slug, { pillar: "gameloop", title: "Roll", body: "Before" }, author);
  const proposal = prepareProposal(await getProject(p.slug), [
    { type: "update_node", id: node.id, body: "After" },
    { type: "create_node", pillar: "content", title: "Enemy", body: "Details" },
  ], author);
  assert.equal(proposal.changes[0].fields[0].before, "Before");
  assert.equal((await getNode(p.slug, node.id)).body, "Before");
  assert.equal((await getProject(p.slug)).nodes.length, 1);
  const first = await applyProposal(p.slug, proposal.id, author);
  assert.equal(first.action.changes.length, 2);
  const again = await applyProposal(p.slug, proposal.id, author);
  assert.equal(again.alreadyApplied, true);
  assert.equal((await getProject(p.slug)).nodes.length, 2);
  await undoAction(p.slug, first.action.id, author);
  assert.equal((await getProject(p.slug)).nodes.length, 1);
  assert.equal((await getNode(p.slug, node.id)).body, "Before");
  assert.equal((await applyProposal(p.slug, proposal.id, author)).action.undone, true);
});

test("stale proposals and proposals from other users leave current work intact", async () => {
  const p = await createProject({ title: "Stale review" }, author);
  const node = await createNode(p.slug, { pillar: "gameloop", body: "Original" }, author);
  const proposal = prepareProposal(await getProject(p.slug), [{ type: "update_node", id: node.id, body: "AI text" }], author);
  await assert.rejects(() => applyProposal(p.slug, proposal.id, { name: "other" }), { code: "PROPOSAL_OWNER" });
  await updateNode(p.slug, node.id, { body: "Newer human work" }, author);
  await assert.rejects(() => applyProposal(p.slug, proposal.id, author), { code: "STALE_PROPOSAL" });
  assert.equal((await getNode(p.slug, node.id)).body, "Newer human work");
});

test("a later failure rolls back earlier changes in the same AI response", async () => {
  const p = await createProject({ title: "Atomic review" }, author);
  const node = await createNode(p.slug, { pillar: "gameloop", body: "Keep this" }, author);
  const project = await getProject(p.slug);
  const proposal = prepareProposal(project, [{ type: "update_node", id: node.id, body: "Intermediate" }, { type: "create_node", pillar: "scope", title: "Plan" }], author);
  await writeCategories(p.slug, project.categories.filter((c) => c.slug !== "scope"), author);
  await assert.rejects(() => applyProposal(p.slug, proposal.id, author));
  assert.equal((await getNode(p.slug, node.id)).body, "Keep this");
  assert.equal((await getProject(p.slug)).nodes.length, 1);
});

test("repeated targets produce one preview of the final result; unchanged proposals disappear", async () => {
  const p = await createProject({ title: "Merged proposal" }, author);
  const n = await createNode(p.slug, { pillar: "gameloop", title: "Original", body: "Before" }, author);
  const project = await getProject(p.slug);
  const proposal = prepareProposal(project, [{ type: "update_node", id: n.id, title: "New title", body: "Intermediate" }, { type: "update_node", id: n.id, body: "Final" }], author);
  assert.equal(proposal.changes.length, 1);
  assert.equal(proposal.changes[0].fields.find((f) => f.key === "body").after, "Final");
  const result = await applyProposal(p.slug, proposal.id, author);
  assert.equal(result.applied.length, 1);
  assert.equal((await getNode(p.slug, n.id)).title, "New title");
  assert.equal(prepareProposal(await getProject(p.slug), [{ type: "update_node", id: n.id, body: "Final" }], author), null);
});
