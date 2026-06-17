import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-pair-"));
const { createRequest, pollByToken, listRequests, approve, deny, revoke, validateToken } = await import("./pairing.js");

test("request is pending and not valid until approved", () => {
  const { id, token } = createRequest("claude-cli");
  assert.equal(pollByToken(token).status, "pending");
  assert.equal(validateToken(token), null); // pending != usable
  const view = approve(id, "infinite");
  assert.equal(view.status, "active");
  assert.equal(view.expiresAt, null);
  assert.ok(validateToken(token)); // now usable
  assert.equal(pollByToken(token).status, "active");
});

test("timed approval sets an expiry; deny and revoke work", () => {
  const a = createRequest("agent-a");
  approve(a.id, "timed", 5);
  const rec = validateToken(a.token);
  assert.ok(rec.expiresAt > Date.now());

  const b = createRequest("agent-b");
  deny(b.id);
  assert.equal(validateToken(b.token), null);

  const c = createRequest("agent-c");
  approve(c.id, "infinite");
  assert.ok(validateToken(c.token));
  revoke(c.id);
  assert.equal(validateToken(c.token), null);
});

test("listRequests hides the secret token", () => {
  createRequest("visible");
  const list = listRequests();
  assert.ok(list.length >= 1);
  assert.equal("token" in list[0], false);
});
