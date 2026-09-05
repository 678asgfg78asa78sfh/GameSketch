import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { withWriteLock } from "./lock.js";
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
  return withWriteLock(dir, async () => {
    await git(dir, ["add", "-A"]);
    const status = await git(dir, ["status", "--porcelain"]);
    if (!status.trim()) return null; // nothing changed -> skip empty commit
    await git(dir, ["-c", `user.name=${name}`, "-c", `user.email=${email}`,
      "commit", "-m", message]);
    return (await git(dir, ["rev-parse", "HEAD"])).trim();
  });
}

export async function fileHistory(dir, rel, { follow = true } = {}) {
  const path = rel.replace(/\\/g, "/");
  const fmt = "%H%x1f%an%x1f%aI%x1f%s";
  const out = await git(dir, ["log", ...(follow ? ["--follow"] : []), `--format=${fmt}`, "--", path]);
  return out.split("\n").filter(Boolean).map((line) => {
    const [commit, author, date, message] = line.split("\x1f");
    return { commit, author, date, message };
  });
}

export async function fileAtCommit(dir, commit, rel) {
  return await git(dir, ["show", `${commit}:${rel.replace(/\\/g, "/")}`]);
}

export async function findFileAtCommit(dir, commit, folder, filename) {
  const paths = await git(dir, ["ls-tree", "-r", "--name-only", "-z", commit, "--", folder]);
  const path = paths.split("\0").find((p) => p.split("/").pop() === filename);
  if (!path) throw new Error("node not found at this revision");
  return fileAtCommit(dir, commit, path);
}

export async function exportGitBundle(dir, destination) {
  await git(dir, ["bundle", "create", destination, "--all"]);
}

export async function importGitBundle(dir, source) {
  await git(dir, ["bundle", "verify", source]);
  const refs = await git(dir, ["bundle", "unbundle", source]);
  const main = refs.split("\n").map((line) => line.trim().split(" ")).find(([, ref]) => ref === "refs/heads/main");
  if (!main || !/^[a-f0-9]{40,64}$/.test(main[0])) throw new Error("INVALID_BACKUP_HISTORY");
  await git(dir, ["update-ref", "refs/heads/main", main[0]]);
  await git(dir, ["read-tree", "HEAD"]);
}
