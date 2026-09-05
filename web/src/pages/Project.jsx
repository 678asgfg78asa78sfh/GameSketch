import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api.js";
import Tree from "../components/Tree.jsx";
import NodeEditor from "../components/NodeEditor.jsx";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";
import { flushAll } from "../useAutosave.js";
import { downloadUrl, errorText } from "../ui.js";
import DocumentReader from "../components/DocumentReader.jsx";
import WorkspacePanel from "../components/WorkspacePanel.jsx";
import TemplateDialog from "../components/TemplateDialog.jsx";

export default function Project({ slug, me, onBack }) {
  const { t } = useT();
  const { setWork, reloadKey, layoutTick } = useWork();
  const [project, setProject] = useState(null);
  const [view, setView] = useState("editor"), [error, setError] = useState(""), [notice, setNotice] = useState(null);
  const [templateOpen, setTemplateOpen] = useState(false), [busy, setBusy] = useState(false);
  // restore the previously open node so a refresh reopens it
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(`gs_sel_${slug}`) || null; } catch { return null; }
  });
  const [sideW, setSideW] = useState(() => { try { return Number(localStorage.getItem("gs_sidebar_w")) || 340; } catch { return 340; } });
  const [maximized, setMaximized] = useState(false);
  const splitter = useRef(null);
  const reloadVersion = useRef(0);

  const reload = useCallback(async (action) => {
    const version = ++reloadVersion.current;
    try { const next = await api.project(slug); if (version === reloadVersion.current) { setProject(next); setError(""); } if (action?.id) setNotice(action); }
    catch (e) { if (version === reloadVersion.current) setError(errorText(e, t)); }
  }, [slug, t]);
  async function navigate(id) {
    try { await flushAll(); setSelectedId(id); setView("editor"); setError(""); }
    catch (e) { setError(errorText(e, t)); }
  }
  async function changeView(next) {
    try { await flushAll(); await reload(); setView(next); setMaximized(false); }
    catch (e) { setError(errorText(e, t)); }
  }
  async function back() { try { await flushAll(); onBack(); } catch (e) { setError(errorText(e, t)); } }
  async function backup() {
    setBusy(true); setError("");
    try { await flushAll(); await downloadUrl(`/api/projects/${slug}/backup`, `${slug}.gamesketch`); }
    catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }
  async function undo() {
    setBusy(true); setError("");
    try { await flushAll(); await api.undoAction(slug, notice.id); setNotice(null); await reload(); }
    catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }
  // reload on mount and whenever the copilot reports it changed the design (reloadKey)
  useEffect(() => { reload(); }, [reload, reloadKey]);
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setMaximized(false); requestAnimationFrame(() => document.querySelector("[data-project-search]")?.focus()); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);
  // remember which node is open per project
  useEffect(() => {
    try { selectedId ? localStorage.setItem(`gs_sel_${slug}`, selectedId) : localStorage.removeItem(`gs_sel_${slug}`); } catch { /* ignore */ }
  }, [slug, selectedId]);
  // let the copilot see which node is open (slug + node id + title)
  useEffect(() => {
    const sel = project?.nodes.find((n) => n.id === selectedId);
    setWork({ slug, nodeId: selectedId, nodeTitle: sel?.title || null });
  }, [slug, selectedId, project, setWork]);
  useEffect(() => { try { localStorage.setItem("gs_sidebar_w", String(sideW)); } catch { /* ignore */ } }, [sideW]);
  // re-read sidebar width when a saved layout is applied or reset
  useEffect(() => { try { setSideW(Number(localStorage.getItem("gs_sidebar_w")) || 340); } catch { /* ignore */ } }, [layoutTick]);
  // Esc exits the maximized editor
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e) => { if (e.key === "Escape") setMaximized(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximized]);

  const onSplitMove = useCallback((e) => {
    const d = splitter.current; if (!d) return;
    setSideW(Math.min(Math.max(240, d.ow + e.clientX - d.sx), 640));
  }, []);
  const onSplitUp = useCallback(() => { splitter.current = null; window.removeEventListener("pointermove", onSplitMove); window.removeEventListener("pointerup", onSplitUp); }, [onSplitMove]);
  useEffect(() => () => onSplitUp(), [onSplitUp]);
  const startSplit = (e) => { e.preventDefault(); splitter.current = { sx: e.clientX, ow: sideW }; window.addEventListener("pointermove", onSplitMove); window.addEventListener("pointerup", onSplitUp); };

  if (!project)
    return <div className="workspace-pane">{error ? <div role="alert" className="error">{error}<button className="btn" onClick={() => reload()}>{t("qol.retry")}</button><button className="btn" onClick={onBack}>{t("project.back")}</button></div> : t("common.loading")}</div>;

  const selected = project.nodes.find((n) => n.id === selectedId) || null;
  const editorMaximized = maximized && !!selected && view === "editor";

  return (
    <div className="project-shell" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
      <header className="glass project-header toolbar" style={{ gap: 16, padding: "12px 16px" }}>
        <button className="btn btn-ghost" onClick={back}>{t("project.back")}</button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{project.title}</div>
        <nav className="toolbar" style={{ marginLeft: "auto" }}>{["editor", "reader", "trash", "activity"].map((key) => <button key={key} className={`btn ${view === key ? "btn-primary" : "btn-ghost"}`} aria-pressed={view === key} onClick={() => changeView(key)}>{t(`qol.${key}`)}</button>)}<button className="btn" disabled={busy} onClick={backup} title={t("qol.backupHint")}>{t("qol.backup")}</button></nav>
      </header>
      {error && <div role="alert" className="error">{error} <button className="btn btn-ghost" onClick={() => reload()}>{t("qol.retry")}</button><button className="btn btn-ghost" onClick={() => setError("")}>{t("qol.close")}</button></div>}
      {notice && <div className="toolbar notice" role="status"><span>{t(`qol.kinds.${notice.kind}`)}</span><button className="btn btn-ghost" disabled={busy} onClick={undo}>{t("qol.undo")}</button><button className="btn btn-ghost" style={{ marginLeft: "auto" }} aria-label={t("qol.close")} onClick={() => setNotice(null)}>✕</button></div>}

      <div className="project-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: editorMaximized ? "minmax(0, 1fr)" : `${sideW}px 8px minmax(0, 1fr)`, gap: editorMaximized ? 0 : 8, minHeight: 0 }}>
        <aside className="glass" style={{ display: editorMaximized ? "none" : undefined, overflow: "auto", padding: 16 }}>
          <button className="btn" style={{ width: "100%", marginBottom: 12 }} onClick={async () => { try { await flushAll(); setTemplateOpen(true); } catch (e) { setError(errorText(e, t)); } }}>{t("qol.addTemplate")}</button>
          <Tree project={project} selectedId={selectedId} onSelect={navigate} onChanged={reload} onError={(e) => setError(errorText(e, t))} />
          <small className="muted">{t("qol.shortcuts")}</small>
        </aside>
        <div className="project-splitter" onPointerDown={startSplit} title="⇔" style={{ cursor: "col-resize", display: editorMaximized ? "none" : "grid", placeItems: "center", touchAction: "none" }}>
          <div style={{ width: 3, height: 44, borderRadius: 3, background: "var(--border-strong)" }} />
        </div>
        <main className="glass" style={{ overflow: "auto" }}>
          {view === "reader" ? <DocumentReader project={project} onNavigate={navigate} /> : ["trash", "activity"].includes(view) ? <WorkspacePanel key={view + reloadKey} slug={slug} mode={view} onChanged={reload} onNavigate={navigate} /> : selected ? (
            <NodeEditor key={selected.id} slug={slug} node={selected} project={project} userName={me.name} onNavigate={navigate} onChanged={reload}
              maximized={editorMaximized} onToggleMaximize={() => setMaximized((m) => !m)} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-faint)", textAlign: "center", padding: 40 }}>
              <div>
                <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.8 }}>✦</div>
                {t("project.emptyHint")}
              </div>
            </div>
          )}
        </main>
      </div>
      {templateOpen && <TemplateDialog project={project} onClose={() => setTemplateOpen(false)} onCreated={async (n) => { await reload(n.action); await navigate(n.id); }} />}
    </div>
  );
}
