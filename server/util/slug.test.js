import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug.js";

test("slugify lowercases, strips, dashifies, handles umlauts", () => {
  assert.equal(slugify("Mein Cooles Spiel!"), "mein-cooles-spiel");
  assert.equal(slugify("Über Größe"), "ueber-groesse");
  assert.equal(slugify("  a  b  "), "a-b");
  assert.equal(slugify(""), "untitled");
});
