import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { errorText } from "../ui.js";
import ChangesPreview from "./ChangesPreview.jsx";

export default function WorkspacePanel({ slug, mode, onChanged, onNavigate }) {
  const { t, lang } = useT();
  const [items, setItems] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true; setError("");
    (mode === "trash" ? api.trash(slug) : api.activity(slug)).then((data) => { if (active) setItems(data); }).catch((e) => { if (active) setError(errorText(e, t)); });
    return () => { active = false; };
  }, [slug, mode, version, t]);
  async function act(item) {
    setBusy(true); setError("");
    try {
      const r = mode === "trash" ? await api.restoreTrash(slug, item.id) : await api.undoAction(slug, item.id);
      await onChanged(r.action); setVersion((n) => n + 1);
      if (mode === "trash") onNavigate(r.id);
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }
  return <div className="workspace-pane"><h2>{t(`qol.${mode}`)}</h2><p className="muted">{t(`qol.${mode === "trash" ? "trashHint" : "activityHint"}`)}</p>
    {error && <div className="error" role="alert">{error} <button className="btn" onClick={() => setVersion((v) => v + 1)}>{t("qol.retry")}</button></div>}
    {items === null && !error && <p>{t("common.loading")}</p>}
    {items?.length === 0 && <p>{t(`qol.${mode === "trash" ? "emptyTrash" : "emptyActivity"}`)}</p>}
    {items?.map((item) => <article key={item.id} className="action-card"><div className="toolbar"><strong>{mode === "trash" ? item.title : t(`qol.kinds.${item.kind}`)}</strong><button disabled={busy || item.undone} className="btn" style={{ marginLeft: "auto" }} onClick={() => act(item)}>{t(`qol.${mode === "trash" ? "restore" : item.undone ? "undone" : "undo"}`)}</button></div><small className="muted">{new Date(item.deletedAt || item.date).toLocaleString(lang)} · {item.deletedBy || item.author}{mode === "trash" && ` · ${t("qol.count", { n: item.count })}`}</small>{item.changes && <ChangesPreview changes={item.changes} />}</article>)}
  </div>;
}
