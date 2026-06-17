import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-settings-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return { gs_session: r.cookies.find((c) => c.name === "gs_session").value };
}

test("settings: GET redacts apiKey; PUT sets it; key persists when omitted", async () => {
  const app = await buildServer();
  const cj = await authed(app);

  let res = await app.inject({ method: "GET", url: "/api/settings", cookies: cj });
  assert.equal(res.statusCode, 200);
  let ai = res.json().ai;
  assert.equal(ai.provider, "claude-cli");
  assert.equal(ai.openai.hasKey, false);
  assert.equal("apiKey" in ai.openai, false); // never leaked

  // set provider + key
  res = await app.inject({ method: "PUT", url: "/api/settings", cookies: cj,
    payload: { ai: { provider: "openai", openai: { baseUrl: "https://openrouter.ai/api/v1", apiKey: "sk-secret", model: "x" } } } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().ai.openai.hasKey, true);
  assert.equal("apiKey" in res.json().ai.openai, false);

  // update model only, omit apiKey -> key kept
  res = await app.inject({ method: "PUT", url: "/api/settings", cookies: cj,
    payload: { ai: { openai: { model: "y" } } } });
  ai = res.json().ai;
  assert.equal(ai.openai.model, "y");
  assert.equal(ai.openai.hasKey, true);

  // empty string clears the key
  res = await app.inject({ method: "PUT", url: "/api/settings", cookies: cj,
    payload: { ai: { openai: { apiKey: "" } } } });
  assert.equal(res.json().ai.openai.hasKey, false);

  await app.close();
});

test("settings: requires auth", async () => {
  const app = await buildServer();
  assert.equal((await app.inject({ method: "GET", url: "/api/settings" })).statusCode, 401);
  await app.close();
});

test("model pull for claude-cli returns known models without network", async () => {
  const app = await buildServer();
  const cj = await authed(app);
  const res = await app.inject({ method: "POST", url: "/api/settings/ai/models", cookies: cj,
    payload: { ai: { provider: "claude-cli" } } });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().models.includes("claude-opus-4-8"));
  await app.close();
});
