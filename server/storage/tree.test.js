import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, flattenToMarkdown, subtreeNodes, subtreeToMarkdown } from "./tree.js";

const nodes = [
  { id: "a", title: "Loop", pillar: "gameloop", status: "core", kind: "idea", parent: null, order: 0, body: "core loop" },
  { id: "b", title: "Combat", pillar: "gameloop", status: "core", kind: "idea", parent: "a", order: 0, body: "swing" },
  { id: "c", title: "Stealth alt", pillar: "gameloop", status: "side", kind: "alternative", parent: "a", order: 1, alternatives_to: "b", body: "sneak" },
];
const project = { title: "Demo" };

test("buildTree nests by parent within pillar, sorted by order", () => {
  const t = buildTree(nodes);
  assert.equal(t.gameloop.length, 1);
  assert.equal(t.gameloop[0].children.length, 2);
  assert.equal(t.gameloop[0].children[0].id, "b");
  // categories are dynamic now: buildTree only keys the categories that actually have nodes
  assert.deepEqual(Object.keys(t), ["gameloop"]);
});

test("flattenToMarkdown emits pillar headings and node bodies", () => {
  const md = flattenToMarkdown(project, nodes);
  assert.match(md, /# Demo/);
  assert.match(md, /## Gameloop/);
  assert.match(md, /Loop/);
  assert.match(md, /\[side\]/);
});

test("subtreeNodes returns node + descendants", () => {
  const sub = subtreeNodes(nodes, "a");
  assert.deepEqual(sub.map((n) => n.id).sort(), ["a", "b", "c"]);
  assert.match(subtreeToMarkdown(project, nodes, "a"), /Combat/);
});
