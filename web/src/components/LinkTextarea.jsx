import { useRef, useState } from "react";
import { useT } from "../i18n/index.jsx";

export default function LinkTextarea({ value, onChange, nodes, ...props }) {
  const { t } = useT(), ref = useRef(null);
  const [query, setQuery] = useState(null), [active, setActive] = useState(0);
  function detect(el) {
    const prefix = el.value.slice(0, el.selectionStart), match = prefix.match(/\[\[([^\]\n]*)$/);
    setQuery(match ? { start: prefix.length - match[0].length, end: el.selectionStart, text: match[1] } : null); setActive(0);
  }
  const matches = query ? nodes.filter((n) => `${n.title} ${n.id}`.toLocaleLowerCase().includes(query.text.toLocaleLowerCase())).slice(0, 8) : [];
  function insert(node) {
    const text = `[[${node.id}]]`, end = value.slice(query.end).startsWith("]]") ? query.end + 2 : query.end;
    onChange(value.slice(0, query.start) + text + value.slice(end)); setQuery(null);
    requestAnimationFrame(() => { ref.current?.focus(); ref.current?.setSelectionRange(query.start + text.length, query.start + text.length); });
  }
  return <>
    <textarea {...props} ref={ref} value={value} aria-autocomplete="list" aria-expanded={!!matches.length}
      onChange={(e) => { onChange(e.target.value); detect(e.target); }} onClick={(e) => detect(e.target)}
      onKeyDown={(e) => {
        if (!query) return;
        if (e.key === "Escape") { e.preventDefault(); setQuery(null); }
        if (matches.length && ["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length); }
        if (matches.length && e.key === "Enter") { e.preventDefault(); insert(matches[active] || matches[0]); }
      }} />
    {matches.length > 0 && <div className="link-suggestions" role="listbox" aria-label={t("qol.insertLink")}>{matches.map((n, i) => <button type="button" role="option" aria-selected={i === active} className={`btn ${i === active ? "btn-primary" : "btn-ghost"}`} key={n.id} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(n)}>{n.title}</button>)}</div>}
    <small className="muted">{t("qol.linkHint")}</small>
  </>;
}
