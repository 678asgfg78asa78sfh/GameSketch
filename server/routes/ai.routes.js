import { requireAuth } from "../auth.js";
import { requireReadAccess } from "../pairing.js";
import { getProject } from "../storage/projects.js";
import { flattenToMarkdown, subtreeToMarkdown, subtreeNodes, buildTree } from "../storage/tree.js";
import { assist } from "../ai/assist.js";
import { findGaps, propose, applyActions } from "../ai/agent.js";

const guard = { preHandler: requireAuth };       // session only (UI assist)
const readGuard = { preHandler: requireReadAccess }; // session cookie OR agent pairing token

export default async function aiRoutes(app) {
  app.get("/api/projects/:slug/export.json", readGuard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return { title: p.title, slug: p.slug, tree: buildTree(p.nodes) };
  });

  app.get("/api/projects/:slug/export.md", readGuard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return reply.type("text/markdown; charset=utf-8").send(flattenToMarkdown(p, p.nodes));
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.json", readGuard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return { nodes: subtreeNodes(p.nodes, req.params.id) };
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.md", readGuard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return reply.type("text/markdown; charset=utf-8").send(subtreeToMarkdown(p, p.nodes, req.params.id));
  });

  app.post("/api/projects/:slug/assist", guard, async (req, reply) => {
    try { return await assist(req.params.slug, req.body || {}); }
    catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });

  // Interactive assist: find gaps -> propose changes -> apply on approval.
  app.post("/api/projects/:slug/assist/gaps", guard, async (req, reply) => {
    try { return { gaps: await findGaps(req.params.slug, { nodeId: req.body?.nodeId, lang: req.body?.lang }) }; }
    catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });

  app.post("/api/projects/:slug/assist/propose", guard, async (req, reply) => {
    try {
      return await propose(req.params.slug, {
        nodeId: req.body?.nodeId, items: req.body?.items, note: req.body?.note, lang: req.body?.lang,
      });
    } catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });

  app.post("/api/projects/:slug/assist/apply", guard, async (req, reply) => {
    try { return { applied: await applyActions(req.params.slug, req.body?.actions || [], req.user) }; }
    catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });
}
