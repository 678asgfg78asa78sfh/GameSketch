// Workspace layout: the tree-sidebar width and the copilot window's position/size.
// These auto-persist as you drag; this module adds an explicit "baseline" you can save
// and restore, plus a reset to factory defaults — so your workspace is "always the same".
const SIDE = "gs_sidebar_w";
const CHAT = "gs_chat_ui";
const BASE = "gs_layout_baseline";

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } };

export function saveBaseline() {
  set(BASE, JSON.stringify({ side: get(SIDE), chat: get(CHAT) }));
}

export function hasBaseline() { return !!get(BASE); }

export function applyBaseline() {
  let b = null;
  try { b = JSON.parse(get(BASE)); } catch { /* none */ }
  if (!b) return false;
  set(SIDE, b.side);
  set(CHAT, b.chat);
  return true;
}

export function resetLayout() {
  set(SIDE, null);
  set(CHAT, null);
}
