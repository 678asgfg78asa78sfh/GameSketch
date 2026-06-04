import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import Tree from "../components/Tree.jsx";
import NodeEditor from "../components/NodeEditor.jsx";

const PILLARS = [
  ["Gameloop", "--gameloop"], ["Grafik", "--artstyle"], ["Inhalt", "--content"],
  ["Stränge", "--threads"], ["Scope", "--scope"],
];

export default function Project({ slug, me, onBack }) {
  const [project, setProject] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const reload = useCallback(async () => setProject(await api.project(slug)), [slug]);
  useEffect(() => { reload(); }, [reload]);

  if (!project)
    return <div className="mono" style={{ display: "grid", placeItems: "center", height: "100%" }}>lädt …</div>;

  const selected = project.nodes.find((n) => n.id === selectedId) || null;

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 14, padding: 14 }}>
      <header className="glass" style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Projekte</button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{project.title}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, color: "var(--text-faint)", fontSize: 12, flexWrap: "wrap" }}>
          {PILLARS.map(([l, c]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ color: `var(${c})`, background: `var(${c})` }} />{l}
            </span>
          ))}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 380px) 1fr", gap: 14, minHeight: 0 }}>
        <aside className="glass" style={{ overflow: "auto", padding: 16 }}>
          <Tree project={project} selectedId={selectedId} onSelect={setSelectedId} onChanged={reload} />
        </aside>
        <main className="glass" style={{ overflow: "auto" }}>
          {selected ? (
            <NodeEditor key={selected.id} slug={slug} node={selected} onChanged={reload} />
          ) : (
            <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--text-faint)", textAlign: "center", padding: 40 }}>
              <div>
                <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.8 }}>✦</div>
                Wähle links einen Knoten — oder klick <b style={{ color: "var(--text-dim)" }}>＋</b> an einer Säule,<br />um eine Idee reinzubuttern.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
