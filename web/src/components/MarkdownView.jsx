import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

export default function MarkdownView({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || "")), [text]);
  if (!text || !text.trim())
    return <div style={{ color: "var(--text-faint)" }}>Noch nichts geschrieben — wechsle auf <b>edit</b>.</div>;
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
