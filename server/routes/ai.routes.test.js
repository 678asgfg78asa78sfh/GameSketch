import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-ai-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return r.cookies.find((c) => c.name === "gs_session").value;
}

test("export.md returns flattened markdown", async () => {
  const app = await buildServer();
  const cookie = await authed(app);
  const cj = { gs_session: cookie };
  const p = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "G" } })).json();
  await app.inject({ method: "POST", url: `/api/projects/${p.slug}/nodes`, cookies: cj,
    payload: { pillar: "gameloop", title: "Loop", body: "fun" } });
  const md = await app.inject({ method: "GET", url: `/api/projects/${p.slug}/export.md`, cookies: cj });
  assert.match(md.body, /## Gameloop/);
  assert.match(md.body, /Loop/);
  await app.close();
});
