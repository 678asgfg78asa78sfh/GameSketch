import { existsSync, readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { projectDir } from "./paths.js";

export function problem(code, statusCode = 400) {
  return Object.assign(new Error(code), { code, statusCode });
}

export function projectFile(slug, name) {
  const allowed = /^(project\.md|nodes\/[a-z0-9-]{1,40}\/[A-Za-z0-9_-]{1,80}\.md|canvases\/[A-Za-z0-9_-]{1,80}\.excalidraw|assets\/[A-Za-z0-9_.-]+|(?:trash|actions)\/[A-Za-z0-9_-]{1,80}\.json)$/;
  if (!allowed.test(name) || name.split("/").some((p) => p === "." || p === "..")) throw problem("INVALID_BACKUP");
  const base = resolve(projectDir(slug));
  const target = resolve(base, name);
  if (!target.startsWith(base + sep)) throw problem("INVALID_BACKUP");
  return target;
}

export function snapshot(slug, { assets = false, actions = false, canvases = false } = {}) {
  const out = {};
  const visit = (relative) => {
    const path = resolve(projectDir(slug), relative);
    if (!existsSync(path)) return;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === ".gitkeep") continue;
      if (entry.isSymbolicLink()) throw problem("UNSUPPORTED_PROJECT_FILE");
      const name = `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(name);
      else if (entry.isFile()) out[name] = readFileSync(projectFile(slug, name)).toString("base64");
    }
  };
  if (existsSync(projectFile(slug, "project.md"))) out["project.md"] = readFileSync(projectFile(slug, "project.md")).toString("base64");
  for (const dir of ["nodes", "trash", ...(canvases ? ["canvases"] : []), ...(assets ? ["assets"] : []), ...(actions ? ["actions"] : [])]) visit(dir);
  return out;
}

export function writeSnapshotFile(slug, name, value) {
  const path = projectFile(slug, name);
  if (value == null) { rmSync(path, { force: true }); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(value, "base64"));
}
