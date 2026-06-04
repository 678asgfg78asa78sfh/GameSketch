import { requireAuth } from "../auth.js";
import { readCanvas, writeCanvas } from "../storage/canvas.js";
import { updateNode, getNode } from "../storage/nodes.js";

const guard = { preHandler: requireAuth };

export default async function canvasRoutes(app) {
  app.get("/api/projects/:slug/canvases/:id", guard, async (req) =>
    readCanvas(req.params.slug, req.params.id));

  app.put("/api/projects/:slug/canvases/:id", guard, async (req) => {
    const { slug, id } = req.params;
    await writeCanvas(slug, id, req.body, req.user);
    const node = await getNode(slug, id);
    if (node && !node.canvas) await updateNode(slug, id, { canvas: `canvases/${id}.excalidraw` }, req.user);
    return { ok: true };
  });
}
