import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-assetroutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return r.cookies.find((c) => c.name === "gs_session").value;
}

// Build a minimal multipart/form-data body for light-my-request inject.
function multipart(fields) {
  const boundary = "----gsboundaryTEST1234";
  const chunks = [];
  for (const f of fields) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\n` +
      `Content-Type: ${f.contentType}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

test("upload attachment: 200, returns path, records it on the node", async () => {
  const app = await buildServer();
  const cj = { gs_session: await authed(app) };
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "Up" } })).json();
  const node = (await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj,
    payload: { pillar: "gameloop", title: "N" } })).json();

  const { body, contentType } = multipart([
    { name: "file", filename: "ref.png", contentType: "image/png", data: Buffer.from("PNGDATA") },
  ]);
  const res = await app.inject({
    method: "POST",
    url: `/api/projects/${proj.slug}/nodes/${node.id}/attachments`,
    cookies: cj,
    headers: { "content-type": contentType },
    payload: body,
  });
  assert.equal(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${res.payload}`);
  const out = res.json();
  assert.match(out.path, /^assets\/[a-f0-9]{8}-ref\.png$/);

  const full = (await app.inject({ method: "GET", url: `/api/projects/${proj.slug}`, cookies: cj })).json();
  const n = full.nodes.find((x) => x.id === node.id);
  assert.ok((n.attachments || []).includes(out.path), "attachment path recorded on node");
  await app.close();
});
