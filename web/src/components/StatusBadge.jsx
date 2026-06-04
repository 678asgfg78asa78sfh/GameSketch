const COLORS = { core: "var(--core)", side: "var(--side)", future: "var(--future)" };
const LABELS = { core: "Core", side: "Side", future: "Future" };

export default function StatusBadge({ status, onClick }) {
  return (
    <span className="pill" onClick={onClick} title="Status wechseln (core → side → future)"
      style={{ background: COLORS[status] || "var(--text-faint)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: "rgba(7,8,12,0.55)" }} />
      {LABELS[status] || status}
    </span>
  );
}
