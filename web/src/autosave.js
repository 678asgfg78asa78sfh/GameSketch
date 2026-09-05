// Merge edits during the debounce window and keep requests in order. A failed
// patch remains pending so retrying cannot discard an earlier field change.
export function createAutosave(save, { delay = 600, onState = () => {} } = {}) {
  let pending = null;
  let timer = null;
  let running = null;
  let error = null;
  const notify = () => onState({ saved: !pending && !running, error });

  function flush() {
    clearTimeout(timer);
    if (running) return running;
    if (!pending) return Promise.resolve();
    error = null;
    running = Promise.resolve().then(async () => {
      while (pending) {
        const patch = pending;
        pending = null;
        try { await save(patch); }
        catch (e) {
          pending = { ...patch, ...pending };
          error = e;
          clearTimeout(timer);
          throw e;
        }
      }
    }).finally(() => { running = null; notify(); });
    notify();
    return running;
  }

  return {
    queue(patch) {
      pending = { ...pending, ...patch };
      error = null;
      clearTimeout(timer);
      timer = setTimeout(() => { flush().catch(() => {}); }, delay);
      notify();
    },
    flush,
    isPending: () => !!(pending || running),
  };
}
