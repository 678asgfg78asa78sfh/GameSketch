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
  c.ai.baseUrl = "http://127.0.0.1:1234/v1";
  saveConfig(c);
  assert.equal(loadConfig().ai.baseUrl, "http://127.0.0.1:1234/v1");
});
