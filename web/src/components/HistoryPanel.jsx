import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";

export default function HistoryPanel({ slug, node, onChanged }) {
  const { t } = useT();
  const [hist, setHist] = useState(null);

  useEffect(() => { api.history(slug, node.id).then(setHist).catch(() => setHist([])); }, [node.id]);

  async function restore(commit) {
    if (!confirm(t("history.confirmRestore"))) return;
    await api.restore(slug, node.id, commit);
    onChanged();
  }

  if (!hist) return <div className="mono">{t("history.loading")}</div>;
  if (hist.length === 0) return <div style={{ color: "var(--text-faint)" }}>{t("history.none")}</div>;

  return (
    <div style={{ display: "grid", gap: 9 }}>
      {hist.map((h, i) => (
        <div key={h.commit} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)" }}>
          <span className="dot" style={{ color: i === 0 ? "var(--content)" : "var(--text-faint)", background: i === 0 ? "var(--content)" : "var(--text-faint)" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.message}</div>
            <div className="mono" style={{ marginTop: 3 }}>{h.author} · {new Date(h.date).toLocaleString()}</div>
          </div>
          {i !== 0 && <button className="btn btn-ghost" onClick={() => restore(h.commit)}>{t("history.restore")}</button>}
          {i === 0 && <span className="mono" style={{ color: "var(--content)" }}>{t("history.current")}</span>}
        </div>
      ))}
    </div>
  );
}
