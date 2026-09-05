import { useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import Dialog from "./Dialog.jsx";

export default function NodeActions({ project, node, runAction, onNavigate, disabled }) {
  const { t } = useT();
  const [moving, setMoving] = useState(false), [parent, setParent] = useState(node.parent || ""), [pillar, setPillar] = useState(node.pillar);
  const descendants = new Set([node.id]);
  let size; do { size = descendants.size; project.nodes.forEach((n) => { if (descendants.has(n.parent)) descendants.add(n.id); }); } while (size !== descendants.size);
  const siblings = project.nodes.filter((n) => n.pillar === node.pillar && (n.parent || null) === (node.parent || null)).sort((a, b) => (a.order || 0) - (b.order || 0));
  const index = siblings.findIndex((n) => n.id === node.id);
  function reorder(direction) {
    const target = index + direction, beyond = siblings[target + direction];
    const order = beyond ? ((siblings[target].order || 0) + (beyond.order || 0)) / 2 : (siblings[target].order || 0) + direction;
    return runAction(() => api.updateNode(project.slug, node.id, { order }));
  }
  return <>
    <div className="toolbar no-print" style={{ margin: "14px 0" }}>
      <button className="btn btn-ghost" disabled={disabled || index <= 0} onClick={() => reorder(-1)} title={t("qol.moveUp")}>↑</button>
      <button className="btn btn-ghost" disabled={disabled || index === siblings.length - 1} onClick={() => reorder(1)} title={t("qol.moveDown")}>↓</button>
      <button className="btn btn-ghost" disabled={disabled} onClick={() => { setParent(node.parent || ""); setPillar(node.pillar); setMoving(true); }}>{t("qol.move")}</button>
      <button className="btn btn-ghost" disabled={disabled} onClick={() => runAction(async () => {
        const result = await api.duplicateNode(project.slug, node.id, t("qol.copyTitle", { title: node.title })); onNavigate(result.id); return result;
      })}>{t("qol.duplicate")}</button>
    </div>
    {moving && <Dialog title={t("qol.move")} onClose={() => setMoving(false)}><form onSubmit={(e) => {
      e.preventDefault(); runAction(async () => {
        const category = project.nodes.find((n) => n.id === parent)?.pillar || pillar;
        const siblings = project.nodes.filter((n) => n.id !== node.id && (n.parent || "") === parent && n.pillar === category);
        const order = siblings.reduce((max, n) => Math.max(max, n.order || 0), -1) + 1;
        const result = await api.updateNode(project.slug, node.id, { parent: parent || null, pillar: category, order }); setMoving(false); return result;
      });
    }}>
      <label>{t("qol.parent")}<select className="field" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">{t("qol.root")}</option>{project.nodes.filter((n) => !descendants.has(n.id)).map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
      {!parent && <label>{t("qol.category")}<select className="field" value={pillar} onChange={(e) => setPillar(e.target.value)}>{project.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>}
      <button className="btn btn-primary" disabled={disabled}>{t("qol.move")}</button>
    </form></Dialog>}
  </>;
}
