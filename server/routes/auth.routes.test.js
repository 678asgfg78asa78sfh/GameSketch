import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-authroutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

test("first-run setup creates user; login sets cookie; me returns name", async () => {
  const app = await buildServer();
  let res = await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  assert.equal(res.statusCode, 200);
  res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  assert.equal(res.statusCode, 200);
  const cookie = res.cookies.find((c) => c.name === "gs_session").value;
  const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { gs_session: cookie } });
  assert.equal(me.json().name, "ms");
  await app.close();
});

test("unauthenticated /api/projects is 401", async () => {
  const app = await buildServer();
  const res = await app.inject({ method: "GET", url: "/api/projects" });
  assert.equal(res.statusCode, 401);
  await app.close();
});
