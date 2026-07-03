import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";

const MAX_BYTES = 25 * 1024 * 1024; // keep in sync with the server multipart fileSize limit

export default function Attachments({ slug, node, onChanged }) {
  const { t } = useT();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDrop(e) {
    e.preventDefault();
    setOver(false);
    setError("");
    const files = [...(e.dataTransfer?.files || [])];
    // Dragging a link/image straight from a web page yields no File — say so instead of hanging.
    if (files.length === 0) { setError(t("attachments.noFiles")); return; }
    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) { setError(t("attachments.tooBig", { name: tooBig.name, max: 25 })); return; }

    setBusy(true);
    try {
      for (const file of files) await api.uploadAttachment(slug, node.id, file);
      onChanged();
    } catch (err) {
      // Always surface the failure. Previously an error here left the box stuck on "uploading…"
      // forever, because setBusy(false) sat after an unguarded await that never returned.
      setError(t("attachments.failed", { msg: err?.message || String(err) }));
    } finally {
      setBusy(false);
    }
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
      <div style={{ color: error ? "var(--gameloop)" : "var(--text-dim)", fontSize: 12.5, marginBottom: has ? 12 : 0 }}>
        {busy ? t("attachments.uploading") : (error || t("attachments.dropHint"))}
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
