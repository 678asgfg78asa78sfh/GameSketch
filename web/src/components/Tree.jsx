import { useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { api } from "../api.js";
import TreeNode from "./TreeNode.jsx";

const PILLARS = [
  ["gameloop", "Gameloop", "--gameloop"],
  ["artstyle", "Grafikstil", "--artstyle"],
  ["content", "Inhalt", "--content"],
  ["threads", "Stränge", "--threads"],
  ["scope", "Scope", "--scope"],
];

function nest(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = {};
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else (roots[n.pillar] ||= []).push(n);
  }
  for (const arr of Object.values(roots)) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return roots;
}

export default function Tree({ project, selectedId, onSelect, onChanged }) {
  const roots = useMemo(() => nest(project.nodes), [project.nodes]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function addRoot(pillar) {
    const n = await api.createNode(project.slug, { pillar, title: "Neue Idee" });
    onSelect(n.id); onChanged();
  }

  async function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const target = project.nodes.find((n) => n.id === over.id);
    if (!target) return;
    await api.updateNode(project.slug, active.id, { parent: target.parent ?? null, order: (target.order ?? 0) + 1 });
    onChanged();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {PILLARS.map(([slug, label, cvar]) => (
        <section key={slug} style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <span className="dot" style={{ color: `var(${cvar})`, background: `var(${cvar})` }} />
            <strong style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-dim)" }}>
              {label}
            </strong>
            <button className="btn btn-ghost btn-icon" style={{ marginLeft: "auto", fontSize: 15 }} title={`Idee zu „${label}"`} onClick={() => addRoot(slug)}>＋</button>
          </div>
          {(roots[slug] || []).length === 0 ? (
            <div style={{ color: "var(--text-faint)", fontSize: 12.5, paddingLeft: 18, opacity: 0.6 }}>leer</div>
          ) : (
            (roots[slug] || []).map((n) => (
              <TreeNode key={n.id} node={n} depth={0} slug={project.slug} pillarVar={cvar}
                selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} />
            ))
          )}
        </section>
      ))}
    </DndContext>
  );
}
