import { requireAuth } from "../auth.js";
import { getProject, updateProject } from "../storage/projects.js";
import { listTrash, restoreTrash, duplicateNode, getNode, updateNode } from "../storage/nodes.js";
import { recordAction, listActions, undoAction } from "../storage/actions.js";
import { exportBackup, importBackup, duplicateProject } from "../storage/backups.js";
import { problem } from "../storage/files.js";

const guard = { preHandler: requireAuth };

export default async function workspaceRoutes(app) {
  app.post("/api/projects/:slug/nodes/:id/attachments/remove", guard, async (req) => {
    const { slug, id } = req.params;
    const { result, action } = await recordAction(slug, "attachment", req.user, async () => {
      const node = await getNode(slug, id);
      if (!node) throw problem("NODE_NOT_FOUND", 404);
      return updateNode(slug, id, { attachments: (node.attachments || []).filter((p) => p !== req.body?.path) }, req.user);
    });
    return { ...result, action };
  });
  app.patch("/api/projects/:slug", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "project", req.user,
      () => updateProject(req.params.slug, req.body || {}, req.user));
    return { ...result, action };
  });
  app.get("/api/projects/:slug/trash", guard, async (req) => listTrash(req.params.slug));
  app.post("/api/projects/:slug/trash/:id/restore", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "restore", req.user,
      () => restoreTrash(req.params.slug, req.params.id, req.user));
    return { ...result, action };
  });
  app.get("/api/projects/:slug/activity", guard, async (req) => listActions(req.params.slug));
  app.post("/api/projects/:slug/activity/:id/undo", guard, async (req) => undoAction(req.params.slug, req.params.id, req.user));
  app.post("/api/projects/:slug/nodes/:id/duplicate", guard, async (req) => {
    const { result, action } = await recordAction(req.params.slug, "duplicate", req.user,
      () => duplicateNode(req.params.slug, req.params.id, req.body?.title, req.user));
    return { ...result, action };
  });
  app.get("/api/projects/:slug/backup", guard, async (req, reply) => {
    const data = await exportBackup(req.params.slug);
    return reply.type("application/gzip").header("Content-Disposition", `attachment; filename="${req.params.slug}.gamesketch"`).send(data);
  });
  app.post("/api/backups/import", guard, async (req) => {
    const file = await req.file({ limits: { fileSize: 100 * 1024 * 1024 } });
    if (!file) throw problem("INVALID_BACKUP");
    return importBackup(await file.toBuffer(), req.user);
  });
  app.post("/api/projects/:slug/duplicate", guard, async (req) => {
    const p = await getProject(req.params.slug);
    if (!p) throw problem("PROJECT_NOT_FOUND", 404);
    return duplicateProject(req.params.slug, req.body?.title || `${p.title} (copy)`, req.user);
  });
}
