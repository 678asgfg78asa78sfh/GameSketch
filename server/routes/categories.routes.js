import { requireWriteAccess } from "../pairing.js";
import { getProject } from "../storage/projects.js";
import { writeCategories } from "../storage/categories.js";
import { recordAction } from "../storage/actions.js";

const guard = { preHandler: requireWriteAccess };

export default async function categoryRoutes(app) {
  app.put("/api/projects/:slug/categories", guard, async (req, reply) => {
    const slug = req.params.slug;
    const next = req.body?.categories;
    if (!Array.isArray(next) || !next.length) return reply.code(400).send({ error: "categories required" });
    const project = await getProject(slug);
    if (!project) return reply.code(404).send({ error: "not found" });

    try {
      const { result, action } = await recordAction(slug, "categories", req.user, () => writeCategories(slug, next, req.user));
      return { categories: result, action };
    } catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });
}
