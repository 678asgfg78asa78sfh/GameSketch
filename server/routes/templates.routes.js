import { requireAuth } from "../auth.js";
import { loadConfig, saveConfig } from "../config.js";
import { DEFAULT_CATEGORIES } from "../storage/categories.js";

const guard = { preHandler: requireAuth };
const BUILTIN = { name: "Default (5 pillars)", builtin: true, categories: DEFAULT_CATEGORIES };

// Category templates are global presets you can apply to any project.
export default async function templateRoutes(app) {
  app.get("/api/templates", guard, async () => {
    const saved = loadConfig().templates || {};
    return { templates: [BUILTIN, ...Object.entries(saved).map(([name, categories]) => ({ name, categories }))] };
  });

  app.post("/api/templates", guard, async (req, reply) => {
    const { name, categories } = req.body || {};
    if (!name || !Array.isArray(categories) || !categories.length)
      return reply.code(400).send({ error: "name + categories required" });
    const cfg = loadConfig();
    cfg.templates = { ...(cfg.templates || {}), [String(name).slice(0, 60)]: categories };
    saveConfig(cfg);
    return { ok: true };
  });

  app.delete("/api/templates/:name", guard, async (req) => {
    const cfg = loadConfig();
    if (cfg.templates) { delete cfg.templates[req.params.name]; saveConfig(cfg); }
    return { ok: true };
  });
}
