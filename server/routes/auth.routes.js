import { loadConfig, saveConfig } from "../config.js";
import { hashPassword, verifyPassword, signSession, requireAuth } from "../auth.js";

export default async function authRoutes(app) {
  app.get("/api/auth/needs-setup", async () => ({ needsSetup: loadConfig().users.length === 0 }));

  app.post("/api/auth/setup", async (req, reply) => {
    const cfg = loadConfig();
    if (cfg.users.length > 0) return reply.code(409).send({ error: "already set up" });
    const { name, password } = req.body || {};
    if (!name || !password) return reply.code(400).send({ error: "name+password required" });
    cfg.users.push({ name, ...hashPassword(password) });
    saveConfig(cfg);
    return { ok: true };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { name, password } = req.body || {};
    const user = loadConfig().users.find((u) => u.name === name);
    if (!user || !verifyPassword(password, user))
      return reply.code(401).send({ error: "bad credentials" });
    reply.setCookie("gs_session", signSession(name), { httpOnly: true, sameSite: "lax", path: "/" });
    return { ok: true, name };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    reply.clearCookie("gs_session", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => ({ name: req.user.name }));
}
