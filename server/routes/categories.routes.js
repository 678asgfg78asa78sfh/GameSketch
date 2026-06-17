import { requireWriteAccess } from "../pairing.js";
import { getProject } from "../storage/projects.js";
import { writeCategories } from "../storage/categories.js";

const guard = { preHandler: requireWriteAccess };

export default async function categoryRoutes(app) {
  app.put("/api/projects/:slug/categories", guard, async (req, reply) => {
    const slug = req.params.slug;
    const next = req.body?.categories;
    if (!Array.isArray(next) || !next.length) return reply.code(400).send({ error: "categories required" });
    const project = await getProject(slug);
    if (!project) return reply.code(404).send({ error: "not found" });

    // Don't silently orphan nodes: refuse to drop a category that still holds nodes.
    const keep = new Set(next.map((c) => c.slug));
    const used = new Set(project.nodes.map((n) => n.pillar));
    const removedWithNodes = [...used].filter((s) => !keep.has(s));
    if (removedWithNodes.length)
      return reply.code(400).send({ error: `category not empty: ${removedWithNodes.join(", ")}` });

    try {
      return { categories: writeCategories(slug, next, req.user) };
    } catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });
}
