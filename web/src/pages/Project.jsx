import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api.js";
import Tree from "../components/Tree.jsx";
import NodeEditor from "../components/NodeEditor.jsx";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";

export default function Project({ slug, me, onBack }) {
  const { t } = useT();
  const { setWork, reloadKey } = useWork();
  const [project, setProject] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [sideW, setSideW] = useState(() => { try { return Number(localStorage.getItem("gs_sidebar_w")) || 340; } catch { return 340; } });
  const splitter = useRef(null);

  const reload = useCallback(async () => setProject(await api.project(slug)), [slug]);
  // reload on mount and whenever the copilot reports it changed the design (reloadKey)
  useEffect(() => { reload(); }, [reload, reloadKey]);
  // let the copilot see which node is open
  useEffect(() => { setWork({ slug, nodeId: selectedId }); }, [slug, selectedId, setWork]);
  useEffect(() => { try { localStorage.setItem("gs_sidebar_w", String(sideW)); } catch { /* ignore */ } }, [sideW]);

  const onSplitMove = useCallback((e) => {
    const d = splitter.current; if (!d) return;
    setSideW(Math.min(Math.max(240, d.ow + e.clientX - d.sx), 640));
  }, []);
  const onSplitUp = useCallback(() => { splitter.current = null; window.removeEventListener("pointermove", onSplitMove); window.removeEventListener("pointerup", onSplitUp); }, [onSplitMove]);
  const startSplit = (e) => { e.preventDefault(); splitter.current = { sx: e.clientX, ow: sideW }; window.addEventListener("pointermove", onSplitMove); window.addEventListener("pointerup", onSplitUp); };

  if (!project)
    return <div className="mono" style={{ display: "grid", placeItems: "center", height: "100%" }}>{t("common.loading")}</div>;

  const selected = project.nodes.find((n) => n.id === selectedId) || null;

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 14, padding: 14 }}>
      <header className="glass" style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px" }}>
        <button className="btn btn-ghost" onClick={onBack}>{t("project.back")}</button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{project.title}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, color: "var(--text-faint)", fontSize: 12, flexWrap: "wrap" }}>
          {(project.categories || DEFAULT_CATEGORIES).map((cat) => (
            <span key={cat.slug} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ color: cat.color, background: cat.color }} />{cat.label}
            </span>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: `${sideW}px 8px 1fr`, gap: 8, minHeight: 0 }}>
        <aside className="glass" style={{ overflow: "auto", padding: 16 }}>
          <Tree project={project} selectedId={selectedId} onSelect={setSelectedId} onChanged={reload} />
        </aside>
        <div onPointerDown={startSplit} title="⇔" style={{ cursor: "col-resize", display: "grid", placeItems: "center", touchAction: "none" }}>
          <div style={{ width: 3, height: 44, borderRadius: 3, background: "var(--border-strong)" }} />
        </div>
        <main className="glass" style={{ overflow: "auto" }}>
          {selected ? (
            <NodeEditor key={selected.id} slug={slug} node={selected} onChanged={reload} />
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
    </div>
  );
}
