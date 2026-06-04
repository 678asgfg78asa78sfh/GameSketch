import { useState } from "react";
import { api } from "../api.js";

const ACTIONS = [
  ["gaps", "Lücken finden", "var(--gameloop)"],
  ["summarize", "Zusammenfassen", "var(--scope)"],
  ["alternative", "Alternative", "var(--threads)"],
];

export default function AssistPanel({ slug, node }) {
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function run(action) {
    setBusy(action); setErr(""); setOut("");
    try {
      const r = await api.assist(slug, { nodeId: node.id }, action);
      setOut(r.text);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        {ACTIONS.map(([a, label, c]) => (
          <button key={a} className="btn" disabled={!!busy} onClick={() => run(a)} style={{ borderColor: c, color: c }}>
            {busy === a ? "… denkt" : label}
          </button>
        ))}
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
        Läuft gegen deinen lokalen LLM-Endpunkt (<span className="mono">data/config.json → ai.baseUrl</span>). Nichts verlässt deinen Rechner.
      </div>
      {err && (
        <div style={{ color: "var(--gameloop)", fontSize: 13.5, padding: 12, background: "rgba(255,107,94,0.08)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,107,94,0.25)" }}>
          {err}
        </div>
      )}
      {out && (
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", fontSize: 14, background: "var(--surface-2)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", lineHeight: 1.65 }}>
          {out}
        </pre>
      )}
    </div>
  );
}
