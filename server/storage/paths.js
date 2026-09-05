import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

export function dataDir() { return process.env.GS_DATA_DIR || join(ROOT, "data"); }
export function configPath() { return join(dataDir(), "config.json"); }
export function projectsDir() { return join(dataDir(), "projects"); }
export function projectDir(slug) {
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug))
    throw Object.assign(new Error("INVALID_PROJECT"), { code: "INVALID_PROJECT", statusCode: 400 });
  return join(projectsDir(), slug);
}
export function projectMeta(slug) { return join(projectDir(slug), "project.md"); }
export function nodesDir(slug, pillar) {
  return pillar ? join(projectDir(slug), "nodes", pillar) : join(projectDir(slug), "nodes");
}
export function nodePath(slug, pillar, id) { return join(nodesDir(slug, pillar), `${id}.md`); }
export function assetsDir(slug) { return join(projectDir(slug), "assets"); }
export function canvasDir(slug) { return join(projectDir(slug), "canvases"); }
export function canvasPath(slug, id) { return join(canvasDir(slug), `${id}.excalidraw`); }
