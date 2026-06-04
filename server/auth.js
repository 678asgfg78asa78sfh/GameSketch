import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { loadConfig } from "./config.js";

export function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const passhash = scryptSync(pw, salt, 64).toString("hex");
  return { salt, passhash };
}

export function verifyPassword(pw, rec) {
  const h = scryptSync(pw, rec.salt, 64);
  const stored = Buffer.from(rec.passhash, "hex");
  return h.length === stored.length && timingSafeEqual(h, stored);
}

function secret() { return loadConfig().session_secret; }

export function signSession(name) {
  const payload = Buffer.from(name).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(cookie) {
  if (!cookie || !cookie.includes(".")) return null;
  const [payload, sig] = cookie.split(".");
  const expect = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, "base64url").toString();
}

// Fastify async preHandler: 401s unauthenticated /api calls, else sets req.user.
export async function requireAuth(req, reply) {
  const name = verifySession(req.cookies?.gs_session);
  if (!name) return reply.code(401).send({ error: "unauthorized" });
  req.user = { name, email: `${name}@local` };
}
