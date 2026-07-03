import { useT } from "../i18n/index.jsx";

// Work status — a node's progress/attention state, independent of the core/side/future
// importance status. Kept here (with the glyph/colour maps) so the tree can reuse them.
export const PROGRESS_CYCLE = { new: "needs_work", needs_work: "complete", complete: "new" };
export const PROGRESS_GLYPH = { new: "○", needs_work: "◐", complete: "✓" };
export const PROGRESS_COLOR = { new: "var(--text-faint)", needs_work: "var(--side)", complete: "var(--core)" };

export function normalizeProgress(p) {
  return PROGRESS_GLYPH[p] ? p : "new";
}

export default function ProgressBadge({ progress = "new", onClick }) {
  const { t } = useT();
  const p = normalizeProgress(progress);
  return (
    <span className="pill" onClick={onClick} title={t("progress.tooltip")}
      style={{ background: "var(--surface-2)", color: PROGRESS_COLOR[p], border: "1px solid var(--border)",
        cursor: onClick ? "pointer" : "default" }}>
      <span style={{ fontSize: 11, lineHeight: 1 }}>{PROGRESS_GLYPH[p]}</span>
      {t(`progress.${p}`)}
    </span>
  );
}
