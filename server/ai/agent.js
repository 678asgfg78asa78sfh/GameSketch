import { loadConfig } from "../config.js";
import { getProject } from "../storage/projects.js";
import { createNode, updateNode } from "../storage/nodes.js";
import { readCategories, DEFAULT_CATEGORIES } from "../storage/categories.js";
import { converse } from "./providers.js";
import { prepareProposal } from "./proposals.js";

const STATUS = ["core", "side", "future"];
const KIND = ["idea", "alternative", "note"];
const LANG_NAME = { en: "English", de: "German (Deutsch)", ru: "Russian (Русский)" };

// A compact, id-annotated view of the design so the model can reference/update nodes.
export function buildContext(project, nodeId) {
  const cats = project.categories?.length ? project.categories : DEFAULT_CATEGORIES;
  const byPillar = {};
  for (const n of project.nodes) (byPillar[n.pillar] ||= []).push(n);
  const current = nodeId ? project.nodes.find((n) => n.id === nodeId) : null;
  const lines = [`Project: "${project.title}" (slug: ${project.slug})`, ""];

  // Put the node the user currently has OPEN front-and-centre, with its FULL body — this is the
  // "canvas" they're working on right now. Everything else is background context.
  if (current) {
    const catLabel = cats.find((c) => c.slug === current.pillar)?.label || current.pillar;
    lines.push(
      "### CURRENTLY OPEN NODE (the user is editing this right now — focus here unless told otherwise):",
      `id=${current.id} · category=${current.pillar} (${catLabel}) · status=${current.status} · kind=${current.kind}`,
      `Title: ${current.title}`,
      "Body:",
      current.body && current.body.trim() ? current.body.trim() : "(empty)",
      "",
      "### Rest of the project (for context):",
      ""
    );
  }

  for (const c of cats) {
    const ns = (byPillar[c.slug] || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    lines.push(`## ${c.slug} — ${c.label} (${ns.length})`);
    for (const n of ns) {
      const here = n.id === nodeId ? "  <-- USER IS HERE" : "";
      lines.push(`- id=${n.id} parent=${n.parent || "none"} status=${n.status} kind=${n.kind} "${n.title}"${here}`);
      if (n.body && n.body.trim()) lines.push("    " + n.body.trim().replace(/\n/g, "\n    ").slice(0, 400));
    }
    lines.push("");
  }
  let ctx = lines.join("\n");
  if (ctx.length > 12000) ctx = ctx.slice(0, 12000) + "\n…(truncated)";
  return ctx;
}

function systemPrompt(L, context, nodeId, catSlugs) {
  const cats = catSlugs && catSlugs.length ? catSlugs : DEFAULT_CATEGORIES.map((c) => c.slug);
  const en = cats.join("|");
  return [
    "You are GameSketch Copilot, an assistant embedded in a local game-design tool.",
    "The user designs games as a tree of idea-nodes grouped into these categories",
    `(use ONLY these as \"pillar\"): ${cats.join(", ")}.`,
    "Propose concrete design changes by emitting actions. The user reviews and applies them separately.",
    "The context may contain excerpts; do not claim to have reviewed omitted content or say changes are already saved.",
    "",
    "Respond with a SINGLE JSON object and NOTHING else, in exactly this shape:",
    '{"reply": "<short message to the user>", "actions": [ <zero or more actions> ]}',
    "",
    "Action objects:",
    `- {"type":"create_node","pillar":"${en}","parent":<existing node id or null>,"title":"<short title>","body":"<markdown details>","status":"core|side|future","kind":"idea|alternative|note"}`,
    '- {"type":"update_node","id":"<existing node id>","title":"<optional>","body":"<optional markdown>","status":"core|side|future (optional)"}',
    "",
    "Rules:",
    `- Write "reply" (and node text) in ${L}.`,
    "- If the user asks you to add/write/change design content, DO IT via actions.",
    "- If you need clarification, return \"actions\": [] and ask your question in \"reply\".",
    "- Put the real design content in node bodies; keep \"reply\" short.",
    "- Only use node ids that appear in the context. For new top-level ideas use parent: null.",
    nodeId ? "- The user is currently viewing the node marked USER IS HERE; prefer it as the parent/target unless told otherwise." : "",
    "",
    "Current design context:",
    context,
  ].filter(Boolean).join("\n");
}

// Extract the first balanced JSON object from text (tolerates surrounding prose / fences).
export function extractJsonObject(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

export function parseReply(text) {
  const raw = extractJsonObject(text);
  if (raw) {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object")
        return {
          reply: typeof obj.reply === "string" ? obj.reply : "",
          actions: Array.isArray(obj.actions) ? obj.actions : [],
        };
    } catch { /* not valid JSON — treat whole text as the reply */ }
  }
  return { reply: (text || "").trim(), actions: [] };
}

export async function applyActions(slug, actions, author) {
  const cats = readCategories(slug).map((c) => c.slug);
  const fallback = cats[0] || "gameloop";
  const out = [];
  for (const a of actions) {
    if (!a || typeof a !== "object") continue;
    try {
      if (a.type === "create_node") {
        const n = await createNode(slug, {
          pillar: cats.includes(a.pillar) ? a.pillar : fallback,
          parent: a.parent || null,
          title: String(a.title || "Untitled").slice(0, 200),
          body: typeof a.body === "string" ? a.body : "",
          status: STATUS.includes(a.status) ? a.status : "core",
          kind: KIND.includes(a.kind) ? a.kind : "idea",
        }, author);
        out.push({ type: "create", id: n.id, title: n.title, pillar: n.pillar });
      } else if (a.type === "update_node" && a.id) {
        const patch = {};
        if (typeof a.title === "string") patch.title = a.title.slice(0, 200);
        if (typeof a.body === "string") patch.body = a.body;
        if (STATUS.includes(a.status)) patch.status = a.status;
        if (Object.keys(patch).length) {
          const n = await updateNode(slug, a.id, patch, author);
          out.push({ type: "update", id: n.id, title: n.title });
        }
      }
    } catch (e) {
      out.push({ type: "error", error: String(e.message || e), action: a.type });
    }
  }
  return out;
}

// Interactive assist step 1: return gaps as a structured list (for checkboxes), not prose.
export async function findGaps(slug, { nodeId, lang }) {
  const project = await getProject(slug);
  if (!project) throw new Error("project not found");
  const L = LANG_NAME[lang] || LANG_NAME.en;
  const context = buildContext(project, nodeId);
  const system = [
    "You are a sharp game-design reviewer. Find concrete gaps, contradictions and open questions.",
    `Return ONLY a JSON object: {"gaps":["<one short, specific gap>", ...]} with 3-8 items, in ${L}.`,
    nodeId ? "Focus on the node marked USER IS HERE and its surroundings." : "",
    "",
    "Design:",
    context,
  ].filter(Boolean).join("\n");
  const { text } = await converse(loadConfig(), { system, messages: [{ role: "user", content: "List the gaps." }] });
  let gaps = [];
  try { const o = JSON.parse(extractJsonObject(text) || "{}"); if (Array.isArray(o.gaps)) gaps = o.gaps; } catch { /* none */ }
  return gaps
    .map((g, i) => ({ id: String(i), text: typeof g === "string" ? g : (g.text || "") }))
    .filter((g) => g.text.trim());
}

// Interactive assist step 2: propose concrete actions for the selected gaps — NOT applied.
export async function propose(slug, { nodeId, items, note, lang }, author) {
  const project = await getProject(slug);
  if (!project) throw new Error("project not found");
  const L = LANG_NAME[lang] || LANG_NAME.en;
  const context = buildContext(project, nodeId);
  const userMsg = [
    "Address these gaps in the design:",
    (items || []).map((t, i) => `${i + 1}. ${t}`).join("\n") || "(none specified)",
    note ? `\nExtra instructions from the user: ${note}` : "",
    "\nPropose the concrete changes as create_node/update_node actions.",
  ].join("\n");
  const system = systemPrompt(L, context, nodeId, project.categories?.map((c) => c.slug));
  const { text } = await converse(loadConfig(), { system, messages: [{ role: "user", content: userMsg }] });
  const parsed = parseReply(text);
  return { ...parsed, proposal: author ? prepareProposal(project, parsed.actions, author) : null };
}

// One copilot turn proposes changes. Applying is a separate, idempotent operation.
export async function chatTurn(slug, { messages, nodeId, lang }, author) {
  const project = slug ? await getProject(slug) : null;
  const L = LANG_NAME[lang] || LANG_NAME.en;
  const context = project ? buildContext(project, nodeId) : "(no project open — you cannot change anything yet)";
  const system = systemPrompt(L, context, project ? nodeId : null, project?.categories?.map((c) => c.slug));
  const { text } = await converse(loadConfig(), { system, messages });
  const { reply, actions } = parseReply(text);
  const proposal = project && actions.length ? prepareProposal(project, actions, author) : null;
  return { text: reply || text, proposal, applied: [], changed: false,
    context: project ? { total: project.nodes.length,
      included: project.nodes.filter((n) => context.includes(`id=${n.id}`)).length,
      excerpts: context.includes("…(truncated)") || project.nodes.some((n) => n.id !== nodeId && (n.body || "").length > 400) } : null };
}
