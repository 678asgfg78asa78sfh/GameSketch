import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-agent-"));
const { createProject } = await import("../storage/projects.js");
const { listNodes } = await import("../storage/nodes.js");
const { parseReply, extractJsonObject, applyActions, buildContext } = await import("./agent.js");

const author = { name: "ms", email: "ms@local" };

test("extractJsonObject ignores braces/quotes inside strings", () => {
  const t = 'blah ```json\n{"reply":"use {curly} \\"quoted\\"","actions":[]}\n``` trailing';
  const raw = extractJsonObject(t);
  const obj = JSON.parse(raw);
  assert.equal(obj.reply, 'use {curly} "quoted"');
});

test("parseReply: fenced json, raw json, and plain text", () => {
  assert.deepEqual(parseReply('{"reply":"hi","actions":[]}'), { reply: "hi", actions: [] });
  const p = parseReply('Sure!\n```json\n{"reply":"done","actions":[{"type":"create_node"}]}\n```');
  assert.equal(p.reply, "done");
  assert.equal(p.actions.length, 1);
  assert.deepEqual(parseReply("just talking, no json here"), { reply: "just talking, no json here", actions: [] });
});

test("applyActions creates and updates nodes; bad ids are reported not thrown", async () => {
  const p = await createProject({ title: "A" }, author);
  const created = await applyActions(p.slug, [
    { type: "create_node", pillar: "gameloop", title: "Core Loop", body: "collect, fight, upgrade", status: "core" },
    { type: "create_node", pillar: "not-a-pillar", title: "Fallback" }, // bad pillar -> gameloop
  ], author);
  assert.equal(created.filter((x) => x.type === "create").length, 2);
  assert.equal(created[1].pillar, "gameloop");

  const loopId = created[0].id;
  const upd = await applyActions(p.slug, [
    { type: "update_node", id: loopId, body: "revised loop" },
    { type: "update_node", id: "does-not-exist", title: "x" }, // -> error, no throw
  ], author);
  assert.equal(upd.find((x) => x.type === "update")?.id, loopId);
  assert.ok(upd.some((x) => x.type === "error"));

  const nodes = await listNodes(p.slug);
  assert.equal(nodes.find((n) => n.id === loopId).body, "revised loop");
});

test("buildContext lists ids and marks the current node", async () => {
  const p = await createProject({ title: "B" }, author);
  const made = await applyActions(p.slug, [{ type: "create_node", pillar: "content", title: "World" }], author);
  const project = { ...p, nodes: await listNodes(p.slug) };
  const ctx = buildContext(project, made[0].id);
  assert.match(ctx, /id=/);
  assert.match(ctx, /USER IS HERE/);
});
