import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useT } from "../i18n/index.jsx";

export default function MarkdownView({ text }) {
  const { t } = useT();
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || "")), [text]);
  if (!text || !text.trim())
    return <div style={{ color: "var(--text-faint)" }}>{t("editor.previewEmpty")}</div>;
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
