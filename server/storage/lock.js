import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";
import { projectDir } from "./paths.js";

const pending = new Map();
const current = new AsyncLocalStorage();

// Keep each read/modify/write + Git commit together. Different projects can still
// save independently, and nested storage calls share the enclosing transaction.
export function withWriteLock(dir, action) {
  const key = resolve(dir);
  if (current.getStore() === key) return action();
  const result = (pending.get(key) || Promise.resolve()).then(() => current.run(key, action));
  const settled = result.catch(() => {});
  pending.set(key, settled);
  settled.then(() => { if (pending.get(key) === settled) pending.delete(key); });
  return result;
}

export function projectWrite(action) {
  return (slug, ...args) => withWriteLock(projectDir(slug), () => action(slug, ...args));
}
