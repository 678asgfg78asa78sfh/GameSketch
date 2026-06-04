import { requireAuth } from "../auth.js";
import { createNode, updateNode, moveNode, deleteNode, getNode, nodeHistory, restoreNode } from "../storage/nodes.js";

const guard = { preHandler: requireAuth };

export default async function nodeRoutes(app) {
  app.post("/api/projects/:slug/nodes", guard, async (req) =>
    createNode(req.params.slug, req.body || {}, req.user));

  app.patch("/api/projects/:slug/nodes/:id", guard, async (req, reply) => {
    const { id, slug } = req.params;
    const body = req.body || {};
    if (body.parent !== undefined || body.order !== undefined)
      await moveNode(slug, id, { parent: body.parent, order: body.order }, req.user);
    const { parent, order, ...rest } = body;
    const n = Object.keys(rest).length
      ? await updateNode(slug, id, rest, req.user)
      : await getNode(slug, id);
    if (!n) return reply.code(404).send({ error: "not found" });
    return n;
  });

  app.delete("/api/projects/:slug/nodes/:id", guard, async (req) => {
    await deleteNode(req.params.slug, req.params.id, req.user);
    return { ok: true };
  });

  app.get("/api/projects/:slug/nodes/:id/history", guard, async (req) =>
    nodeHistory(req.params.slug, req.params.id));

  app.post("/api/projects/:slug/nodes/:id/restore", guard, async (req) =>
    restoreNode(req.params.slug, req.params.id, req.body.commit, req.user));
}
