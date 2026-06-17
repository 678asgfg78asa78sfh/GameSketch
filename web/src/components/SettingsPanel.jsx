import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";
import { saveBaseline, applyBaseline, resetLayout, hasBaseline } from "../layout.js";
import LangPicker from "./LangPicker.jsx";

const SECTIONS = ["language", "password", "ai", "agents", "workspace", "howto"];

export default function SettingsPanel({ slug, onClose }) {
  const { t } = useT();
  const [section, setSection] = useState("language");

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,4,8,0.62)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="glass"
        style={{ width: "min(640px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{t("settings.title")}</div>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>✕ {t("common.close")}</button>
        </div>

        <div className="tabs" style={{ width: "fit-content", marginBottom: 20, flexWrap: "wrap" }}>
          {SECTIONS.map((s) => (
            <button key={s} className={`tab ${section === s ? "active" : ""}`} onClick={() => setSection(s)}>
              {t(`settings.${s}`)}
            </button>
          ))}
        </div>

        {section === "language" && <LanguageSection />}
        {section === "password" && <PasswordSection />}
        {section === "ai" && <AiSection />}
        {section === "agents" && <AgentsSection />}
        {section === "workspace" && <WorkspaceSection onClose={onClose} />}
        {section === "howto" && <HowtoSection slug={slug} />}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 6 }}>{children}</div>;
}

function LanguageSection() {
  const { t } = useT();
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Label>{t("settings.language")}</Label>
      <LangPicker />
    </div>
  );
}

function WorkspaceSection({ onClose }) {
  const { t } = useT();
  const { reloadLayout } = useWork();
  const [msg, setMsg] = useState("");
  const [hasBase, setHasBase] = useState(hasBaseline());
  // close the panel after restore/reset so the moved copilot / resized tree are visible
  const applyAndClose = (fn) => { fn(); reloadLayout(); setTimeout(() => onClose && onClose(), 250); };
  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{t("workspace.intro")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={() => { saveBaseline(); setHasBase(true); setMsg(t("workspace.saved")); }}>{t("workspace.save")}</button>
        <button className="btn" disabled={!hasBase} onClick={() => applyAndClose(applyBaseline)}>{t("workspace.restore")}</button>
        <button className="btn btn-ghost" onClick={() => applyAndClose(resetLayout)}>{t("workspace.resetBtn")}</button>
      </div>
      {msg && <div style={{ color: "var(--content)", fontSize: 13 }}>{msg}</div>}
    </div>
  );
}

function PasswordSection() {
  const { t } = useT();
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setMsg(""); setErr(""); setBusy(true);
    try {
      await api.changePassword(cur, next);
      setCur(""); setNext(""); setMsg(t("settings.pwChanged"));
    } catch (e2) { setErr(String(e2.message || e2)); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 360 }}>
      <div>
        <Label>{t("settings.currentPassword")}</Label>
        <input className="field" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
      </div>
      <div>
        <Label>{t("settings.newPassword")}</Label>
        <input className="field" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </div>
      {err && <div style={{ color: "var(--gameloop)", fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ color: "var(--content)", fontSize: 13 }}>{msg}</div>}
      <button className="btn btn-primary" disabled={busy || !cur || !next} style={{ justifyContent: "center" }}>
        {t("settings.changePassword")}
      </button>
    </form>
  );
}

