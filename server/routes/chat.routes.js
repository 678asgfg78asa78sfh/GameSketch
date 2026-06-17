import { requireAuth } from "../auth.js";
import { chatTurn } from "../ai/agent.js";

export default async function chatRoutes(app) {
  // Global copilot chat. Session-authenticated (it runs in the logged-in browser).
  app.post("/api/chat", { preHandler: requireAuth }, async (req, reply) => {
    const { messages, slug, nodeId, lang } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0)
      return reply.code(400).send({ error: "messages required" });
    const trimmed = messages.slice(-16).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    }));
    try {
      return await chatTurn(slug || null, { messages: trimmed, nodeId: nodeId || null, lang }, req.user);
    } catch (e) {
      return reply.code(400).send({ error: String(e.message || e) });
    }
  });
}
