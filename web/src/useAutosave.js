import { useEffect, useRef, useState } from "react";
import { createAutosave } from "./autosave.js";

const activeSavers = new Set();
export async function flushAll() {
  for (const saver of [...activeSavers]) await saver.flush();
}

export function useAutosave(save, delay = 600) {
  const latestSave = useRef(save);
  latestSave.current = save;
  const mounted = useRef(true);
  const [state, setState] = useState({ saved: true, error: null });
  const [saver] = useState(() => createAutosave((patch) => latestSave.current(patch), {
    delay,
    onState: (next) => { if (mounted.current) setState(next); },
  }));

  useEffect(() => {
    mounted.current = true;
    activeSavers.add(saver);
    const beforeUnload = (event) => {
      if (!saver.isPending()) return;
      void saver.flush().catch(() => {});
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mounted.current = false;
      activeSavers.delete(saver);
      window.removeEventListener("beforeunload", beforeUnload);
      void saver.flush().catch(() => {});
    };
  }, [saver]);

  return { ...state, queue: saver.queue, flush: saver.flush };
}
