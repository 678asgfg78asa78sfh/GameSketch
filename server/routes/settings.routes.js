import { loadConfig, saveConfig } from "../config.js";
import { requireAuth } from "../auth.js";
import { listModels, chat } from "../ai/providers.js";

const guard = { preHandler: requireAuth };

// Never expose the API key to the client — only whether one is set.
function publicAi(ai) {
  return {
    provider: ai.provider,
    openai: { baseUrl: ai.openai.baseUrl, model: ai.openai.model, hasKey: !!ai.openai.apiKey },
    claudeCli: { bin: ai.claudeCli.bin, model: ai.claudeCli.model },
  };
}

// Merge incoming form values into the stored ai config. apiKey rule:
// undefined/null = keep existing, "" = clear, non-empty = set.
function applyAi(ai, body = {}) {
  if (body.provider === "claude-cli" || body.provider === "openai") ai.provider = body.provider;
  if (body.openai) {
    if (typeof body.openai.baseUrl === "string") ai.openai.baseUrl = body.openai.baseUrl;
    if (typeof body.openai.model === "string") ai.openai.model = body.openai.model;
    if (body.openai.apiKey !== undefined && body.openai.apiKey !== null)
      ai.openai.apiKey = body.openai.apiKey;
  }
  if (body.claudeCli) {
    if (typeof body.claudeCli.bin === "string") ai.claudeCli.bin = body.claudeCli.bin || "claude";
    if (typeof body.claudeCli.model === "string") ai.claudeCli.model = body.claudeCli.model;
  }
  return ai;
}

// Build a candidate ai config from posted form values for a model-pull / test, but NEVER
// reuse the stored API key against a *different* endpoint than it was saved for — otherwise
// a request that swaps baseUrl to an attacker host would leak the key. Require the caller to
// re-supply the key whenever they change the endpoint.
function candidateAi(req) {
  const stored = loadConfig().ai;
  const ai = applyAi(loadConfig().ai, req.body?.ai || {});
  if (ai.openai.baseUrl !== stored.openai.baseUrl && !req.body?.ai?.openai?.apiKey) {
    ai.openai.apiKey = "";
  }
  return ai;
}

export default async function settingsRoutes(app) {
  app.get("/api/settings", guard, async () => ({ ai: publicAi(loadConfig().ai) }));

  app.put("/api/settings", guard, async (req) => {
    const cfg = loadConfig();
    cfg.ai = applyAi(cfg.ai, req.body?.ai || {});
    saveConfig(cfg);
    return { ai: publicAi(cfg.ai) };
  });

  // Pull the model list from the provider. Uses the posted (unsaved) form values so the
  // user can load models before saving; falls back to the stored key when none was typed.
  app.post("/api/settings/ai/models", guard, async (req, reply) => {
    const candidate = { ...loadConfig(), ai: candidateAi(req) };
    try {
      return { models: await listModels(candidate) };
    } catch (e) {
      return reply.code(400).send({ error: String(e.message || e) });
    }
  });

  // Quick connectivity check against the (posted, possibly unsaved) provider config.
  app.post("/api/settings/ai/test", guard, async (req, reply) => {
    const candidate = { ...loadConfig(), ai: candidateAi(req) };
    try {
      const { text } = await chat(candidate, {
        system: "You are a connectivity test. Reply with exactly: OK",
        user: "ping",
      });
      return { ok: true, text: (text || "").slice(0, 200) };
    } catch (e) {
      return reply.code(400).send({ ok: false, error: String(e.message || e) });
    }
  });
}
