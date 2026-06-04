import { useState } from "react";
import { api } from "../api.js";

export default function Attachments({ slug, node, onChanged }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onDrop(e) {
    e.preventDefault(); setOver(false); setBusy(true);
    for (const file of e.dataTransfer.files) await api.uploadAttachment(slug, node.id, file);
    setBusy(false); onChanged();
  }

  const has = (node.attachments || []).length > 0;
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      style={{
        border: `1.5px dashed ${over ? "var(--spark)" : "var(--border-strong)"}`,
        borderRadius: "var(--radius-md)", padding: 16, marginTop: 16,
        transition: "border-color .15s, background .15s",
        background: over ? "rgba(124,140,255,0.07)" : "transparent",
      }}>
      <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginBottom: has ? 12 : 0 }}>
        {busy ? "lädt hoch…" : "📎 Dateien hierher ziehen — Skizzen, Refs, was auch immer"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
        {(node.attachments || []).map((a) => (
          <a key={a} className="chip" href={`/api/projects/${slug}/${a}`} target="_blank" rel="noreferrer">
            📄 {a.split("/").pop()}
          </a>
        ))}
      </div>
    </div>
  );
}
