import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { canvasPath, canvasDir, projectDir } from "./paths.js";
import { commitAll } from "./git.js";

export async function writeCanvas(slug, id, json, author) {
  mkdirSync(canvasDir(slug), { recursive: true });
  writeFileSync(canvasPath(slug, id), JSON.stringify(json, null, 2));
  await commitAll(projectDir(slug), { ...author, message: `canvas: update ${id}` });
}

export async function readCanvas(slug, id) {
  if (!existsSync(canvasPath(slug, id))) return { elements: [], appState: {} };
  return JSON.parse(readFileSync(canvasPath(slug, id), "utf8"));
}
