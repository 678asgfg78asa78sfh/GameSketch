import { requireWriteAccess } from "../pairing.js";
import { createNode, updateNode, deleteNode, nodeHistory, restoreNode, updateTracking, continueNode } from "../storage/nodes.js";
import { recordAction } from "../storage/actions.js";

// Writes allow a logged-in user OR a WRITE-scoped agent token (so external agents can edit too).
const guard = { preHandler: requireWriteAccess };

export default async function nodeRoutes(app) {
  app.post("/api/projects/:slug/nodes/:id/tracking", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "tracking", req.user,
      () => updateTracking(req.params.slug, req.params.id, req.body, req.user));
    return { ...result, action };
  });
  app.post("/api/projects/:slug/nodes/:id/continue", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "continue", req.user,
      () => continueNode(req.params.slug, req.params.id, req.body, req.user));
    return { ...result, action };
  });
  app.post("/api/projects/:slug/nodes", guard, async (req, reply) => {
    try {
      const { result, action } = await recordAction(req.params.slug, "create", req.user,
        () => createNode(req.params.slug, req.body || {}, req.user));
      return { ...result, action };
    }
    catch (e) {
      if (/^(bad category:|parent not found)/.test(e.message))
        return reply.code(400).send({ error: e.message });
      throw e;
    }
  });

  app.patch("/api/projects/:slug/nodes/:id", guard, async (req, reply) => {
    const { id, slug } = req.params;
    const body = req.body || {};
    try {
      if (body.parent !== undefined || body.order !== undefined || body.pillar !== undefined) {
        const { result, action } = await recordAction(slug, "move", req.user, () => updateNode(slug, id, body, req.user));
        return { ...result, action };
      }
      return await updateNode(slug, id, body, req.user);
    }
    catch (e) {
      if (e.message === "node not found") return reply.code(404).send({ error: "not found" });
      if (/^(cannot move|parent not found|bad category:)/.test(e.message))
        return reply.code(400).send({ error: e.message });
      throw e;
    }
  });

  app.delete("/api/projects/:slug/nodes/:id", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "trash", req.user,
      () => deleteNode(req.params.slug, req.params.id, req.user));
    return { ok: true, trash: result, action };
  });

  app.get("/api/projects/:slug/nodes/:id/history", guard, async (req) =>
    nodeHistory(req.params.slug, req.params.id));

  app.post("/api/projects/:slug/nodes/:id/restore", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "revision", req.user,
      () => restoreNode(req.params.slug, req.params.id, req.body.commit, req.user));
    return { ...result, action };
  });
}
