import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { api } from "../api.js";
import { spring } from "../motion.js";
import { useT } from "../i18n/index.jsx";
import { PROGRESS_GLYPH, PROGRESS_COLOR, normalizeProgress } from "./ProgressBadge.jsx";
import { flushAll } from "../useAutosave.js";

export default function TreeNode({ node, depth, slug, pillarColor, selectedId, onSelect, onChanged, onError }) {
  const { t } = useT();
  const collapseKey = `gs_collapsed_${slug}_${node.id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(collapseKey) !== "1"; } catch { return true; } });
  function toggleOpen(next = !open) { setOpen(next); try { localStorage.setItem(collapseKey, next ? "0" : "1"); } catch { /* ignore */ } }
  const sel = node.id === selectedId;
  const prog = normalizeProgress(node.progress);
  const { attributes, listeners, setNodeRef: dragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: node.id });

  async function addChild() {
    try { await flushAll();
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.id, title: t("tree.newIdea") });
    toggleOpen(true); await onChanged(n.action); onSelect(n.id);
    } catch (e) { onError(e); }
  }
  async function addSibling() {
    try { await flushAll();
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.parent ?? null, title: t("tree.newIdea") });
    await onChanged(n.action); onSelect(n.id);
    } catch (e) { onError(e); }
  }
  function onKeyDown(e) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addChild(); }
    else if (e.key === "Enter") { e.preventDefault(); addSibling(); }
    else if (e.key === " ") { e.preventDefault(); onSelect(node.id); }
    else if (e.key === "ArrowRight") { e.preventDefault(); toggleOpen(true); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); toggleOpen(false); }
  }

  return (
    <div ref={dropRef} style={{ opacity: isDragging ? 0.4 : 1 }}>
      <div ref={dragRef} tabIndex={0} onKeyDown={onKeyDown} onClick={() => onSelect(node.id)}
        className={`tree-row ${sel ? "sel" : ""} ${isOver ? "over" : ""}`}
        style={{ "--pc": pillarColor, marginLeft: depth * 15 }}>
        {node.children.length > 0 ? (
          <button className="btn btn-ghost" aria-label={t("qol.collapse")} aria-expanded={open} onClick={(e) => { e.stopPropagation(); toggleOpen(); }}
            style={{ padding: 0, width: 14, textAlign: "center", color: "var(--text-faint)", fontSize: 9, transition: "transform .18s", transform: open ? "rotate(90deg)" : "none" }}>▶</button>
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
                selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} onError={onError} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
