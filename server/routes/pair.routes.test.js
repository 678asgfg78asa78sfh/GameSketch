import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-pairroutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

test("agent pairing: token unusable until approved, then reads the export", async () => {
  const app = await buildServer();
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const cookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } }))
    .cookies.find((c) => c.name === "gs_session").value;
  const cj = { gs_session: cookie };

  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "G" } })).json();
  await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj, payload: { pillar: "gameloop", title: "Loop", body: "fun" } });

  // no auth at all -> 401
  assert.equal((await app.inject({ method: "GET", url: `/api/projects/${proj.slug}/export.md` })).statusCode, 401);

  // agent requests pairing
  const pair = (await app.inject({ method: "POST", url: "/api/pair/request", payload: { label: "claude" } })).json();
  assert.ok(pair.token && pair.id);

  // pending token cannot read yet
  let res = await app.inject({ method: "GET", url: `/api/projects/${proj.slug}/export.md`, headers: { authorization: `Bearer ${pair.token}` } });
  assert.equal(res.statusCode, 401);

  // user approves (infinite)
  await app.inject({ method: "POST", url: `/api/pair/agents/${pair.id}/approve`, cookies: cj, payload: { mode: "infinite" } });

  // now the token reads the export
  res = await app.inject({ method: "GET", url: `/api/projects/${proj.slug}/export.md`, headers: { authorization: `Bearer ${pair.token}` } });
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Loop/);

  // it shows up in the agents list without leaking the token
  const agents = (await app.inject({ method: "GET", url: "/api/pair/agents", cookies: cj })).json().agents;
  assert.ok(agents.find((a) => a.id === pair.id && a.status === "active"));
  assert.equal(agents.some((a) => "token" in a), false);
  await app.close();
});

test("agent scope: write token can edit, read token is 403 on writes", async () => {
  const app = await buildServer();
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const cookie = (await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } }))
    .cookies.find((c) => c.name === "gs_session").value;
  const cj = { gs_session: cookie };
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "W" } })).json();

  // a WRITE-scoped agent
  const w = (await app.inject({ method: "POST", url: "/api/pair/request", payload: { label: "writer" } })).json();
  await app.inject({ method: "POST", url: `/api/pair/agents/${w.id}/approve`, cookies: cj, payload: { mode: "infinite", scope: "write" } });
  const wres = await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`,
    headers: { authorization: `Bearer ${w.token}` }, payload: { pillar: "gameloop", title: "by-agent" } });
  assert.equal(wres.statusCode, 200);
  assert.equal(wres.json().title, "by-agent");

  // a READ-scoped agent cannot write
  const r = (await app.inject({ method: "POST", url: "/api/pair/request", payload: { label: "reader" } })).json();
  await app.inject({ method: "POST", url: `/api/pair/agents/${r.id}/approve`, cookies: cj, payload: { mode: "infinite", scope: "read" } });
  const rres = await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`,
    headers: { authorization: `Bearer ${r.token}` }, payload: { pillar: "gameloop", title: "nope" } });
  assert.equal(rres.statusCode, 403);
  // but the read token can still read the export
  assert.equal((await app.inject({ method: "GET", url: `/api/projects/${proj.slug}/export.md`, headers: { authorization: `Bearer ${r.token}` } })).statusCode, 200);
  await app.close();
});
