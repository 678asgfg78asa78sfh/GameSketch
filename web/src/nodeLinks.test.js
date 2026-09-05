import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, linkedIds, searchNodes, orderedNodes } from "./nodeLinks.js";

test("node links use current titles, support labels, and leave code samples untouched", () => {
  const nodes = [{ id: "A", title: "Updated title" }];
  const html = renderMarkdown("[[A]] and [[A|custom]] and [[missing]]\n\n`[[A]]`\n\n```\n[[A]]\n```", nodes);
  assert.match(html, /data-node-id="A" href="#node-A">Updated title/);
  assert.match(html, />custom<\/a>/);
  assert.match(html, /class="missing-link"/);
  assert.match(html, /<code>\[\[A\]\]<\/code>/);
  assert.equal((html.match(/data-node-id/g) || []).length, 2);
  assert.deepEqual([...linkedIds("[[A]]\n\n`[[code]]`\n\n```\n[[fenced]]\n```\n\n- [[B|label]]")], ["A", "B"]);
});

test("search finds content with accents and combines progress and priority filters", () => {
  const nodes = [{ id: "1", title: "Wächter", body: "25 Ausdauer", progress: "needs_work", status: "core" }, { id: "2", title: "Test", body: "Wächter", progress: "complete", status: "side" }];
  assert.deepEqual(searchNodes(nodes, "wachter").map((n) => n.id), ["1", "2"]);
  assert.equal(searchNodes(nodes, "Ausdauer", { progress: "needs_work", status: "core" })[0].id, "1");
  assert.equal(searchNodes(nodes, "Ausdauer", { progress: "complete" }).length, 0);
});

test("document ordering keeps descendants under their parents", () => {
  const project = { categories: [{ slug: "a" }, { slug: "b" }], nodes: [{ id: "c", parent: "p", pillar: "a", order: 0 }, { id: "z", parent: null, pillar: "b", order: 0 }, { id: "p", parent: null, pillar: "a", order: 0 }] };
  assert.deepEqual(orderedNodes(project).map((n) => [n.id, n.depth]), [["p", 0], ["c", 1], ["z", 0]]);
});
