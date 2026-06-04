import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assetsDir, projectDir } from "./paths.js";
import { commitAll } from "./git.js";

export async function saveAsset(slug, nodeId, { filename, buffer }, author) {
  mkdirSync(assetsDir(slug), { recursive: true });
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const rel = `assets/${hash}-${safe}`;
  writeFileSync(join(projectDir(slug), rel), buffer);
  await commitAll(projectDir(slug), { ...author, message: `asset: add ${safe}` });
  return rel;
}
