import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-persistence-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function fixture(t) {
  const app = await buildServer();
  t.after(() => app.close());
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "tester", password: "pw" } });
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "tester", password: "pw" } });
  const cookies = { gs_session: login.cookies.find((c) => c.name === "gs_session").value };
  const request = (method, url, payload) => app.inject({ method, url, payload, cookies });
  const p = (await request("POST", "/api/projects", { title: "Persistence" })).json();
  const url = `/api/projects/${p.slug}`;
  const parent = (await request("POST", `${url}/nodes`, { pillar: "content", title: "Parent" })).json();
  const child = (await request("POST", `${url}/nodes`, { pillar: "content", parent: parent.id, title: "Child" })).json();
  return { request, url, parent, child };
}

test("PATCH order keeps nesting; PATCH category moves a root and its descendants", async (t) => {
  const { request, url, parent, child } = await fixture(t);
  const reordered = await request("PATCH", `${url}/nodes/${child.id}`, { order: 7 });
  assert.equal(reordered.statusCode, 200);
  assert.equal(reordered.json().parent, parent.id);
  assert.equal(reordered.json().order, 7);
  const moved = await request("PATCH", `${url}/nodes/${parent.id}`, { pillar: "scope" });
  assert.equal(moved.statusCode, 200);
  assert.equal(moved.json().pillar, "scope");
  const p = (await request("GET", url)).json();
  assert.equal(p.nodes.find((n) => n.id === child.id).pillar, "scope");
});

test("invalid moves leave the node intact and do not block later saves", async (t) => {
  const { request, url, parent } = await fixture(t);
  const invalid = await request("PATCH", `${url}/nodes/${parent.id}`, { pillar: "missing-category", body: "Should not save" });
  assert.equal(invalid.statusCode, 400);
  const missing = await request("PATCH", `${url}/nodes/MISSING`, { body: "Missing" });
  assert.equal(missing.statusCode, 404);
  const valid = await request("PATCH", `${url}/nodes/${parent.id}`, { body: "Saved after error" });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().pillar, "content");
  assert.equal(valid.json().body, "Saved after error");
});

test("image canvases larger than 1 MB and simultaneous text edits both persist", async (t) => {
  const { request, url, parent } = await fixture(t);
  const scene = {
    elements: [{ id: "image-element", type: "image", fileId: "image-file" }],
    files: { "image-file": { id: "image-file", mimeType: "image/png", dataURL: `data:image/png;base64,${"A".repeat(1200000)}` } },
    appState: { viewBackgroundColor: "#123456" },
  };
  const responses = await Promise.all([
    request("PUT", `${url}/canvases/${parent.id}`, scene),
    request("PATCH", `${url}/nodes/${parent.id}`, { body: "Text while saving canvas" }),
  ]);
  for (const response of responses) assert.equal(response.statusCode, 200, response.payload);
  assert.deepEqual((await request("GET", `${url}/canvases/${parent.id}`)).json(), scene);
  const saved = (await request("GET", url)).json().nodes.find((n) => n.id === parent.id);
  assert.equal(saved.body, "Text while saving canvas");
  assert.equal(saved.canvas, `canvases/${parent.id}.excalidraw`);
});
