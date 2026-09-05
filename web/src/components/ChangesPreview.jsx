import { useT } from "../i18n/index.jsx";
const show = (value) => value == null ? "—" : typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
export default function ChangesPreview({ changes = [] }) {
  const { t } = useT();
  return <div className="change-list">{changes.map((change, i) => <details key={change.id || i} open={changes.length === 1}>
    <summary>{change.type === "create" ? "＋" : change.type === "delete" ? "−" : "✎"} {change.title}</summary>
    {change.fields.map((field) => <div key={field.key} className="change-field">
      <strong>{t(`qol.fields.${field.key}`)}</strong>
      <div className="change-pair"><div><small>{t("qol.before")}</small><pre>{show(field.before)}</pre></div><div><small>{t("qol.after")}</small><pre>{show(field.after)}</pre></div></div>
    </div>)}
  </details>)}</div>;
}
