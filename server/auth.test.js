import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-auth-"));
const { hashPassword, verifyPassword, signSession, verifySession } = await import("./auth.js");

test("password hash verifies; wrong password fails", () => {
  const rec = hashPassword("hunter2");
  assert.ok(verifyPassword("hunter2", rec));
  assert.equal(verifyPassword("nope", rec), false);
});

test("session cookie signs and verifies; tamper fails", () => {
  const c = signSession("ms");
  assert.equal(verifySession(c), "ms");
  assert.equal(verifySession(c + "x"), null);
});
