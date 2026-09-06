import { useT } from "../i18n/index.jsx";
import { projectProgress } from "../../../shared/tracking.js";

export default function ProgressMeter({ percent, label, compact = false }) {
  return <span className={`progress-meter ${compact ? "compact" : ""}`} title={label}>
    <progress max="100" value={percent} aria-label={label} /><span>{percent}%</span>
  </span>;
}

export function ProjectProgress({ nodes }) {
  const { t } = useT(), p = projectProgress(nodes);
  return <section className="project-progress" aria-label={t("tracker.overall")}>
    <strong>{t("tracker.overall")}</strong>
    {p.total ? <><ProgressMeter percent={p.percent} label={t("tracker.overall")} />
      <small>{t("tracker.summary", { done: p.done, total: p.total })}</small>
      <details><summary>{t("tracker.calculation")}</summary><p>{t("tracker.overallHint")}</p></details>
    </> : <small>{t("tracker.optionalHint")}</small>}
  </section>;
}
