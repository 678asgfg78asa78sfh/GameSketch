import { requireAuth } from "../auth.js";
import { getProject } from "../storage/projects.js";
import { flattenToMarkdown, subtreeToMarkdown, subtreeNodes, buildTree } from "../storage/tree.js";
import { assist } from "../ai/assist.js";

const guard = { preHandler: requireAuth };

export default async function aiRoutes(app) {
  app.get("/api/projects/:slug/export.json", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return { title: p.title, slug: p.slug, tree: buildTree(p.nodes) };
  });

  app.get("/api/projects/:slug/export.md", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return reply.type("text/markdown; charset=utf-8").send(flattenToMarkdown(p, p.nodes));
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.json", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return { nodes: subtreeNodes(p.nodes, req.params.id) };
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.md", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return reply.type("text/markdown; charset=utf-8").send(subtreeToMarkdown(p, p.nodes, req.params.id));
  });

  app.post("/api/projects/:slug/assist", guard, async (req, reply) => {
    try { return await assist(req.params.slug, req.body || {}); }
    catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });
}
