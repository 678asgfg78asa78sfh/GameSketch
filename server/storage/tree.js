import { DEFAULT_CATEGORIES } from "./categories.js";

export function buildTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = {};
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else (roots[n.pillar] ||= []).push(n);
  }
  const sortRec = (arr) => {
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    arr.forEach((x) => sortRec(x.children));
  };
  Object.values(roots).forEach(sortRec);
  return roots;
}

function emitNode(n, depth, out) {
  const tag = n.kind === "alternative" ? " (Alternative)" : n.kind === "note" ? " (Notiz)" : "";
  out.push(`${"#".repeat(Math.min(depth, 6))} ${n.title} [${n.status}]${tag}`);
  if (n.body && n.body.trim()) out.push("", n.body.trim());
  out.push("");
  n.children.forEach((c) => emitNode(c, depth + 1, out));
}

export function flattenToMarkdown(project, nodes) {
  const tree = buildTree(nodes);
  const cats = (project.categories && project.categories.length ? project.categories : DEFAULT_CATEGORIES);
  const out = [`# ${project.title || "Untitled"}`, ""];
  for (const c of cats) {
    out.push(`## ${c.label}`, "");
    (tree[c.slug] || []).forEach((n) => emitNode(n, 3, out));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function subtreeNodes(nodes, id) {
  const childrenOf = new Map();
  for (const n of nodes) {
    if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
    childrenOf.get(n.parent).push(n);
  }
  const root = nodes.find((n) => n.id === id);
  if (!root) return [];
  const acc = [root];
  const walk = (pid) => (childrenOf.get(pid) || []).forEach((c) => { acc.push(c); walk(c.id); });
  walk(id);
  return acc;
}

export function subtreeToMarkdown(project, nodes, id) {
  const sub = subtreeNodes(nodes, id);
  const tree = buildTree(sub.map((n) => (n.id === id ? { ...n, parent: null } : n)));
  const root = Object.values(tree).flat()[0];
  const out = [`# ${project.title || "Untitled"} — Teilbaum`, ""];
  if (root) emitNode(root, 2, out);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
