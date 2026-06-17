import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

// Fallback model list for the Claude CLI (it has no HTTP "list models" call).
export const KNOWN_CLAUDE_MODELS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-fable-5",
];

// --- single-turn (used by the per-node assist buttons) ------------------------
export async function chat(cfg, { system, user }) {
  const ai = cfg.ai;
  if (ai.provider === "claude-cli") return runClaudeCli(ai.claudeCli, system ? `${system}\n\n${user}` : user);
  return chatOpenAi(ai.openai, [{ role: "system", content: system }, { role: "user", content: user }]);
}

// --- multi-turn (used by the global copilot chat) -----------------------------
export async function converse(cfg, { system, messages }) {
  const ai = cfg.ai;
  if (ai.provider === "claude-cli") {
    const convo = messages.map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.content}`).join("\n\n");
    return runClaudeCli(ai.claudeCli, `${system}\n\n${convo}\n\nAssistant:`);
  }
  return chatOpenAi(ai.openai, [{ role: "system", content: system }, ...messages]);
}

function chatOpenAi(o, messages) {
  if (!o?.baseUrl) throw new Error("No AI endpoint configured (settings → AI).");
  return fetch(`${o.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}),
    },
    body: JSON.stringify({ model: o.model || "gpt-3.5-turbo", messages, stream: false }),
  }).then(async (res) => {
    if (!res.ok) throw new Error(`AI endpoint error ${res.status}`);
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content ?? "" };
  });
}

// Shell out to the local Claude Code CLI: `claude -p [--model X]`, prompt via stdin.
// No shell is used (spawn with an args array) so the prompt cannot be interpreted.
function runClaudeCli(c, input) {
  const bin = c?.bin || "claude";
  const args = ["-p", ...(c?.model ? ["--model", c.model] : [])];
  return new Promise((resolve, reject) => {
    let child;
    try {
      // Run in a neutral cwd (NOT the app's code repo): otherwise the Claude CLI loads
      // Claude Code's project context, gets "meta-aware", and may refuse the plain
      // text-completion role instead of returning our JSON action protocol.
      child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"], cwd: tmpdir() });
    } catch (e) {
      return reject(new Error(`Cannot start "${bin}": ${e.message}`));
    }
    let out = "", err = "";
    child.on("error", (e) =>
      reject(new Error(e.code === "ENOENT" ? `Claude CLI "${bin}" not found in PATH.` : e.message)));
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => {
      if (code === 0) resolve({ text: out.trim() });
      else reject(new Error(`Claude CLI exited ${code}: ${(err || out).trim()}`));
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

// List available models for the model-picker dropdown.
export async function listModels(cfg) {
  const ai = cfg.ai;
  if (ai.provider === "claude-cli") return [...KNOWN_CLAUDE_MODELS];
  const o = ai.openai;
  if (!o?.baseUrl) throw new Error("No AI endpoint configured.");
  const res = await fetch(`${o.baseUrl.replace(/\/$/, "")}/models`, {
    headers: { ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}) },
  });
  if (!res.ok) throw new Error(`Model list error ${res.status}`);
  const data = await res.json();
  const ids = (data.data || data.models || [])
    .map((m) => (typeof m === "string" ? m : m.id || m.name))
    .filter(Boolean);
  return [...new Set(ids)].sort();
}
