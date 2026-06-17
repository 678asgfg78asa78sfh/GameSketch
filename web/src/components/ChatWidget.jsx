import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";

const STORE = "gs_chat_v1";
const UI_STORE = "gs_chat_ui";

function loadMsgs() {
  try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; }
}
function loadUi() {
  try { const s = JSON.parse(localStorage.getItem(UI_STORE)); if (s && s.w) return s; } catch { /* default */ }
  const w = 390, h = 560;
  const vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
  return { w, h, x: Math.max(8, vw - w - 16), y: Math.max(8, vh - h - 16) };
}

// Global copilot chat — persistent, context-aware, movable + resizable (like a little window).
export default function ChatWidget() {
  const { t, lang } = useT();
  const { work, bumpReload, layoutTick } = useWork();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(loadMsgs);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ui, setUi] = useState(loadUi);
  const scroller = useRef(null);
  const drag = useRef(null);

  useEffect(() => { try { localStorage.setItem(STORE, JSON.stringify(msgs.slice(-100))); } catch { /* ignore */ } }, [msgs]);
  useEffect(() => { try { localStorage.setItem(UI_STORE, JSON.stringify(ui)); } catch { /* ignore */ } }, [ui]);
  useEffect(() => { if (open && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight; }, [msgs, open, busy]);
  // re-read geometry when a saved layout is applied or reset
  useEffect(() => { setUi(loadUi()); }, [layoutTick]);

  const onMove = useCallback((e) => {
    const d = drag.current; if (!d) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    if (d.mode === "move") {
      setUi((u) => ({ ...u, x: Math.min(Math.max(0, d.ox + e.clientX - d.sx), vw - 80), y: Math.min(Math.max(0, d.oy + e.clientY - d.sy), vh - 40) }));
    } else {
      setUi((u) => ({ ...u, w: Math.min(Math.max(300, d.ow + e.clientX - d.sx), vw - 16), h: Math.min(Math.max(320, d.oh + e.clientY - d.sy), vh - 16) }));
    }
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  }, [onMove]);
  const startMove = (e) => { e.preventDefault(); drag.current = { mode: "move", sx: e.clientX, sy: e.clientY, ox: ui.x, oy: ui.y }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };
  const startResize = (e) => { e.preventDefault(); e.stopPropagation(); drag.current = { mode: "resize", sx: e.clientX, sy: e.clientY, ow: ui.w, oh: ui.h }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); };

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setErr(""); setInput("");
    const next = [...msgs, { role: "user", content: text }];
    setMsgs(next); setBusy(true);
    try {
      const r = await api.chat({ messages: next.map((m) => ({ role: m.role, content: m.content })), slug: work.slug, nodeId: work.nodeId, lang });
      setMsgs((m) => [...m, { role: "assistant", content: r.text, applied: r.applied || [] }]);
      if (r.changed) bumpReload();
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setBusy(false); }
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
    ? t("chat.sees", { what: work.nodeTitle ? `${work.slug} › ✎ ${work.nodeTitle}` : `${work.slug} · ${t("chat.wholeProject")}` })
    : t("chat.noProject");

  return (
    <div className="glass" style={{ position: "fixed", left: ui.x, top: ui.y, width: ui.w, height: ui.h, zIndex: 45, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div onPointerDown={startMove} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", borderBottom: "1px solid var(--border)", cursor: "move", touchAction: "none" }}>
        <span style={{ fontSize: 16 }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>{t("chat.title")}</div>
          <div className="mono" style={{ fontSize: 11, color: work.nodeTitle ? "var(--spark)" : "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ctxLabel}</div>
        </div>
        {msgs.length > 0 && <button className="btn btn-ghost btn-icon" title={t("chat.clear")} onPointerDown={(e) => e.stopPropagation()} onClick={() => setMsgs([])} style={{ fontSize: 13 }}>🗑</button>}
        <button className="btn btn-ghost btn-icon" onPointerDown={(e) => e.stopPropagation()} onClick={() => setOpen(false)} style={{ fontSize: 15 }}>✕</button>
      </div>

      <div ref={scroller} style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13, lineHeight: 1.6 }}>{t("chat.empty")}</div>}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
            <div style={{ padding: "9px 12px", borderRadius: 13, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap", background: m.role === "user" ? "linear-gradient(120deg, var(--spark), var(--spark-2))" : "var(--surface-2)", color: m.role === "user" ? "#0a0612" : "var(--text)", border: m.role === "user" ? "none" : "1px solid var(--border)" }}>
              {m.content}
            </div>
            {m.applied?.length > 0 && <div className="mono" style={{ fontSize: 10.5, color: "var(--content)", marginTop: 4 }}>{t("chat.applied", { n: m.applied.filter((a) => a.type !== "error").length })}</div>}
          </div>
        ))}
        {busy && <div className="mono" style={{ color: "var(--text-faint)" }}>{t("chat.thinking")}</div>}
        {err && <div style={{ color: "var(--gameloop)", fontSize: 12.5 }}>{err}</div>}
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
