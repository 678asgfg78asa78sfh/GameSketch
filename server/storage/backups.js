import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, rmdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep, basename } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import matter from "gray-matter";
import { projectDir, projectsDir, projectMeta } from "./paths.js";
import { projectWrite } from "./lock.js";
import { snapshot, projectFile, writeSnapshotFile, problem } from "./files.js";
import { ensureRepo, commitAll, exportGitBundle, importGitBundle } from "./git.js";
import { uniqueSlug, getProject } from "./projects.js";
import { slugify } from "../util/slug.js";
import { validateTracking } from "./tracking.js";

export const exportBackup = projectWrite(async (slug) => {
  if (!existsSync(projectMeta(slug))) throw problem("PROJECT_NOT_FOUND", 404);
  const temp = mkdtempSync(join(tmpdir(), "gs-bundle-"));
  const bundle = join(temp, "history.bundle");
  try {
    await exportGitBundle(projectDir(slug), bundle);
    const backup = { format: "gamesketch", version: 1, date: new Date().toISOString(),
      files: snapshot(slug, { assets: true, actions: true, canvases: true }),
      history: readFileSync(bundle).toString("base64") };
    const json = Buffer.from(JSON.stringify(backup));
    if (json.length > 200 * 1024 * 1024) throw problem("BACKUP_TOO_LARGE", 413);
    const compressed = gzipSync(json);
    if (compressed.length > 100 * 1024 * 1024) throw problem("BACKUP_TOO_LARGE", 413);
    return compressed;
  } finally {
    rmSync(bundle, { force: true });
    rmdirSync(temp);
  }
});

export async function importBackup(buffer, author, title) {
  let backup, meta;
  try {
    backup = JSON.parse(gunzipSync(buffer, { maxOutputLength: 200 * 1024 * 1024 }).toString("utf8"));
    if (backup.format !== "gamesketch" || backup.version !== 1 || !backup.files || typeof backup.files !== "object" || Array.isArray(backup.files)) throw new Error();
    const entries = Object.entries(backup.files);
    if (!entries.length || entries.length > 30000 || !backup.files["project.md"]) throw new Error();
    for (const [name, value] of entries) {
      projectFile("validation", name);
      if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error();
    }
    meta = matter(Buffer.from(backup.files["project.md"], "base64").toString("utf8"));
    if (typeof meta.data.title !== "string" || !meta.data.title.trim() || typeof backup.history !== "string") throw new Error();
  } catch { throw problem("INVALID_BACKUP"); }

  // Allocate a new project; importing a backup never overwrites a working project.
  mkdirSync(projectsDir(), { recursive: true });
  const restoredTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : meta.data.title;
  const slug = uniqueSlug(slugify(restoredTitle));
  const dir = resolve(projectDir(slug));
  mkdirSync(dir);
  const temp = mkdtempSync(join(tmpdir(), "gs-import-"));
  const bundle = join(temp, "history.bundle");
  try {
    await ensureRepo(dir);
    writeFileSync(bundle, Buffer.from(backup.history, "base64"));
    await importGitBundle(dir, bundle);
    for (const [name, value] of Object.entries(backup.files)) writeSnapshotFile(slug, name, value);
    writeFileSync(projectMeta(slug), matter.stringify(meta.content, { ...meta.data, slug, title: restoredTitle, archived: false }));
    const p = await getProject(slug);
    const byId = new Map(p.nodes.map((n) => [n.id, n]));
    if (byId.size !== p.nodes.length) throw problem("INVALID_BACKUP");
    for (const n of p.nodes) {
      if (n.tracking != null) validateTracking(n.tracking);
      if (typeof n.title !== "string" || typeof n.id !== "string" || !p.categories.some((c) => c.slug === n.pillar)
        || !Object.hasOwn(backup.files, `nodes/${n.pillar}/${n.id}.md`) || !Array.isArray(n.attachments)
        || n.attachments.some((path) => typeof path !== "string" || !/^assets\/[A-Za-z0-9_.-]+$/.test(path) || !Object.hasOwn(backup.files, path))
        || (n.canvas && (n.canvas !== `canvases/${n.id}.excalidraw` || !Object.hasOwn(backup.files, n.canvas)))) throw problem("INVALID_BACKUP");
      if (n.parent && (!byId.has(n.parent) || byId.get(n.parent).pillar !== n.pillar)) throw problem("INVALID_BACKUP");
      const visited = new Set([n.id]);
      let parent = byId.get(n.parent);
      while (parent) {
        if (visited.has(parent.id)) throw problem("INVALID_BACKUP");
        visited.add(parent.id); parent = byId.get(parent.parent);
      }
    }
    await commitAll(dir, { ...author, message: `backup: import "${restoredTitle}"` });
    return { slug, title: restoredTitle };
  } catch (error) {
    // This directory was allocated above, and must stay inside projects/ before cleanup.
    if (dir.startsWith(resolve(projectsDir()) + sep) && basename(dir) === slug) rmSync(dir, { recursive: true, force: true });
    throw error.code === "INVALID_BACKUP" ? error : problem("INVALID_BACKUP");
  } finally {
    rmSync(bundle, { force: true });
    rmdirSync(temp);
  }
}

export const duplicateProject = projectWrite(async (slug, title, author) => importBackup(await exportBackup(slug), author, title));
