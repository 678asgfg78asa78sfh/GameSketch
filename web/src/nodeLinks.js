import { Marked, marked } from "marked";
import { trackingProgress } from "../../shared/tracking.js";

export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const linkPattern = /^\[\[([A-Za-z0-9_-]+)(?:\|([^\]\n]+))?\]\]/;

export function renderMarkdown(text, nodes = []) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const parser = new Marked({ extensions: [{ name: "nodeLink", level: "inline", start: (src) => src.indexOf("[["),
    tokenizer(src) { const m = src.match(linkPattern); if (m) return { type: "nodeLink", raw: m[0], id: m[1], label: m[2] }; },
    renderer(token) {
      const node = byId.get(token.id), label = escapeHtml(token.label || node?.title || token.id);
      return node ? `<a class="node-link" data-node-id="${token.id}" href="#node-${token.id}">${label}</a>`
        : `<span class="missing-link" data-missing-node="${token.id}">${label}</span>`;
    },
  }] });
  return parser.parse(text || "");
}

export function linkedIds(text) {
  const ids = new Set();
  const scan = (tokens) => {
    for (const token of tokens) {
      if (["code", "codespan", "html"].includes(token.type)) continue;
      if (token.tokens) scan(token.tokens);
      else if (token.type === "text") for (const m of (token.text || "").matchAll(/\[\[([A-Za-z0-9_-]+)(?:\|[^\]\n]+)?\]\]/g)) ids.add(m[1]);
      if (token.items) scan(token.items);
      if (token.header) token.header.forEach((cell) => scan(cell.tokens || []));
      if (token.rows) token.rows.flat().forEach((cell) => scan(cell.tokens || []));
    }
  };
  scan(marked.lexer(text || "")); return ids;
}

export function orderedNodes(project) {
  const out = [], seen = new Set();
  const visit = (node, depth) => {
    if (seen.has(node.id)) return;
    seen.add(node.id); out.push({ ...node, depth });
    project.nodes.filter((n) => n.parent === node.id).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((n) => visit(n, depth + 1));
  };
  for (const cat of project.categories) project.nodes.filter((n) => n.pillar === cat.slug && !n.parent).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach((n) => visit(n, 0));
  project.nodes.forEach((n) => visit(n, 0));
  return out;
}

export function searchNodes(nodes, query, { progress = "", status = "" } = {}) {
  const norm = (s) => String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
  const words = norm(query).trim().split(/\s+/).filter(Boolean);
  return nodes.filter((n) => (!progress || trackingProgress(n).status === progress) && (!status || n.status === status)
    && words.every((word) => norm(`${n.title}\n${n.body || ""}\n${(n.tracking?.tasks || []).map((task) => task.title).join("\n")}`).includes(word)))
    .sort((a, b) => Number(words.every((w) => norm(b.title).includes(w))) - Number(words.every((w) => norm(a.title).includes(w))) || (a.order || 0) - (b.order || 0));
}
