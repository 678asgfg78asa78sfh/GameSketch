import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { api } from "../api.js";
import StatusBadge from "./StatusBadge.jsx";
import MarkdownView from "./MarkdownView.jsx";
import Attachments from "./Attachments.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import AssistPanel from "./AssistPanel.jsx";

// Excalidraw is heavy (~3MB) — only load it when the canvas tab is opened.
const CanvasPane = lazy(() => import("./CanvasPane.jsx"));

const STATUS_CYCLE = { core: "side", side: "future", future: "core" };
const TABS = ["edit", "preview", "canvas", "history", "assist"];

export default function NodeEditor({ slug, node, onChanged }) {
  const [title, setTitle] = useState(node.title);
  const [body, setBody] = useState(node.body || "");
  const [tab, setTab] = useState("edit");
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef(null);

  useEffect(() => {
    setTitle(node.title); setBody(node.body || ""); setTab("edit"); setSaved(true);
  }, [node.id]);

  function queueSave(patch) {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.updateNode(slug, node.id, patch).then(() => { setSaved(true); onChanged(); });
    }, 600);
  }
  async function cycleStatus() { await api.updateNode(slug, node.id, { status: STATUS_CYCLE[node.status] }); onChanged(); }
  async function setKind(kind) { await api.updateNode(slug, node.id, { kind }); onChanged(); }
  async function del() { if (confirm(`„${node.title}" löschen?`)) { await api.deleteNode(slug, node.id); onChanged(); } }

  return (
    <div style={{ padding: 28, maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <StatusBadge status={node.status} onClick={cycleStatus} />
        <select className="field" style={{ width: "auto", padding: "7px 28px 7px 11px" }} value={node.kind} onChange={(e) => setKind(e.target.value)}>
          <option value="idea">Idee</option>
          <option value="alternative">Alternative</option>
          <option value="note">Notiz</option>
        </select>
        <span className="mono" style={{ marginLeft: 4, color: saved ? "var(--content)" : "var(--text-faint)" }}>
          {saved ? "✓ gespeichert" : "… speichert"}
        </span>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={del}>🗑 Löschen</button>
      </div>

      <input value={title} onChange={(e) => { setTitle(e.target.value); queueSave({ title: e.target.value }); }}
        placeholder="Titel der Idee…"
        style={{ width: "100%", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", border: "none", background: "transparent", color: "var(--text)", padding: 0, outline: "none" }} />

      <div className="tabs" style={{ width: "fit-content", margin: "20px 0" }}>
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {tab === "edit" && (
        <>
          <textarea className="field" value={body} onChange={(e) => { setBody(e.target.value); queueSave({ body: e.target.value }); }}
            placeholder="Idee reinbuttern… (Markdown, [[id]] für Querverweise)"
            style={{ minHeight: 320, resize: "vertical", lineHeight: 1.7, fontFamily: "var(--font-body)" }} />
          <Attachments slug={slug} node={node} onChanged={onChanged} />
        </>
      )}
      {tab === "preview" && <MarkdownView text={body} />}
      {tab === "canvas" && (
        <Suspense fallback={<div className="mono">Canvas-Engine lädt…</div>}>
          <CanvasPane slug={slug} node={node} />
        </Suspense>
      )}
      {tab === "history" && <HistoryPanel slug={slug} node={node} onChanged={onChanged} />}
      {tab === "assist" && <AssistPanel slug={slug} node={node} />}
    </div>
  );
}
