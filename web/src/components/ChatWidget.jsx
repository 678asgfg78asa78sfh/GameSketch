import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";
import ProposalCard from "./ProposalCard.jsx";
import { errorText } from "../ui.js";
import { flushAll } from "../useAutosave.js";

const STORE = "gs_chat_v2";
const UI_STORE = "gs_chat_ui";

function loadMsgs(key) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; } catch { return []; }
}
function loadUi() {
  try { const s = JSON.parse(localStorage.getItem(UI_STORE)); if (s && s.w) return s; } catch { /* default */ }
  const w = 390, h = 560;
  const vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
  return { w, h, x: Math.max(8, vw - w - 16), y: Math.max(8, vh - h - 16) };
}

// Global copilot chat — persistent, context-aware, movable + resizable (like a little window).
export default function ChatWidget({ userName }) {
  const { t, lang } = useT();
  const { work, bumpReload, layoutTick } = useWork();
  const [open, setOpen] = useState(false);
  const key = `${STORE}:${encodeURIComponent(userName)}:${work.slug || "lobby"}`;
  const [records, setRecords] = useState({}), [inputs, setInputs] = useState({}), [pending, setPending] = useState({}), [errors, setErrors] = useState({});
  const msgs = records[key] || loadMsgs(key), input = inputs[key] || "", busy = !!pending[key], err = errors[key] || "";
  function updateMsgs(target, update) { setRecords((all) => ({ ...all, [target]: update(all[target] || loadMsgs(target)).slice(-100) })); }
  function setInput(value) { setInputs((all) => ({ ...all, [key]: value })); }
  const [ui, setUi] = useState(loadUi);
  const scroller = useRef(null);
  const drag = useRef(null);

  useEffect(() => { for (const [target, messages] of Object.entries(records)) { try { localStorage.setItem(target, JSON.stringify(messages)); } catch { /* storage may be full; conversation remains available in this session */ } } }, [records]);
  useEffect(() => { try { localStorage.setItem(UI_STORE, JSON.stringify(ui)); } catch { /* ignore */ } }, [ui]);
  useEffect(() => { if (open && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, open, busy]);
  // re-read geometry when a saved layout is applied or reset
  useEffect(() => { setUi(loadUi()); }, [layoutTick]);
  // Keep the widget reachable when the window shrinks: clamp its geometry back into the
  // viewport. Without this, a widget parked near the right/bottom edge can slide entirely
  // off-screen (behind the window border) on resize, with no way to grab it.
  useEffect(() => {
    const clampToViewport = () => setUi((u) => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const w = Math.min(u.w, vw - 16);
      const h = Math.min(u.h, vh - 16);
      const x = Math.min(Math.max(8, u.x), Math.max(8, vw - w - 8));
      const y = Math.min(Math.max(8, u.y), Math.max(8, vh - h - 8));
      if (x === u.x && y === u.y && w === u.w && h === u.h) return u; // unchanged -> no re-render
      return { ...u, x, y, w, h };
    });
    clampToViewport(); // also fix geometry that was saved on a larger screen, before any resize
    window.addEventListener("resize", clampToViewport);
    return () => window.removeEventListener("resize", clampToViewport);
  }, []);

  const onMove = useCallback((e) => {
    const d = drag.current; if (!d) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (d.mode === "move") {
      setUi((u) => ({ ...u, x: Math.min(Math.max(8, d.ox + e.clientX - d.sx), Math.max(8, vw - u.w - 8)), y: Math.min(Math.max(8, d.oy + e.clientY - d.sy), Math.max(8, vh - u.h - 8)) }));
    } else {
      setUi((u) => ({ ...u, w: Math.min(Math.max(300, d.ow + e.clientX - d.sx), vw - u.x - 8), h: Math.min(Math.max(320, d.oh + e.clientY - d.sy), vh - u.y - 8) }));
    }
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  useEffect(() => () => onUp(), [onUp]);
  const startMove = (e) => { e.preventDefault(); drag.current = { mode: "move", sx: e.clientX, sy: e.clientY, ox: ui.x, oy: ui.y }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };
  const startResize = (e) => { e.preventDefault(); e.stopPropagation(); drag.current = { mode: "resize", sx: e.clientX, sy: e.clientY, ow: ui.w, oh: ui.h }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const target = key, slug = work.slug, nodeId = work.nodeId;
    setErrors((all) => ({ ...all, [target]: "" })); setInput("");
    const next = [...msgs, { id: crypto.randomUUID(), role: "user", content: text }];
    updateMsgs(target, () => next); setPending((all) => ({ ...all, [target]: true }));
    try {
      await flushAll();
      const r = await api.chat({ messages: next.map((m) => ({ role: m.role, content: m.content + (m.action ? `\n[Proposal ${m.action.undone ? "undone" : "applied"} by user]` : "") })), slug, nodeId, lang });
      updateMsgs(target, (m) => [...m, { id: crypto.randomUUID(), role: "assistant", content: r.text, proposal: r.proposal, context: r.context }]);
      if (r.changed) bumpReload();
    } catch (e2) { setErrors((all) => ({ ...all, [target]: errorText(e2, t) })); setInputs((all) => ({ ...all, [target]: all[target] || text })); updateMsgs(target, (m) => m.filter((message) => message.id !== next.at(-1).id)); }
    finally { setPending((all) => ({ ...all, [target]: false })); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title={t("chat.open")} aria-label={t("chat.open")} className="glass"
        style={{ position: "fixed", right: 16, bottom: 16, zIndex: 40, width: 52, height: 52, borderRadius: 99, display: "grid", placeItems: "center", cursor: "pointer", fontSize: 23, padding: 0, lineHeight: 1 }}>
        ✦
      </button>
    );
  }

  const ctxLabel = work.slug
    ? t("chat.sees", { what: work.nodeTitle ? `${work.slug} › ✎ ${work.nodeTitle}` : `${work.slug} · ${t("qol.overview")}` })
    : t("chat.noProject");

  return (
    <div className="glass chat-widget no-print" role="region" aria-label={t("chat.title")} style={{ position: "fixed", left: ui.x, top: ui.y, width: ui.w, height: ui.h, zIndex: 45, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div onPointerDown={startMove} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--border)", cursor: "move", touchAction: "none" }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{t("chat.title")}</div>
          <div className="mono" style={{ fontSize: 11, color: work.nodeTitle ? "var(--spark)" : "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ctxLabel}</div>
        </div>
        {msgs.length > 0 && <button className="btn btn-ghost btn-icon" disabled={busy} title={t("chat.clear")} onPointerDown={(e) => e.stopPropagation()} onClick={() => { if (confirm(t("qol.clearChat"))) updateMsgs(key, () => []); }} style={{ fontSize: 13 }}>🗑</button>}
        <button className="btn btn-ghost btn-icon" aria-label={t("qol.close")} onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)} style={{ fontSize: 15 }}>✕</button>
      </div>

      <div ref={scroller} style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <small className="muted">{t("qol.chatHint")}</small>
        {msgs.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13, lineHeight: 1.6 }}>{t("chat.empty")}</div>}
        {msgs.map((m, i) => (
          <div key={key + (m.id || i)} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: m.proposal ? "100%" : "88%", minWidth: 0 }}>
            <div style={{ padding: "9px 12px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", background: m.role === "user" ? "linear-gradient(120deg, var(--spark), var(--spark-2))" : "var(--surface-2)", color: m.role === "user" ? "#0a0612" : "var(--text)", border: m.role === "user" ? "none" : "1px solid var(--border)" }}>
              {m.content}
            </div>
            {m.applied?.length > 0 && <div className="mono" style={{ fontSize: 10.5, color: "var(--content)", marginTop: 4 }}>{t("chat.applied", { n: m.applied.filter((a) => a.type !== "error").length })}</div>}
            {m.context && <small className="muted">{t("qol.context", m.context)}</small>}
            {m.proposal && <ProposalCard proposal={m.proposal} action={m.action} discarded={m.discarded} onUpdate={(patch) => updateMsgs(key, (messages) => messages.map((message) => message.id === m.id ? { ...message, ...patch } : message))} onChanged={bumpReload} />}
          </div>
        ))}
        {busy && <div className="mono" style={{ color: "var(--text-faint)" }}>{t("chat.thinking")}</div>}
        {err && <div role="alert" style={{ color: "var(--gameloop)", fontSize: 12.5 }}>{err}</div>}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border)" }}>
        <input className="field" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("chat.placeholder")} autoFocus />
        <button className="btn btn-primary" disabled={busy || !input.trim()} style={{ whiteSpace: "nowrap" }}>{t("chat.send")}</button>
      </form>

      {/* resize grip */}
      <div onPointerDown={startResize} title="↘"
        style={{ position: "absolute", right: 0, bottom: 0, width: 18, height: 18, cursor: "nwse-resize", touchAction: "none",
          background: "linear-gradient(135deg, transparent 50%, var(--border-strong) 50%)" }} />
    </div>
  );
}
