import { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, useDroppable } from "@dnd-kit/core";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";
import TreeNode from "./TreeNode.jsx";
import { searchNodes } from "../nodeLinks.js";
import { flushAll } from "../useAutosave.js";
import ProgressMeter from "./ProgressMeter.jsx";
import { trackingProgress } from "../../../shared/tracking.js";

function nest(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = {};
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else (roots[n.pillar] ||= []).push(n);
  }
  const sort = (items) => {
    items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    items.forEach((node) => sort(node.children));
  };
  Object.values(roots).forEach(sort);
  return roots;
}

function descendantIds(nodes, id) {
  const out = new Set();
  const walk = (pid) => { for (const n of nodes) if (n.parent === pid && !out.has(n.id)) { out.add(n.id); walk(n.id); } };
  walk(id);
  return out;
}

// One category column: its header is a drop target — dropping a node here un-nests it to top level.
function CategorySection({ cat, roots, slug, selectedId, onSelect, onChanged, onAddRoot, onError, t }) {
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
            selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} onError={onError} />
        ))
      )}
    </section>
  );
}

export default function Tree({ project, selectedId, onSelect, onChanged, onError }) {
  const { t } = useT();
  const cats = project.categories?.length ? project.categories : DEFAULT_CATEGORIES;
  const roots = useMemo(() => nest(project.nodes), [project.nodes]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const [query, setQuery] = useState(""), [progress, setProgress] = useState(""), [status, setStatus] = useState("");
  const filtering = query.trim() || progress || status;
  const results = useMemo(() => searchNodes(project.nodes, query, { progress, status }), [project.nodes, query, progress, status]);

  async function addRoot(pillar) {
    try { await flushAll(); const n = await api.createNode(project.slug, { pillar, title: t("tree.newIdea") });
      await onChanged(n.action); onSelect(n.id);
    } catch (e) { onError(e); }
  }

  function endOrder(filterFn) {
    const sibs = project.nodes.filter(filterFn);
    return sibs.length ? Math.max(...sibs.map((s) => s.order ?? 0)) + 1 : 0;
  }

  async function onDragEnd(e) {
    await flushAll();
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
      const result = await api.updateNode(project.slug, active.id, { parent: null, pillar, order });
      onChanged(result.action);
      return;
    }

    // Drop on a node -> become its child (unless self / own descendant).
    if (active.id === overId) return;
    if (descendantIds(project.nodes, active.id).has(overId)) return;
    if (!project.nodes.find((n) => n.id === overId)) return;
    const order = endOrder((n) => n.parent === overId && n.id !== active.id);
    const result = await api.updateNode(project.slug, active.id, { parent: overId, order });
    onChanged(result.action);
  }

  return (
    <><div className="search-controls"><input className="field" data-project-search type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("qol.search")} aria-label={t("qol.search")} title={t("qol.searchHint")} onKeyDown={(e) => { if (e.key === "Escape") { setQuery(""); setProgress(""); setStatus(""); } if (e.key === "Enter" && results[0]) onSelect(results[0].id); }} />
      <div className="toolbar"><select className="field" aria-label={t("qol.allProgress")} value={progress} onChange={(e) => setProgress(e.target.value)}><option value="">{t("qol.allProgress")}</option>{["new", "needs_work", "complete"].map((p) => <option key={p} value={p}>{t(`progress.${p}`)}</option>)}</select><select className="field" aria-label={t("qol.allStatus")} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{t("qol.allStatus")}</option>{["core", "side", "future"].map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select></div>
    </div>
    {filtering ? <div>{!results.length && <p className="muted">{t("qol.noResults")}</p>}{results.map((n) => {
      const work = trackingProgress(n);
      return <button className={`btn search-result ${n.id === selectedId ? "btn-primary" : "btn-ghost"}`} key={n.id} onClick={() => onSelect(n.id)}>{n.title}
        <small>{cats.find((c) => c.slug === n.pillar)?.label} · {t(`progress.${work.status}`)}</small>
        {work.enabled && <ProgressMeter compact percent={work.percent} label={t("tracker.nodeProgress", { title: n.title })} />}
        <small>{(n.body || "").replace(/[#*_`]/g, "").slice(0, 150)}</small></button>;
    })}</div> : <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e).catch(onError)}>
      {cats.map((cat) => (
        <CategorySection key={cat.slug} cat={cat} roots={roots} slug={project.slug}
          selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} onAddRoot={addRoot} onError={onError} t={t} />
      ))}
    </DndContext>}</>
  );
}
