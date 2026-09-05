import { useState } from "react";
import { useT } from "../i18n/index.jsx";
import { nodeTemplate } from "../nodeTemplates.js";
import { api } from "../api.js";
import { errorText } from "../ui.js";
import Dialog from "./Dialog.jsx";

export default function TemplateDialog({ project, onClose, onCreated }) {
  const { t, lang } = useT();
  const [template, setTemplate] = useState("mechanic"), [pillar, setPillar] = useState(project.categories[0].slug), [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const content = template === "blank" ? { title: t("tree.newIdea"), body: "" } : nodeTemplate(template, lang);
  return <Dialog title={t("qol.addTemplate")} onClose={() => { if (!busy) onClose(); }}><form onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { const n = await api.createNode(project.slug, { ...content, pillar, parent: parent || null }); await onCreated(n); onClose(); }
    catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }}>
    <label>{t("qol.template")}<select className="field" value={template} onChange={(e) => setTemplate(e.target.value)}>{["blank", "mechanic", "enemy", "playtest"].map((key) => <option key={key} value={key}>{t(`qol.${key}`)}</option>)}</select></label>
    <label>{t("qol.parent")}<select className="field" value={parent} onChange={(e) => setParent(e.target.value)}><option value="">{t("qol.root")}</option>{project.nodes.map((n) => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>
    {!parent && <label>{t("qol.category")}<select className="field" value={pillar} onChange={(e) => setPillar(e.target.value)}>{project.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></label>}
    <details><summary>{content.title}</summary><pre style={{ whiteSpace: "pre-wrap", maxHeight: 220, overflow: "auto", fontFamily: "inherit" }}>{content.body}</pre></details>
    {error && <div className="error" role="alert">{error}</div>}<button className="btn btn-primary" disabled={busy}>{t("qol.create")}</button>
  </form></Dialog>;
}
