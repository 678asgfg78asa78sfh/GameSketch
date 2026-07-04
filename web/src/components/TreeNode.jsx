import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { api } from "../api.js";
import { spring } from "../motion.js";
import { useT } from "../i18n/index.jsx";
import { PROGRESS_GLYPH, PROGRESS_COLOR, normalizeProgress } from "./ProgressBadge.jsx";

export default function TreeNode({ node, depth, slug, pillarColor, selectedId, onSelect, onChanged }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const sel = node.id === selectedId;
  const prog = normalizeProgress(node.progress);
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: node.id });

  async function addChild() {
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.id, title: t("tree.newIdea") });
    onSelect(n.id); onChanged();
  }
  async function addSibling() {
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.parent ?? null, title: t("tree.newIdea") });
    onSelect(n.id); onChanged();
  }
  function onKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addSibling(); }
    else if (e.key === "Tab") { e.preventDefault(); addChild(); }
  }

  return (
    <div ref={dropRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <div ref={dragRef} tabIndex={0} onKeyDown={onKeyDown} onClick={() => onSelect(node.id)}
        className={`tree-row ${sel ? "sel" : ""} ${isOver ? "over" : ""}`}
        style={{ "--pc": pillarColor, marginLeft: depth * 15 }}>
        {node.children.length > 0 ? (
          <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            style={{ width: 14, textAlign: "center", color: "var(--text-faint)", fontSize: 9, transition: "transform .18s", transform: open ? "rotate(90deg)" : "none" }}>▶</span>
        ) : (
          <span style={{ width: 14 }} />
        )}
        <span {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}
          style={{ cursor: "grab", color: "var(--text-faint)", fontSize: 12, lineHeight: 1 }}>⠿</span>
        <span className="dot" style={{ width: 7, height: 7, color: `var(--${node.status})`, background: `var(--${node.status})` }} />
        <span style={{ flex: 1, fontSize: 14, color: node.status === "future" ? "var(--text-dim)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {node.title}
        </span>
        <span title={t(`progress.${prog}`)} style={{ fontSize: 12, lineHeight: 1, color: PROGRESS_COLOR[prog], flexShrink: 0 }}>{PROGRESS_GLYPH[prog]}</span>
        {node.kind !== "idea" && <span className="mono" style={{ fontSize: 10 }}>{node.kind === "alternative" ? t("tree.kindAlt") : t("tree.kindNote")}</span>}
        <button className="btn btn-ghost btn-icon" style={{ padding: "2px 7px", fontSize: 14 }} onClick={(e) => { e.stopPropagation(); addChild(); }} title={t("tree.childIdea")}>＋</button>
      </div>
      <AnimatePresence initial={false}>
        {open && node.children.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: spring }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.14 } }} style={{ overflow: "hidden" }}>
            {node.children.map((c) => (
              <TreeNode key={c.id} node={c} depth={depth + 1} slug={slug} pillarColor={pillarColor}
                selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
