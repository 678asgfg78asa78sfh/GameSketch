import { requireAuth } from "../auth.js";
import { readCanvas, writeCanvas } from "../storage/canvas.js";
import { updateNode, getNode } from "../storage/nodes.js";
import { withWriteLock } from "../storage/lock.js";
import { projectDir } from "../storage/paths.js";

const guard = { preHandler: requireAuth };

export default async function canvasRoutes(app) {
  app.get("/api/projects/:slug/canvases/:id", guard, async (req) =>
    readCanvas(req.params.slug, req.params.id));

  // Embedded canvas images are base64 JSON and routinely exceed Fastify's 1 MB default.
  app.put("/api/projects/:slug/canvases/:id", { ...guard, bodyLimit: 50 * 1024 * 1024 }, async (req, reply) => {
    const { slug, id } = req.params;
    return withWriteLock(projectDir(slug), async () => {
      const node = await getNode(slug, id);
      if (!node) return reply.code(404).send({ error: "not found" });
      await writeCanvas(slug, id, req.body, req.user);
      if (!node.canvas) await updateNode(slug, id, { canvas: `canvases/${id}.excalidraw` }, req.user);
      return { ok: true };
    });
  });
}
