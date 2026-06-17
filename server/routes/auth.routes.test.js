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

test("change password: wrong current 401, correct rotates and new password logs in", async () => {
  const app = await buildServer();
  // user ms/pw already exists from the first test (shared data dir within this file)
  const cookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } }))
    .cookies.find((c) => c.name === "gs_session").value;
  const cj = { gs_session: cookie };

  let res = await app.inject({ method: "POST", url: "/api/auth/password", cookies: cj, payload: { current: "nope", next: "fresh" } });
  assert.equal(res.statusCode, 401);

  res = await app.inject({ method: "POST", url: "/api/auth/password", cookies: cj, payload: { current: "pw", next: "fresh" } });
  assert.equal(res.statusCode, 200);

  assert.equal((await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } })).statusCode, 401);
  assert.equal((await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "fresh" } })).statusCode, 200);
  await app.close();
});
