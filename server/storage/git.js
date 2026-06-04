import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
const run = promisify(execFile);

async function git(dir, args, opts = {}) {
  const { stdout } = await run("git", ["-C", dir, ...args], { maxBuffer: 64 * 1024 * 1024, ...opts });
  return stdout;
}

export async function ensureRepo(dir) {
  if (existsSync(join(dir, ".git"))) return;
  await git(dir, ["init", "-b", "main"]);
  await git(dir, ["config", "user.name", "GameSketch"]);
  await git(dir, ["config", "user.email", "gamesketch@local"]);
}

export async function commitAll(dir, { name, email, message }) {
  await git(dir, ["add", "-A"]);
  const status = await git(dir, ["status", "--porcelain"]);
  if (!status.trim()) return null; // nothing changed -> skip empty commit
  await git(dir, ["-c", `user.name=${name}`, "-c", `user.email=${email}`,
    "commit", "-m", message]);
  return (await git(dir, ["rev-parse", "HEAD"])).trim();
}

export async function fileHistory(dir, rel) {
  const path = rel.replace(/\\/g, "/");
  const fmt = "%H%x1f%an%x1f%aI%x1f%s";
  const out = await git(dir, ["log", "--follow", `--format=${fmt}`, "--", path]);
  return out.split("\n").filter(Boolean).map((line) => {
    const [commit, author, date, message] = line.split("\x1f");
    return { commit, author, date, message };
  });
}

export async function fileAtCommit(dir, commit, rel) {
  return await git(dir, ["show", `${commit}:${rel.replace(/\\/g, "/")}`]);
}
