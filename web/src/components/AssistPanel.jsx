import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import ProposalCard from "./ProposalCard.jsx";

export default function AssistPanel({ slug, node, onChanged }) {
  const { t, lang } = useT();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [out, setOut] = useState("");          // plain text (summarize / alternative)
  const [gaps, setGaps] = useState(null);      // [{id, text, checked}]
  const [note, setNote] = useState("");
  const [proposal, setProposal] = useState(null); // { reply, actions }
  const [applied, setApplied] = useState({});

  function reset() { setOut(""); setGaps(null); setProposal(null); setNote(""); setErr(""); setApplied({}); }

  async function runText(action) {
    reset(); setBusy(action);
    try { const r = await api.assist(slug, { nodeId: node.id }, action, lang); setOut(r.text); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }

  async function runGaps() {
    reset(); setBusy("gaps");
    try {
      const r = await api.assistGaps(slug, node.id, lang);
      setGaps((r.gaps || []).map((g) => ({ ...g, checked: true })));
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }

  function toggle(id) { setGaps((gs) => gs.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g))); }

  async function fixIt() {
    const items = gaps.filter((g) => g.checked).map((g) => g.text);
    if (!items.length) return;
    setBusy("propose"); setErr("");
    try { setProposal(await api.assistPropose(slug, { nodeId: node.id, items, note, lang })); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(""); }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button className="btn" disabled={!!busy} onClick={runGaps} style={{ borderColor: "var(--gameloop)", color: "var(--gameloop)" }}>
          {busy === "gaps" ? t("assist.thinking") : t("assist.gaps")}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => runText("summarize")} style={{ borderColor: "var(--scope)", color: "var(--scope)" }}>
          {busy === "summarize" ? t("assist.thinking") : t("assist.summarize")}
        </button>
        <button className="btn" disabled={!!busy} onClick={() => runText("alternative")} style={{ borderColor: "var(--threads)", color: "var(--threads)" }}>
          {busy === "alternative" ? t("assist.thinking") : t("assist.alternative")}
        </button>
      </div>
      <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>{t("assist.note")}</div>

      {err && (
        <div style={{ color: "var(--gameloop)", fontSize: 13.5, padding: 12, background: "rgba(255,107,94,0.08)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,107,94,0.25)" }}>{err}</div>
      )}
      {out && (
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", fontSize: 14, background: "var(--surface-2)", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", lineHeight: 1.65 }}>{out}</pre>
      )}

      {/* Step 1: gaps as checkboxes -> note -> Fix it */}
      {gaps && !proposal && (
        <div style={{ display: "grid", gap: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16 }}>
          {gaps.length === 0 ? (
            <div style={{ color: "var(--text-faint)" }}>{t("assist.gapsEmpty")}</div>
          ) : (
            <>
              <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>{t("assist.selectGaps")}</div>
              <div style={{ display: "grid", gap: 8 }}>
                {gaps.map((g) => (
                  <label key={g.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", fontSize: 13.5, lineHeight: 1.5 }}>
                    <input type="checkbox" checked={g.checked} onChange={() => toggle(g.id)} style={{ marginTop: 3 }} />
                    <span>{g.text}</span>
                  </label>
                ))}
              </div>
              <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("assist.notePlaceholder")} style={{ minHeight: 64, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" disabled={busy === "propose" || !gaps.some((g) => g.checked)} onClick={fixIt}>
                  {busy === "propose" ? t("assist.thinking") : t("assist.fixIt")}
                </button>
                <button className="btn btn-ghost" disabled={!!busy} onClick={reset}>{t("assist.discard")}</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: proposal preview -> approve & apply */}
      {proposal && (
        <div style={{ display: "grid", gap: 12, background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", padding: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{t("assist.proposalTitle")}</div>
          {proposal.reply && <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.55 }}>{proposal.reply}</div>}
          {proposal.proposal ? <ProposalCard proposal={proposal.proposal} {...applied} onUpdate={(patch) => setApplied((a) => ({ ...a, ...patch }))} onChanged={onChanged} /> : <div>{t("assist.noActions")}</div>}
          <button className="btn btn-ghost" onClick={reset}>{t("qol.close")}</button>
        </div>
      )}
    </div>
  );
}
