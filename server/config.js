import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { configPath, dataDir } from "./storage/paths.js";

function defaultAi() {
  return {
    provider: "claude-cli", // "claude-cli" (local `claude -p`) | "openai" (OpenRouter & compatible)
    openai: { baseUrl: "https://openrouter.ai/api/v1", apiKey: "", model: "" },
    claudeCli: { bin: "claude", model: "" },
  };
}

// Accept the new provider shape and migrate the legacy { baseUrl, model, apiKey } block.
function normalizeAi(ai = {}) {
  const base = defaultAi();
  if (ai.provider === "claude-cli" || ai.provider === "openai") {
    return {
      provider: ai.provider,
      openai: { ...base.openai, ...(ai.openai || {}) },
      claudeCli: { ...base.claudeCli, ...(ai.claudeCli || {}) },
    };
  }
  // legacy single-endpoint config
  if (ai.baseUrl || ai.model || ai.apiKey) {
    return {
      provider: "openai",
      openai: { baseUrl: ai.baseUrl || "", apiKey: ai.apiKey || "", model: ai.model || "" },
      claudeCli: { ...base.claudeCli },
    };
  }
  return base;
}

function defaults() {
  return {
    users: [],
    session_secret: randomBytes(32).toString("hex"),
    ai: defaultAi(),
    agentTokens: [],
    templates: {},
  };
}

export function loadConfig() {
  if (!existsSync(configPath())) {
    mkdirSync(dataDir(), { recursive: true });
    const c = defaults();
    writeFileSync(configPath(), JSON.stringify(c, null, 2));
    return c;
  }
  const raw = JSON.parse(readFileSync(configPath(), "utf8"));
  return { ...defaults(), ...raw, ai: normalizeAi(raw.ai) };
}

export function saveConfig(c) {
  mkdirSync(dirname(configPath()), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(c, null, 2));
}
