import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-asset-"));
const { createProject } = await import("./projects.js");
const { saveAsset } = await import("./assets.js");
const { writeCanvas, readCanvas } = await import("./canvas.js");
const author = { name: "ms", email: "ms@local" };

test("saveAsset returns repo-relative path and writes file", async () => {
  const p = await createProject({ title: "A" }, author);
  const rel = await saveAsset(p.slug, "node1", { filename: "sketch.png", buffer: Buffer.from("PNGDATA") }, author);
  assert.match(rel, /^assets\/[a-f0-9]{8}-sketch\.png$/);
  assert.ok(existsSync(join(process.env.GS_DATA_DIR, "projects", p.slug, rel)));
});

test("canvas write/read round-trips JSON", async () => {
  const p = await createProject({ title: "C" }, author);
  await writeCanvas(p.slug, "n1", { elements: [], appState: {} }, author);
  assert.deepEqual((await readCanvas(p.slug, "n1")).elements, []);
});
