import { useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";
import TreeNode from "./TreeNode.jsx";

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

function descendantIds(nodes, id) {
  const out = new Set();
  const walk = (pid) => { for (const n of nodes) if (n.parent === pid && !out.has(n.id)) { out.add(n.id); walk(n.id); } };
  walk(id);
  return out;
}

// One category column: its header is a drop target — dropping a node here un-nests it to top level.
function CategorySection({ cat, roots, slug, selectedId, onSelect, onChanged, onAddRoot, t }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${cat.slug}` });
  const items = roots[cat.slug] || [];
  return (
    <section style={{ marginBottom: 20 }}>
      <div ref={setNodeRef}
        style={{
          display: "flex", alignItems: "center", gap: 9, marginBottom: 8, padding: "4px 6px",
          borderRadius: 8, outline: isOver ? `1.5px dashed ${cat.color}` : "1.5px dashed transparent",
          background: isOver ? "var(--surface-2)" : "transparent", transition: "background .15s",
        }}>
        <span className="dot" style={{ color: cat.color, background: cat.color }} />
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 12.5, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--text-dim)" }}>
          {cat.label}
        </strong>
        <button className="btn btn-ghost btn-icon" style={{ marginLeft: "auto", fontSize: 15 }} title={t("tree.addToPillar", { pillar: cat.label })} onClick={() => onAddRoot(cat.slug)}>＋</button>
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--text-faint)", fontSize: 12.5, paddingLeft: 18, opacity: 0.6 }}>{t("tree.empty")}</div>
      ) : (
        items.map((n) => (
          <TreeNode key={n.id} node={n} depth={0} slug={slug} pillarColor={cat.color}
            selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} />
        ))
      )}
    </section>
  );
}

export default function Tree({ project, selectedId, onSelect, onChanged }) {
  const { t } = useT();
  const cats = project.categories?.length ? project.categories : DEFAULT_CATEGORIES;
  const roots = useMemo(() => nest(project.nodes), [project.nodes]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function addRoot(pillar) {
    const n = await api.createNode(project.slug, { pillar, title: t("tree.newIdea") });
    onSelect(n.id); onChanged();
  }

  function endOrder(filterFn) {
    const sibs = project.nodes.filter(filterFn);
    return sibs.length ? Math.max(...sibs.map((s) => s.order ?? 0)) + 1 : 0;
  }

  async function onDragEnd(e) {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);

    // Drop on a category header -> un-nest to top level of that category.
    if (overId.startsWith("cat:")) {
      const pillar = overId.slice(4);
      const node = project.nodes.find((n) => n.id === active.id);
      if (!node) return;
      if (node.parent === null && node.pillar === pillar) return; // already a root there
      const order = endOrder((n) => !n.parent && n.pillar === pillar && n.id !== active.id);
      await api.updateNode(project.slug, active.id, { parent: null, pillar, order });
      onChanged();
      return;
    }

    // Drop on a node -> become its child (unless self / own descendant).
    if (active.id === overId) return;
    if (descendantIds(project.nodes, active.id).has(overId)) return;
    if (!project.nodes.find((n) => n.id === overId)) return;
    const order = endOrder((n) => n.parent === overId && n.id !== active.id);
    await api.updateNode(project.slug, active.id, { parent: overId, order });
    onChanged();
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {cats.map((cat) => (
        <CategorySection key={cat.slug} cat={cat} roots={roots} slug={project.slug}
          selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} onAddRoot={addRoot} t={t} />
      ))}
    </DndContext>
  );
}
