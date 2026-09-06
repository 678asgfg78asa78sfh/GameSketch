import { useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import { api } from "../api.js";
import StatusBadge from "./StatusBadge.jsx";
import ProgressBadge, { PROGRESS_CYCLE } from "./ProgressBadge.jsx";
import MarkdownView from "./MarkdownView.jsx";
import Attachments from "./Attachments.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import AssistPanel from "./AssistPanel.jsx";
import { useT } from "../i18n/index.jsx";
import { useAutosave, flushAll } from "../useAutosave.js";
import { errorText } from "../ui.js";
import { linkedIds } from "../nodeLinks.js";
import LinkTextarea from "./LinkTextarea.jsx";
import NodeActions from "./NodeActions.jsx";
import NodeTracker from "./NodeTracker.jsx";
import { NodeMedia } from "./DocumentReader.jsx";

// Excalidraw is heavy (~3MB) — only load it when the canvas tab is opened.
const CanvasPane = lazy(() => import("./CanvasPane.jsx"));

const STATUS_CYCLE = { core: "side", side: "future", future: "core" };
const TABS = ["edit", "preview", "canvas", "history", "assist"];

export default function NodeEditor({ slug, node, project, userName, onNavigate, onChanged, maximized, onToggleMaximize, preferredTab = "edit" }) {
  const { t } = useT();
  const [title, setTitle] = useState(node.title);
  const [body, setBody] = useState(node.body || "");
  const [tab, setTab] = useState(preferredTab);
  useEffect(() => { setTab(preferredTab); }, [preferredTab]);
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const dirtyFields = useRef({});
  const draftKey = `gs_draft_${userName}_${slug}_${node.id}`;
  const [draft, setDraft] = useState(() => { try { return JSON.parse(localStorage.getItem(draftKey)) || null; } catch { return null; } });
  const { saved, error, queue: queueSave, flush } = useAutosave(async (patch) => {
    await api.updateNode(slug, node.id, patch);
    for (const [key, value] of Object.entries(patch)) if (dirtyFields.current[key] === value) delete dirtyFields.current[key];
    try {
      const pending = JSON.parse(localStorage.getItem(draftKey)) || {};
      for (const [key, value] of Object.entries(patch)) if (pending[key] === value) delete pending[key];
      if (Object.keys(pending).length) localStorage.setItem(draftKey, JSON.stringify(pending));
      else localStorage.removeItem(draftKey);
    } catch { /* browser storage unavailable */ }
    await onChanged();
  });
  function edit(patch) {
    Object.assign(dirtyFields.current, patch);
    if (patch.title !== undefined) setTitle(patch.title);
    if (patch.body !== undefined) setBody(patch.body);
    try { localStorage.setItem(draftKey, JSON.stringify({ ...JSON.parse(localStorage.getItem(draftKey) || "{}"), ...patch })); } catch { /* best effort */ }
    queueSave(patch);
  }
  useEffect(() => {
    const saveKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); flushAll().catch((e) => setActionError(errorText(e, t))); } };
    window.addEventListener("keydown", saveKey); return () => window.removeEventListener("keydown", saveKey);
  }, [t]);

  useEffect(() => {
    if (!Object.hasOwn(dirtyFields.current, "title")) setTitle(node.title);
    if (!Object.hasOwn(dirtyFields.current, "body")) setBody(node.body || "");
  }, [node.title, node.body]);

  async function runAction(action) {
    if (actionBusy) return;
    setActionBusy(true); setActionError("");
    try { await flushAll(); const result = await action(); await onChanged(result?.action); return result; }
    catch (e) { setActionError(errorText(e, t)); }
    finally { setActionBusy(false); }
  }
  function cycleStatus() { return runAction(() => api.updateNode(slug, node.id, { status: STATUS_CYCLE[node.status] })); }
  function cycleProgress() { return runAction(() => api.updateNode(slug, node.id, { progress: PROGRESS_CYCLE[node.progress || "new"] })); }
  function setKind(kind) { return runAction(() => api.updateNode(slug, node.id, { kind })); }
  function del() { if (confirm(t("qol.deleteConfirm", { title }))) return runAction(() => api.deleteNode(slug, node.id)); }
  async function selectTab(next) {
    try { await flushAll(); setTab(next); }
    catch { /* keep the editor open so the failed save can be retried */ }
  }

  const ancestors = [], seen = new Set([node.id]);
  let parentNode = project.nodes.find((n) => n.id === node.parent);
  while (parentNode && !seen.has(parentNode.id)) { seen.add(parentNode.id); ancestors.unshift(parentNode); parentNode = project.nodes.find((n) => n.id === parentNode.parent); }
  const backlinks = useMemo(() => project.nodes.filter((n) => n.id !== node.id && linkedIds(n.body).has(node.id)), [project.nodes, node.id]);
  return (
    <div className="node-editor" style={{ padding: maximized ? "28px 40px" : 28, maxWidth: "100%", margin: "0 auto" }}>
      <nav className="toolbar breadcrumbs" aria-label={t("qol.breadcrumb")}><span className="muted">{project.categories.find((c) => c.slug === node.pillar)?.label}</span>{ancestors.map((n) => <span key={n.id}> › <button className="btn btn-ghost" onClick={() => onNavigate(n.id)}>{n.title}</button></span>)}</nav>
      {draft && <div className="notice" role="status">{t("qol.draft")} <button className="btn btn-ghost" onClick={() => { edit(draft); setDraft(null); }}>{t("qol.recoverDraft")}</button><button className="btn btn-ghost" onClick={() => { localStorage.removeItem(draftKey); setDraft(null); }}>{t("qol.discardDraft")}</button></div>}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 11, marginBottom: 16 }}>
        <StatusBadge status={node.status} onClick={tab === "edit" ? cycleStatus : undefined} />
        {tab === "edit" ? <select className="field" disabled={actionBusy} style={{ width: "auto", padding: "7px 28px 7px 11px" }} value={node.kind} onChange={(e) => setKind(e.target.value)}>
          <option value="idea">{t("editor.kindIdea")}</option>
          <option value="alternative">{t("editor.kindAlternative")}</option>
          <option value="note">{t("editor.kindNote")}</option>
        </select> : <small className="muted">{t(`editor.${node.kind === "alternative" ? "kindAlternative" : node.kind === "note" ? "kindNote" : "kindIdea"}`)}</small>}
        <ProgressBadge progress={node.progress || "new"} onClick={tab === "edit" && !node.tracking?.enabled ? cycleProgress : undefined} />
        <span className="mono" style={{ marginLeft: 4, color: saved ? "var(--content)" : "var(--text-faint)" }}>
          {error ? t("editor.saveFailed") : saved ? t("editor.saved") : t("editor.saving")}
        </span>
        {onToggleMaximize && (
          <button className="btn btn-ghost btn-icon" style={{ marginLeft: "auto" }} onClick={onToggleMaximize}
            title={maximized ? t("editor.restore") : t("editor.maximize")}>
            {maximized ? "🗗" : "⛶"}
          </button>
        )}
        {tab === "edit" && <button className="btn btn-ghost" disabled={actionBusy} style={{ marginLeft: onToggleMaximize ? 0 : "auto" }} onClick={del}>{t("editor.delete")}</button>}
      </div>

      {(error || actionError) && <div role="alert" style={{ color: "var(--gameloop)", marginBottom: 12 }}>
        {error?.message || actionError}
        {error && <button className="btn btn-ghost" onClick={() => flush().catch(() => {})}>{t("common.retry")}</button>}
      </div>}

      {tab === "edit" ? <input aria-label={t("editor.titlePlaceholder")} value={title} disabled={actionBusy} onChange={(e) => edit({ title: e.target.value })}
        placeholder={t("editor.titlePlaceholder")}
        style={{ width: "100%", fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", border: "none", background: "transparent", color: "var(--text)", padding: 0, outline: "none" }} /> : <h1 className="node-view-title">{title}</h1>}

      {tab === "edit" && <NodeActions project={project} node={node} runAction={runAction} onNavigate={onNavigate} disabled={actionBusy} />}
      <div className="tabs" style={{ width: "fit-content", maxWidth: "100%", overflowX: "auto", margin: "20px 0" }}>
        {TABS.map((tb) => (
          <button key={tb} disabled={actionBusy} className={`tab ${tab === tb ? "active" : ""}`} onClick={() => selectTab(tb)}>{t(`editor.tabs.${tb}`)}</button>
        ))}
      </div>

      {["edit", "preview"].includes(tab) && <NodeTracker slug={slug} node={node} project={project} busy={actionBusy} error={actionError} runAction={runAction} onNavigate={onNavigate} />}

      {tab === "edit" && (
        <>
          <LinkTextarea className="field" disabled={actionBusy} value={body} nodes={project.nodes} onChange={(body) => edit({ body })}
            placeholder={t("editor.bodyPlaceholder")}
            style={{ minHeight: 320, resize: "vertical", lineHeight: 1.7, fontFamily: "var(--font-body)" }} />
          <Attachments slug={slug} node={node} onChanged={onChanged} />
        </>
      )}
      {tab === "preview" && <><MarkdownView text={body} nodes={project.nodes} slug={slug} onNavigate={onNavigate} /><NodeMedia slug={slug} node={node} /></>}
      {tab === "canvas" && (
        <Suspense fallback={<div className="mono">{t("editor.canvasEngineLoading")}</div>}>
          <CanvasPane slug={slug} node={node} maximized={maximized} />
        </Suspense>
      )}
      {tab === "history" && <HistoryPanel slug={slug} node={node} onChanged={onChanged} />}
      {tab === "assist" && <AssistPanel slug={slug} node={node} onChanged={onChanged} />}
      <section style={{ marginTop: 28 }}><strong>{t("qol.backlinks")}</strong><div className="toolbar">{backlinks.map((n) => <button className="btn btn-ghost" key={n.id} onClick={() => onNavigate(n.id)}>{n.title}</button>)}{!backlinks.length && <small className="muted">{t("qol.noBacklinks")}</small>}</div></section>
    </div>
  );
}
