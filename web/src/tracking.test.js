import { test } from "node:test";
import assert from "node:assert/strict";
import { trackingProgress, projectProgress } from "../../shared/tracking.js";
import { searchNodes } from "./nodeLinks.js";
import translations from "./i18n/tracker.js";

const tasks = (done, total) => Array.from({ length: total }, (_, i) => ({ id: String(i), title: `Task ${i}`, done: i < done, kind: "task" }));
const tracked = (id, done, total, extra = {}) => ({ id, title: id, tracking: { enabled: true, completed: false, tasks: tasks(done, total) }, ...extra });

test("optional progress counts tasks, explicit completion and legacy statuses without guessing effort", () => {
  assert.equal(trackingProgress({ progress: "new" }).enabled, false);
  assert.equal(trackingProgress({ progress: "needs_work" }).percent, 0);
  assert.equal(trackingProgress({ progress: "complete" }).percent, 100);
  assert.equal(trackingProgress(tracked("empty", 0, 0)).percent, 0);
  assert.equal(trackingProgress(tracked("half", 1, 2)).percent, 50);
  assert.equal(trackingProgress(tracked("third", 1, 3)).percent, 33);
  assert.equal(trackingProgress(tracked("almost", 199, 200)).percent, 99);
  assert.equal(trackingProgress(tracked("done", 2, 2)).complete, true);
  const manual = tracked("manual", 0, 2); manual.tracking.completed = true;
  assert.equal(trackingProgress(manual).percent, 100);
  assert.equal(trackingProgress(manual).done, 0);
});

test("overall progress excludes untracked ideas, disabled trackers and superseded versions", () => {
  const nodes = [tracked("v1", 2, 2), tracked("v2", 1, 2, { continued_from: "v1" }),
    tracked("other", 0, 3), { id: "untracked", progress: "new" },
    { id: "disabled", progress: "complete", tracking: { enabled: false, completed: true, tasks: [] } }];
  assert.deepEqual(projectProgress(nodes), { total: 2, done: 0, percent: 25 });
  assert.deepEqual(projectProgress([]), { total: 0, done: 0, percent: 0 });
  assert.equal(projectProgress([tracked("one", 199, 200), tracked("two", 200, 200)]).percent, 99);
});

test("search finds checklist text and computes work filters from the current tasks", () => {
  const node = tracked("Roll", 1, 2);
  node.tracking.tasks[0].title = "Ausdauer prüfen";
  assert.deepEqual(searchNodes([node], "Ausdauer", { progress: "needs_work" }), [node]);
  assert.deepEqual(searchNodes([node], "Ausdauer", { progress: "complete" }), []);
});

test("tracker translations cover all supported languages", () => {
  for (const lang of ["de", "ru"]) {
    assert.deepEqual(Object.keys(translations[lang]).sort(), Object.keys(translations.en).sort());
    assert.deepEqual(Object.keys(translations[lang].errors).sort(), Object.keys(translations.en.errors).sort());
  }
});
