import { randomBytes } from "node:crypto";
import { loadConfig, saveConfig } from "./config.js";
import { verifySession } from "./auth.js";

// Agent pairing tokens. Flow: an external agent POSTs a request -> the logged-in user
// approves it (choosing a lifetime) -> the agent's token becomes usable on the read API.
//
// Records: { id, token, label, status: pending|active|denied, mode: timed|infinite|until-restart,
//            createdAt, expiresAt|null }
// Persistence: active timed/infinite tokens are saved to config; "until-restart" tokens live
// only in memory and are gone after a server restart (cleanup is implicit).

const mem = new Map(); // id -> record
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  for (const r of loadConfig().agentTokens || []) mem.set(r.id, r);
  loaded = true;
}

function persist() {
  const cfg = loadConfig();
  cfg.agentTokens = [...mem.values()].filter(
    (r) => r.status === "active" && (r.mode === "timed" || r.mode === "infinite")
  );
  saveConfig(cfg);
}

function isExpired(r) {
  return r.expiresAt != null && Date.now() > r.expiresAt;
}

function publicView(r) {
  return { id: r.id, label: r.label, status: r.status, mode: r.mode, scope: r.scope || "read", createdAt: r.createdAt, expiresAt: r.expiresAt };
}

export function createRequest(label) {
  ensureLoaded();
  const id = randomBytes(8).toString("hex");
  const token = randomBytes(24).toString("hex");
  const rec = { id, token, label: String(label || "agent").slice(0, 80), status: "pending", mode: null, createdAt: Date.now(), expiresAt: null };
  mem.set(id, rec);
  return { id, token };
}

export function pollByToken(token) {
  ensureLoaded();
  const rec = [...mem.values()].find((r) => r.token === token);
  if (!rec) return null;
  if (isExpired(rec)) { mem.delete(rec.id); persist(); return { status: "expired", expiresAt: rec.expiresAt }; }
  return { status: rec.status, expiresAt: rec.expiresAt };
}

export function listRequests() {
  ensureLoaded();
  for (const r of [...mem.values()]) if (isExpired(r)) mem.delete(r.id);
  return [...mem.values()].sort((a, b) => b.createdAt - a.createdAt).map(publicView);
}

export function approve(id, mode, hours, scope) {
  ensureLoaded();
  const rec = mem.get(id);
  if (!rec) return null;
  rec.status = "active";
  rec.mode = ["timed", "infinite", "until-restart"].includes(mode) ? mode : "until-restart";
  rec.scope = scope === "write" ? "write" : "read";
  rec.expiresAt = rec.mode === "timed" ? Date.now() + Math.max(1, Number(hours) || 24) * 3600_000 : null;
  persist();
  return publicView(rec);
}

export function deny(id) {
  ensureLoaded();
  const rec = mem.get(id);
  if (!rec) return null;
  rec.status = "denied";
  persist();
  return publicView(rec);
}

export function revoke(id) {
  ensureLoaded();
  const existed = mem.delete(id);
  persist();
  return existed;
}

export function validateToken(token) {
  ensureLoaded();
  if (!token) return null;
  const rec = [...mem.values()].find((r) => r.token === token);
  if (!rec || rec.status !== "active" || isExpired(rec)) return null;
  return rec;
}

// Token from a header only — never from the query string (it would leak into logs/history).
function tokenFrom(req) {
  const auth = req.headers.authorization || "";
  return (auth.match(/^Bearer\s+(.+)$/i) || [])[1] || req.headers["x-gs-key"];
}

// preHandler: read API is reachable via a logged-in session cookie OR any active pairing token.
export async function requireReadAccess(req, reply) {
  const name = verifySession(req.cookies?.gs_session);
  if (name) { req.user = { name, email: `${name}@local` }; return; }
  const rec = validateToken(tokenFrom(req));
  if (rec) { req.user = { name: rec.label, agent: true, scope: rec.scope || "read" }; return; }
  return reply.code(401).send({ error: "unauthorized" });
}

// preHandler: write API needs a session cookie OR a WRITE-scoped pairing token.
export async function requireWriteAccess(req, reply) {
  const name = verifySession(req.cookies?.gs_session);
  if (name) { req.user = { name, email: `${name}@local` }; return; }
  const rec = validateToken(tokenFrom(req));
  if (rec && (rec.scope || "read") === "write") { req.user = { name: rec.label, agent: true, scope: "write" }; return; }
  return reply.code(rec ? 403 : 401).send({ error: rec ? "token is read-only" : "unauthorized" });
}
