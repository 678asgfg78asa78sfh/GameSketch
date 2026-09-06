// Shared by storage, the tree and exports: percentages never guess effort or time.
export function trackingProgress(node) {
  const tracking = node.tracking;
  const tasks = Array.isArray(tracking?.tasks) ? tracking.tasks : [];
  const done = tasks.filter((task) => task.done).length;
  const enabled = tracking ? tracking.enabled === true : node.progress === "complete" || node.progress === "needs_work";
  const complete = tracking?.enabled
    ? tracking.completed || (tasks.length > 0 && done === tasks.length)
    : node.progress === "complete";
  const fraction = complete ? 1 : tracking?.enabled && tasks.length ? done / tasks.length : 0;
  return { enabled, tasks, done, total: tasks.length, complete: Boolean(complete), fraction,
    percent: complete ? 100 : Math.min(99, Math.round(fraction * 100)),
    status: complete ? "complete" : tracking?.enabled ? (done ? "needs_work" : "new") : node.progress || "new" };
}

export function projectProgress(nodes) {
  const previousVersions = new Set(nodes.map((node) => node.continued_from).filter(Boolean));
  const tracked = nodes.filter((node) => !previousVersions.has(node.id)).map(trackingProgress).filter((p) => p.enabled);
  return { total: tracked.length, done: tracked.filter((p) => p.complete).length,
    percent: tracked.length ? Math.min(tracked.every((p) => p.complete) ? 100 : 99,
      Math.round(tracked.reduce((sum, p) => sum + p.fraction, 0) / tracked.length * 100)) : 0 };
}
