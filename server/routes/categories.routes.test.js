import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-cats-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return { gs_session: r.cookies.find((c) => c.name === "gs_session").value };
}

test("new project ships the default 5 categories with colors", async () => {
  const app = await buildServer();
  const cj = await authed(app);
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "C" } })).json();
  const full = (await app.inject({ method: "GET", url: `/api/projects/${proj.slug}`, cookies: cj })).json();
  assert.equal(full.categories.length, 5);
  assert.equal(full.categories[0].slug, "gameloop");
  assert.ok(/^#/.test(full.categories[0].color));
  await app.close();
});

test("can add/rename/recolor categories; node lands in a custom one", async () => {
  const app = await buildServer();
  const cj = await authed(app);
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "D" } })).json();

  const next = [
    { slug: "gameloop", label: "Core Loop", color: "#ff0000" }, // renamed + recolored
    { slug: "audio", label: "Audio", color: "#00ff00" },        // new category
  ];
  let res = await app.inject({ method: "PUT", url: `/api/projects/${proj.slug}/categories`, cookies: cj, payload: { categories: next } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().categories.length, 2);
  assert.equal(res.json().categories[0].label, "Core Loop");

  // create a node in the new custom category and read it back
  await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj, payload: { pillar: "audio", title: "SFX" } });
  const full = (await app.inject({ method: "GET", url: `/api/projects/${proj.slug}`, cookies: cj })).json();
  assert.ok(full.nodes.find((n) => n.pillar === "audio" && n.title === "SFX"));
  await app.close();
});

test("refuses to remove a category that still has nodes", async () => {
  const app = await buildServer();
  const cj = await authed(app);
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "E" } })).json();
  await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj, payload: { pillar: "gameloop", title: "X" } });
  // try to drop "gameloop" (which now has a node)
  const res = await app.inject({ method: "PUT", url: `/api/projects/${proj.slug}/categories`, cookies: cj,
    payload: { categories: [{ slug: "content", label: "Content", color: "#2ee6a8" }] } });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().error, /not empty/);
  await app.close();
});

test("templates: built-in default present; save + list", async () => {
  const app = await buildServer();
  const cj = await authed(app);
  let res = (await app.inject({ method: "GET", url: "/api/templates", cookies: cj })).json();
  assert.ok(res.templates.find((t) => t.builtin));
  await app.inject({ method: "POST", url: "/api/templates", cookies: cj,
    payload: { name: "Minimal", categories: [{ slug: "idea", label: "Ideas", color: "#7c8cff" }] } });
  res = (await app.inject({ method: "GET", url: "/api/templates", cookies: cj })).json();
  assert.ok(res.templates.find((t) => t.name === "Minimal"));
  await app.close();
});
