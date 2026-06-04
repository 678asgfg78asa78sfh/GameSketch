import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-noderoutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return r.cookies.find((c) => c.name === "gs_session").value;
}

test("create project + node, list back via project GET", async () => {
  const app = await buildServer();
  const cookie = await authed(app);
  const cj = { gs_session: cookie };
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "G" } })).json();
  const node = (await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj,
    payload: { pillar: "gameloop", title: "Loop" } })).json();
  assert.equal(node.pillar, "gameloop");
  const full = (await app.inject({ method: "GET", url: `/api/projects/${proj.slug}`, cookies: cj })).json();
  assert.equal(full.nodes.length, 1);
  await app.close();
});
