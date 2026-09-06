import { useT } from "../i18n/index.jsx";

const COLORS = { core: "var(--core)", side: "var(--side)", future: "var(--future)" };

export default function StatusBadge({ status, onClick }) {
  const { t } = useT();
  return (
    <button type="button" className="pill" onClick={onClick} disabled={!onClick} title={onClick ? t("status.tooltip") : t(`status.${status}`)}
      style={{ background: COLORS[status] || "var(--text-faint)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: "rgba(7,8,12,0.55)" }} />
      {t(`status.${status}`)}
    </button>
  );
}
