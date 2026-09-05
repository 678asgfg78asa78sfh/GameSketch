import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/index.jsx";
import { api } from "../api.js";
import { orderedNodes } from "../nodeLinks.js";
import { downloadBlob, downloadUrl, errorText } from "../ui.js";
import { canvasSvg, isImage, standaloneDocument } from "../documentExport.js";
import MarkdownView from "./MarkdownView.jsx";

function Drawing({ slug, node }) {
  const { t } = useT();
  const [svg, setSvg] = useState(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(""); canvasSvg(slug, node.id).then((svg) => { if (active) setSvg(svg); }).catch((e) => { if (active) setError(errorText(e, t)); }); return () => { active = false; }; }, [slug, node.id, node.updated_at, retry, t]);
  if (error) return <div role="alert" className="error">{error} <button className="btn" onClick={() => setRetry((n) => n + 1)}>{t("qol.retry")}</button></div>;
  return svg === null ? <p className="muted">{t("editor.canvasLoading")}</p> : <figure dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function DocumentReader({ project, onNavigate }) {
  const { t, lang } = useT(), root = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const nodes = orderedNodes(project);
  function scrollTo(id) { root.current.querySelector(`[id="node-${id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  async function exportDocument(kind) {
    setBusy(true); setError("");
    try {
      if (kind === "html" || kind === "print") {
        const html = await standaloneDocument(await api.project(project.slug), t, lang);
        if (kind === "html") downloadBlob(new Blob([html], { type: "text/html" }), `${project.slug}.html`);
        else {
          const frame = document.createElement("iframe"); frame.style.cssText = "position:fixed;width:1px;height:1px;border:0;right:0;bottom:0";
          frame.title = t("qol.print");
          frame.onload = async () => {
            const win = frame.contentWindow;
            await Promise.all([...win.document.images].map((img) => img.decode().catch(() => {})));
            await win.document.fonts.ready;
            win.addEventListener("afterprint", () => frame.remove(), { once: true }); win.focus(); win.print();
          };
          frame.srcdoc = html;
          document.body.append(frame);
        }
      } else await downloadUrl(`/api/projects/${project.slug}/export.${kind}`, `${project.slug}.${kind}`);
    } catch (e) { setError(errorText(e, t)); } finally { setBusy(false); }
  }
  return <div className="workspace-pane document-reader" ref={root}>
    <div className="toolbar no-print">{[["html", "exportHtml"], ["md", "exportMd"], ["json", "exportJson"], ["print", "print"]].map(([kind, label]) => <button className="btn" key={kind} disabled={busy} onClick={() => exportDocument(kind)}>{t(`qol.${label}`)}</button>)}</div>
    {busy && <p role="status">{t("qol.exportBusy")}</p>}{error && <p className="error" role="alert">{error}</p>}
    <h1 style={{ margin: "24px 0 12px" }}>{project.title}</h1>
    <p className="muted">{t("qol.count", { n: nodes.length })}</p>
    {!nodes.length ? <p>{t("qol.noDocument")}</p> : <nav aria-label={t("qol.contents")}><h2>{t("qol.contents")}</h2><ul className="reader-toc">{nodes.map((n) => <li style={{ marginLeft: n.depth * 12 }} key={n.id}><a href={`#node-${n.id}`} onClick={(e) => { e.preventDefault(); scrollTo(n.id); }}>{n.title}</a></li>)}</ul></nav>}
    {nodes.map((n) => <section className="reader-node" id={`node-${n.id}`} key={n.id}>
      <div className="toolbar"><small className="muted">{project.categories.find((c) => c.slug === n.pillar)?.label} · {n.status} · {t(`progress.${n.progress || "new"}`)}</small><button className="btn btn-ghost no-print" style={{ marginLeft: "auto" }} onClick={() => onNavigate(n.id)}>{t("qol.openIdea")}</button></div>
      <h3>{n.title}</h3><MarkdownView text={n.body} nodes={project.nodes} slug={project.slug} onNavigate={scrollTo} />
      <div className="attachment-grid">{(n.attachments || []).map((path) => <a className="attachment-card" key={path} href={`/api/projects/${project.slug}/${path}`} target="_blank" rel="noreferrer">{isImage(path) && <img loading="lazy" src={`/api/projects/${project.slug}/${path}`} alt={path.split("/").pop()} />}{path.split("/").pop()}</a>)}</div>
      {n.canvas && <Drawing slug={project.slug} node={n} />}
    </section>)}
  </div>;
}
