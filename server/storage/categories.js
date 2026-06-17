import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { projectMeta, projectDir } from "./paths.js";
import { commitAll } from "./git.js";

// The 5 built-in pillars are just the DEFAULT template now — projects can add/rename/recolor/remove.
export const DEFAULT_CATEGORIES = [
  { slug: "gameloop", label: "Gameloop", color: "#ff6b5e" },
  { slug: "artstyle", label: "Art style", color: "#ffc24b" },
  { slug: "content", label: "Content", color: "#2ee6a8" },
  { slug: "threads", label: "Threads", color: "#a78bfa" },
  { slug: "scope", label: "Scope", color: "#41d3ff" },
];
const DEFAULT_BY_SLUG = Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.slug, c]));
const FALLBACK_COLORS = ["#ff6b5e", "#ffc24b", "#2ee6a8", "#a78bfa", "#41d3ff", "#7c8cff", "#ff6b9d", "#41d3ff"];

export function isCategorySlug(s) {
  return typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s);
}

function normalize(c, i = 0) {
  if (!c || !isCategorySlug(c.slug)) return null;
  return {
    slug: c.slug,
    label: String(c.label || c.slug).slice(0, 60),
    color: /^#[0-9a-fA-F]{3,8}$/.test(c.color || "") ? c.color : FALLBACK_COLORS[i % FALLBACK_COLORS.length],
  };
}

// Derive the category list from project frontmatter (back-compat: old `pillars` = slug array).
export function categoriesFromMeta(data) {
  if (Array.isArray(data?.categories) && data.categories.length) {
    const out = data.categories.map(normalize).filter(Boolean);
    if (out.length) return out;
  }
  if (Array.isArray(data?.pillars) && data.pillars.length) {
    return data.pillars.map((slug, i) => DEFAULT_BY_SLUG[slug] || normalize({ slug, label: slug }, i));
  }
  return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
}

export function readCategories(slug) {
  if (!existsSync(projectMeta(slug))) return DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  return categoriesFromMeta(matter(readFileSync(projectMeta(slug), "utf8")).data);
}

// Validate + persist a new category list into project.md. Returns the normalized list.
export function writeCategories(slug, categories, author) {
  const raw = matter(readFileSync(projectMeta(slug), "utf8"));
  const next = (Array.isArray(categories) ? categories : []).map(normalize).filter(Boolean);
  if (!next.length) throw new Error("at least one category is required");
  const seen = new Set();
  for (const c of next) {
    if (seen.has(c.slug)) throw new Error(`duplicate category: ${c.slug}`);
    seen.add(c.slug);
  }
  const data = { ...raw.data, categories: next };
  delete data.pillars; // superseded by categories
  writeFileSync(projectMeta(slug), matter.stringify(raw.content, data));
  if (author) commitAll(projectDir(slug), { ...author, message: "project: edit categories" });
  return next;
}
