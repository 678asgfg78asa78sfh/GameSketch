import { createContext, useContext, useState, useMemo, useCallback } from "react";

// Tracks what the user currently has open (project slug + selected node) so the global
// copilot chat can "see" it, plus a reload signal the copilot bumps after it edits nodes.
const Ctx = createContext(null);

export function WorkProvider({ children }) {
  const [work, setWorkState] = useState({ slug: null, nodeId: null });
  const [reloadKey, setReloadKey] = useState(0);
  const setWork = useCallback((patch) => setWorkState((w) => ({ ...w, ...patch })), []);
  const bumpReload = useCallback(() => setReloadKey((k) => k + 1), []);
  const value = useMemo(() => ({ work, setWork, reloadKey, bumpReload }), [work, reloadKey, setWork, bumpReload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWork() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWork must be used within WorkProvider");
  return c;
}
