import matter from "gray-matter";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../util/slug.js";
import { projectsDir, projectDir, projectMeta, nodesDir } from "./paths.js";
import { ensureRepo, commitAll } from "./git.js";
import { listNodes } from "./nodes.js";

const PILLARS = ["gameloop", "artstyle", "content", "threads", "scope"];

function uniqueSlug(base) {
  let slug = base, i = 2;
  while (existsSync(projectDir(slug))) slug = `${base}-${i++}`;
  return slug;
}

export async function createProject({ title }, author) {
  mkdirSync(projectsDir(), { recursive: true });
  const slug = uniqueSlug(slugify(title));
  const dir = projectDir(slug);
  mkdirSync(dir, { recursive: true });
  for (const p of PILLARS) mkdirSync(nodesDir(slug, p), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "canvases"), { recursive: true });
  const meta = matter.stringify("\n", {
    title, slug, created_by: author.name, created_at: new Date().toISOString(),
    pillars: PILLARS,
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
    .filter((s) => existsSync(projectMeta(s)))
    .map((slug) => {
      const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
      return { slug, title: data.title, created_at: data.created_at };
    });
}

export async function getProject(slug) {
  if (!existsSync(projectMeta(slug))) return null;
  const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
  return { ...data, slug, nodes: await listNodes(slug) };
}
