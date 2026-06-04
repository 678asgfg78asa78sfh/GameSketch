import { test } from "node:test";
import assert from "node:assert/strict";
import { ulid } from "./ids.js";

test("ulid is 26 chars, Crockford base32, monotonic-ish unique", () => {
  const a = ulid(); const b = ulid();
  assert.equal(a.length, 26);
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.notEqual(a, b);
});
