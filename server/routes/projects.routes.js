import { requireAuth } from "../auth.js";
import { requireReadAccess } from "../pairing.js";
import { createProject, listProjects, getProject } from "../storage/projects.js";

const guard = { preHandler: requireAuth };           // session only
const readGuard = { preHandler: requireReadAccess }; // session cookie OR agent pairing token

export default async function projectRoutes(app) {
  app.get("/api/projects", readGuard, async () => listProjects());

  app.post("/api/projects", guard, async (req, reply) => {
    const { title } = req.body || {};
    if (!title) return reply.code(400).send({ error: "title required" });
    return createProject({ title }, req.user);
  });

  app.get("/api/projects/:slug", readGuard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return p;
  });
}
