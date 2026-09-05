import matter from "gray-matter";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../util/slug.js";
import { projectsDir, projectDir, projectMeta, nodesDir } from "./paths.js";
import { ensureRepo, commitAll } from "./git.js";
import { listNodes } from "./nodes.js";
import { DEFAULT_CATEGORIES, categoriesFromMeta } from "./categories.js";
import { projectWrite } from "./lock.js";
import { problem } from "./files.js";

const PILLARS = DEFAULT_CATEGORIES.map((c) => c.slug);

export function uniqueSlug(base) {
  base = base.slice(0, 180);
  let slug = base, i = 2;
  while (existsSync(projectDir(slug))) slug = `${base}-${i++}`;
  return slug;
}

export async function createProject({ title }, author) {
  if (typeof title !== "string" || !title.trim()) throw problem("TITLE_REQUIRED");
  title = title.trim().slice(0, 200);
  mkdirSync(projectsDir(), { recursive: true });
  const slug = uniqueSlug(slugify(title));
  const dir = projectDir(slug);
  mkdirSync(dir, { recursive: true });
  for (const p of PILLARS) mkdirSync(nodesDir(slug, p), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "canvases"), { recursive: true });
  const meta = matter.stringify("\n", {
    title, slug, created_by: author.name, created_at: new Date().toISOString(),
    categories: DEFAULT_CATEGORIES,
  });
  writeFileSync(projectMeta(slug), meta);
  for (const p of PILLARS) writeFileSync(join(nodesDir(slug, p), ".gitkeep"), "");
  await ensureRepo(dir);
  await commitAll(dir, { ...author, message: `project: create "${title}"` });
  return { slug, title };
}

export async function listProjects() {
  const base = projectsDir();
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((s) => /^[a-z0-9][a-z0-9-]{0,199}$/.test(s) && existsSync(projectMeta(s)))
    .map((slug) => {
      const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
      return { slug, title: data.title, created_at: data.created_at, archived: !!data.archived };
    });
}

export const getProject = projectWrite(async (slug) => {
  if (!existsSync(projectMeta(slug))) return null;
  const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
  return { ...data, slug, categories: categoriesFromMeta(data), nodes: await listNodes(slug) };
});

export const updateProject = projectWrite(async (slug, patch, author) => {
  if (!existsSync(projectMeta(slug))) throw problem("PROJECT_NOT_FOUND", 404);
  const raw = matter(readFileSync(projectMeta(slug), "utf8"));
  const data = { ...raw.data };
  if (patch.title !== undefined) {
    if (typeof patch.title !== "string" || !patch.title.trim()) throw problem("TITLE_REQUIRED");
    data.title = patch.title.trim().slice(0, 200);
  }
  if (typeof patch.archived === "boolean") data.archived = patch.archived;
  writeFileSync(projectMeta(slug), matter.stringify(raw.content, data));
  await commitAll(projectDir(slug), { ...author, message: `project: update "${data.title}"` });
  return getProject(slug);
});
