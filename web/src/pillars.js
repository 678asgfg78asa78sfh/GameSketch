// Default category template (mirrors the backend DEFAULT_CATEGORIES). Categories are per-project
// now; this is the fallback + the decorative legend on the projects list.
export const DEFAULT_CATEGORIES = [
  { slug: "gameloop", label: "Gameloop", color: "#ff6b5e" },
  { slug: "artstyle", label: "Art style", color: "#ffc24b" },
  { slug: "content", label: "Content", color: "#2ee6a8" },
  { slug: "threads", label: "Threads", color: "#a78bfa" },
  { slug: "scope", label: "Scope", color: "#41d3ff" },
];

// Suggested palette for new custom categories.
export const CATEGORY_COLORS = [
  "#ff6b5e", "#ffc24b", "#2ee6a8", "#a78bfa", "#41d3ff",
  "#7c8cff", "#ff6b9d", "#f97316", "#22d3ee", "#a3e635",
];

export function slugifyCategory(label) {
  const base = String(label).toLowerCase()
    .replace(/[äöü]/g, (c) => ({ "ä": "ae", "ö": "oe", "ü": "ue" }[c]))
    .replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return (base || "cat").slice(0, 40);
}
