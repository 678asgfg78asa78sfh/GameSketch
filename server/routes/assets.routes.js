import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { requireAuth } from "../auth.js";
import { assetsDir, projectDir } from "../storage/paths.js";
import { saveAsset } from "../storage/assets.js";
import { updateNode, getNode } from "../storage/nodes.js";
import { withWriteLock } from "../storage/lock.js";

const guard = { preHandler: requireAuth };
const MIME = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
};

export default async function assetRoutes(app) {
  app.post("/api/projects/:slug/nodes/:id/attachments", guard, async (req, reply) => {
    const { slug, id } = req.params;
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "no file" });
    const buffer = await file.toBuffer();
    return withWriteLock(projectDir(slug), async () => {
      const node = await getNode(slug, id);
      if (!node) return reply.code(404).send({ error: "not found" });
      const rel = await saveAsset(slug, id, { filename: file.filename, buffer }, req.user);
      await updateNode(slug, id, { attachments: [...new Set([...(node.attachments || []), rel])] }, req.user);
      return { path: rel };
    });
  });

  app.get("/api/projects/:slug/assets/:name", guard, async (req, reply) => {
    const { slug, name } = req.params;
    if (name.includes("..") || name.includes("/") || name.includes("\\"))
      return reply.code(400).send({ error: "bad name" });
    const file = join(assetsDir(slug), name);
    if (!existsSync(file)) return reply.code(404).send({ error: "not found" });
    reply.type(MIME[extname(name).toLowerCase()] || "application/octet-stream");
    return reply.send(readFileSync(file));
  });
}
