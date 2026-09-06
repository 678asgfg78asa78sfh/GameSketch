import { DEFAULT_CATEGORIES } from "./categories.js";
import { trackingProgress, projectProgress } from "../../shared/tracking.js";

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
  const progress = trackingProgress(n);
  if (n.continued_from) out.push("", `Version ${n.version || 1} · Previous: [[${n.continued_from}]]`);
  if (progress.enabled) {
    out.push("", `Progress: ${progress.percent}%${n.tracking?.completed ? " (manually completed)" : ""}`);
    for (const task of progress.tasks) out.push(`- [${task.done ? "x" : " "}] ${task.kind === "milestone" ? "◆ Milestone: " : ""}${task.title.replace(/[\r\n]+/g, " ")}`);
  }
  if (n.body && n.body.trim()) out.push("", n.body.trim());
  out.push("");
  n.children.forEach((c) => emitNode(c, depth + 1, out));
}

export function flattenToMarkdown(project, nodes) {
  const tree = buildTree(nodes);
  const cats = (project.categories && project.categories.length ? project.categories : DEFAULT_CATEGORIES);
  const out = [`# ${project.title || "Untitled"}`, ""];
  const progress = projectProgress(nodes);
  if (progress.total) out.push(`Overall progress: ${progress.percent}% (${progress.done}/${progress.total} tracked ideas complete)`, "");
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
