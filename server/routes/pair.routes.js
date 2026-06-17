import { requireAuth } from "../auth.js";
import { createRequest, pollByToken, listRequests, approve, deny, revoke } from "../pairing.js";

const guard = { preHandler: requireAuth };

export default async function pairRoutes(app) {
  // --- agent side (no session needed) ---
  app.post("/api/pair/request", async (req, reply) => {
    const label = (req.body || {}).label;
    if (!label) return reply.code(400).send({ error: "label required" });
    return createRequest(label); // { id, token }
  });

  app.get("/api/pair/poll", async (req, reply) => {
    const auth = req.headers.authorization || "";
    const token = (auth.match(/^Bearer\s+(.+)$/i) || [])[1] || req.headers["x-gs-key"];
    const r = pollByToken(token);
    if (!r) return reply.code(404).send({ error: "unknown token" });
    return r; // { status, expiresAt }
  });

  // --- user side (session) ---
  app.get("/api/pair/agents", guard, async () => ({ agents: listRequests() }));

  app.post("/api/pair/agents/:id/approve", guard, async (req, reply) => {
    const { mode, hours, scope } = req.body || {};
    const r = approve(req.params.id, mode, hours, scope);
    if (!r) return reply.code(404).send({ error: "not found" });
    return r;
  });

  app.post("/api/pair/agents/:id/deny", guard, async (req, reply) => {
    const r = deny(req.params.id);
    if (!r) return reply.code(404).send({ error: "not found" });
    return r;
  });

  app.delete("/api/pair/agents/:id", guard, async (req) => ({ ok: revoke(req.params.id) }));
}
