import { problem } from "./files.js";

export const MAX_TASKS = 200;
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);

export function validateTracking(value) {
  if (value === null) return null;
  if (!object(value) || typeof value.enabled !== "boolean" || typeof value.completed !== "boolean"
    || !Array.isArray(value.tasks) || value.tasks.length > MAX_TASKS) throw problem("INVALID_TRACKING");
  const ids = new Set();
  const tasks = value.tasks.map((task) => {
    if (!object(task) || !validId(task.id) || ids.has(task.id) || typeof task.title !== "string"
      || !task.title.trim() || task.title.length > 500 || typeof task.done !== "boolean"
      || !["task", "milestone"].includes(task.kind)) throw problem("INVALID_TRACKING");
    ids.add(task.id);
    return { id: task.id, title: task.title.trim(), done: task.done, kind: task.kind };
  });
  return { enabled: value.enabled, completed: value.completed, tasks };
}

// Apply an operation to the latest node under the project lock. Two tabs checking
// different tasks do not replace each other's entire checklist.
export function changeTracking(node, input) {
  if (!object(input) || !["enable", "disable", "complete", "reopen", "add", "remove", "edit"].includes(input.operation)) throw problem("INVALID_TRACKING");
  const tracking = validateTracking(node.tracking || { enabled: false, completed: node.progress === "complete", tasks: [] });
  if (input.operation === "enable") return { ...tracking, enabled: true };
  if (input.operation === "disable") return { ...tracking, enabled: false };
  if (!tracking.enabled) throw problem("TRACKING_DISABLED", 409);
  if (input.operation === "complete") return { ...tracking, completed: true };
  if (input.operation === "reopen") return { ...tracking, completed: false };
  if (tracking.completed) throw problem("TRACKING_CLOSED", 409);
  if (input.operation === "add") {
    if (!object(input.task)) throw problem("INVALID_TRACKING");
    const task = validateTracking({ enabled: true, completed: false, tasks: [{ ...input.task, done: false }] }).tasks[0];
    const existing = tracking.tasks.find((t) => t.id === task.id);
    if (existing) {
      if (existing.title === task.title && existing.kind === task.kind) return tracking;
      throw problem("TASK_CONFLICT", 409);
    }
    return validateTracking({ ...tracking, tasks: [...tracking.tasks, { ...task, done: false }] });
  }
  const task = tracking.tasks.find((t) => t.id === input.taskId);
  if (!task) throw problem("TASK_NOT_FOUND", 404);
  if (input.operation === "remove") return { ...tracking, tasks: tracking.tasks.filter((t) => t.id !== task.id) };
  if (input.operation === "edit") {
    const patch = input.patch;
    if (!object(patch) || Object.keys(patch).some((key) => !["title", "done", "kind"].includes(key))) throw problem("INVALID_TRACKING");
    return validateTracking({ ...tracking, tasks: tracking.tasks.map((t) => t.id === task.id ? { ...t, ...patch } : t) });
  }
  throw problem("INVALID_TRACKING");
}
