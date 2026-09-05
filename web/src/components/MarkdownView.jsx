import { useMemo } from "react";
import { renderMarkdown } from "../nodeLinks.js";
import DOMPurify from "dompurify";
import { useT } from "../i18n/index.jsx";

export default function MarkdownView({ text, nodes = [], slug, onNavigate }) {
  const { t } = useT();
  const html = useMemo(() => {
    const doc = new DOMParser().parseFromString(DOMPurify.sanitize(renderMarkdown(text, nodes)), "text/html");
    if (slug) doc.querySelectorAll("[src], a[href]").forEach((el) => {
      const attr = el.hasAttribute("src") ? "src" : "href", url = el.getAttribute(attr);
      if (url?.startsWith("assets/")) el.setAttribute(attr, `/api/projects/${slug}/${url}`);
    });
    return doc.body.innerHTML;
  }, [text, nodes, slug]);
  if (!text || !text.trim())
    return <div style={{ color: "var(--text-faint)" }}>{t("editor.previewEmpty")}</div>;
  return <div className="md" onClick={(e) => {
    const a = e.target.closest("a[data-node-id]");
    if (a && onNavigate && !e.ctrlKey && !e.metaKey) { e.preventDefault(); onNavigate(a.dataset.nodeId); }
  }} dangerouslySetInnerHTML={{ __html: html }} />;
}
