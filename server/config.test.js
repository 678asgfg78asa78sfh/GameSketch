import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-cfg-"));
const { loadConfig, saveConfig } = await import("./config.js");

test("loadConfig returns defaults; saveConfig persists", async () => {
  const c = loadConfig();
  assert.deepEqual(c.users, []);
  assert.ok(c.session_secret.length >= 32);
  assert.equal(c.ai.provider, "claude-cli");
  c.ai.openai.model = "anthropic/claude-sonnet";
  saveConfig(c);
  assert.equal(loadConfig().ai.openai.model, "anthropic/claude-sonnet");
});

test("legacy ai config migrates to provider shape", async () => {
  const c = loadConfig();
  saveConfig({ ...c, ai: { baseUrl: "http://127.0.0.1:1234/v1", model: "local", apiKey: "k" } });
  const ai = loadConfig().ai;
  assert.equal(ai.provider, "openai");
  assert.equal(ai.openai.baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(ai.openai.model, "local");
  assert.equal(ai.openai.apiKey, "k");
});