function AiSection() {
  const { t } = useT();
  const [provider, setProvider] = useState("claude-cli");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [openaiModel, setOpenaiModel] = useState("");
  const [bin, setBin] = useState("claude");
  const [claudeModel, setClaudeModel] = useState("");
  const [models, setModels] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then(({ ai }) => {
      setProvider(ai.provider);
      setBaseUrl(ai.openai.baseUrl || "");
      setOpenaiModel(ai.openai.model || "");
      setHasKey(!!ai.openai.hasKey);
      setBin(ai.claudeCli.bin || "claude");
      setClaudeModel(ai.claudeCli.model || "");
    }).catch(() => {});
  }, []);

  // Build the ai payload from the form. Omit apiKey when empty so the server keeps the stored one.
  function formAi() {
    const ai = { provider, claudeCli: { bin, model: claudeModel }, openai: { baseUrl, model: openaiModel } };
    if (apiKey) ai.openai.apiKey = apiKey;
    return ai;
  }

  async function loadModels() {
    setErr(""); setMsg(""); setBusy(true);
    try { setModels((await api.pullModels(formAi())).models || []); }
    catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  async function save() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const { ai } = await api.saveSettings(formAi());
      setHasKey(!!ai.openai.hasKey);
      setApiKey("");
      setMsg(t("settings.saved"));
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  async function test() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      const r = await api.testAi(formAi());
      setMsg(r.ok ? t("settings.testOk") : String(r.text || ""));
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  const isClaude = provider === "claude-cli";

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Label>{t("settings.provider")}</Label>
        <label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={isClaude} onChange={() => setProvider("claude-cli")} />
          {t("settings.providerClaude")}
        </label>
        <label style={{ display: "flex", gap: 9, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={!isClaude} onChange={() => setProvider("openai")} />
          {t("settings.providerOpenai")}
        </label>
      </div>

      {isClaude ? (
        <div style={{ color: "var(--text-faint)", fontSize: 12.5, lineHeight: 1.5 }}>{t("settings.claudeNote")}</div>
      ) : (
        <>
          <div>
            <Label>{t("settings.baseUrl")}</Label>
            <input className="field" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
          </div>
          <div>
            <Label>{t("settings.apiKey")} {hasKey && <span style={{ color: "var(--content)" }}>· {t("settings.apiKeySet")}</span>}</Label>
            <input className="field" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={t("settings.apiKeyKeep")} autoComplete="off" />
          </div>
        </>
      )}

      <div>
        <Label>{t("settings.model")} <span style={{ color: "var(--text-faint)" }}>· {t("settings.modelManual")}</span></Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="field" list="gs-ai-models"
            value={isClaude ? claudeModel : openaiModel}
            onChange={(e) => (isClaude ? setClaudeModel : setOpenaiModel)(e.target.value)}
            placeholder={isClaude ? "claude-opus-4-8" : "openai/gpt-4o-mini"} />
          <datalist id="gs-ai-models">{models.map((m) => <option key={m} value={m} />)}</datalist>
          <button type="button" className="btn" style={{ whiteSpace: "nowrap" }} disabled={busy} onClick={loadModels}>
            {t("settings.loadModels")}
          </button>
        </div>
      </div>

      {err && <div style={{ color: "var(--gameloop)", fontSize: 13 }}>{err}</div>}
      {msg && <div style={{ color: "var(--content)", fontSize: 13 }}>{msg}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" disabled={busy} style={{ justifyContent: "center" }} onClick={save}>
          {t("settings.save")}
        </button>
        <button className="btn" disabled={busy} onClick={test}>
          {busy ? t("settings.testing") : t("settings.test")}
        </button>
      </div>
    </div>
  );
}

function AgentsSection() {
  const { t } = useT();
  const [agents, setAgents] = useState(null);
  const [mode, setMode] = useState({}); // id -> chosen mode
  const [hours, setHours] = useState({}); // id -> hours for timed
  const [scope, setScope] = useState({}); // id -> read | write

  const refresh = () => api.agents().then((r) => setAgents(r.agents)).catch(() => setAgents([]));
  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000); // catch new requests while the panel is open
    return () => clearInterval(iv);
  }, []);

  async function accept(a) {
    const m = mode[a.id] || "infinite";
    await api.approveAgent(a.id, m, Number(hours[a.id]) || 24, scope[a.id] || "read");
    refresh();
  }

  function expiryLabel(a) {
    if (a.status !== "active") return "";
    if (a.mode === "infinite") return t("agents.expiresInfinite");
    if (a.mode === "until-restart") return t("agents.expiresUntilRestart");
    return t("agents.expiresAt", { when: new Date(a.expiresAt).toLocaleString() });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{t("agents.intro")}</p>
      {agents && agents.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>{t("agents.none")}</div>}
      <div style={{ display: "grid", gap: 10 }}>
        {(agents || []).map((a) => (
          <div key={a.id} style={{ padding: 12, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", display: "grid", gap: 9 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="dot" style={{ color: a.status === "active" ? "var(--content)" : a.status === "denied" ? "var(--gameloop)" : "var(--side)", background: a.status === "active" ? "var(--content)" : a.status === "denied" ? "var(--gameloop)" : "var(--side)" }} />
              <strong style={{ fontSize: 14 }}>{a.label}</strong>
              <span className="mono" style={{ marginLeft: "auto" }}>
                {t(`agents.status${a.status[0].toUpperCase()}${a.status.slice(1)}`)}
                {a.status === "active" && ` · ${a.scope === "write" ? t("agents.write") : t("agents.read")}`} {expiryLabel(a)}
              </span>
            </div>
            {a.status === "pending" && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select className="field" style={{ width: "auto" }} value={scope[a.id] || "read"} onChange={(e) => setScope((s) => ({ ...s, [a.id]: e.target.value }))} title={t("agents.scope")}>
                  <option value="read">{t("agents.read")}</option>
                  <option value="write">{t("agents.write")}</option>
                </select>
                <select className="field" style={{ width: "auto" }} value={mode[a.id] || "infinite"} onChange={(e) => setMode((s) => ({ ...s, [a.id]: e.target.value }))}>
                  <option value="infinite">{t("agents.infinite")}</option>
                  <option value="timed">{t("agents.timed")}</option>
                  <option value="until-restart">{t("agents.untilRestart")}</option>
                </select>
                {(mode[a.id] || "infinite") === "timed" && (
                  <input className="field" type="number" min="1" style={{ width: 90 }} placeholder={t("agents.hours")}
                    value={hours[a.id] ?? 24} onChange={(e) => setHours((s) => ({ ...s, [a.id]: e.target.value }))} />
                )}
                <button className="btn btn-primary" onClick={() => accept(a)}>{t("agents.accept")}</button>
                <button className="btn btn-ghost" onClick={async () => { await api.denyAgent(a.id); refresh(); }}>{t("agents.deny")}</button>
              </div>
            )}
            {a.status !== "pending" && (
              <div>
                <button className="btn btn-ghost" onClick={async () => { await api.revokeAgent(a.id); refresh(); }}>{t("agents.revoke")}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HowtoSection({ slug }) {
  const { t } = useT();
  const [copied, setCopied] = useState("");
  const base = window.location.origin;
  const s = slug || "<slug>";

  const rows = [
    [t("howto.exportJson"), `${base}/api/projects/${s}/export.json`],
    [t("howto.exportMd"), `${base}/api/projects/${s}/export.md`],
    [t("howto.subtreeJson"), `${base}/api/projects/${s}/nodes/<id>/subtree.json`],
    [t("howto.subtreeMd"), `${base}/api/projects/${s}/nodes/<id>/subtree.md`],
  ];

  async function copy(url) {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(""), 1500); }
    catch { /* ignore */ }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, margin: 0, lineHeight: 1.6 }}>{t("howto.intro")}</p>
      {!slug && <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>{t("howto.openProject")}</div>}

      <div>
        <Label>{t("howto.endpoints")}</Label>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map(([label, url]) => (
            <div key={url} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{label}</div>
                <div className="mono" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text)" }}>{url}</div>
              </div>
              <button className="btn btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => copy(url)}>
                {copied === url ? t("howto.copied") : t("howto.copy")}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label>{t("howto.exampleTitle")}</Label>
        <pre style={{ margin: 0, background: "rgba(0,0,0,0.35)", padding: 12, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "auto", fontFamily: "var(--font-mono)", fontSize: 11.5, lineHeight: 1.6 }}>
{`# 1) agent requests pairing -> you Accept it in the Agents tab
curl -s -X POST ${base}/api/pair/request \\
  -H "Content-Type: application/json" -d '{"label":"claude"}'
# -> {"id":"...","token":"..."}

# 2) once accepted, read the whole GDD with the token:
curl -s -H "Authorization: Bearer <token>" \\
  ${base}/api/projects/${s}/export.md`}
        </pre>
      </div>

      <div style={{ color: "var(--text-faint)", fontSize: 12 }}>{t("howto.repoNote")}</div>
    </div>
  );
}
