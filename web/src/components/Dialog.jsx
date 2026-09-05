import { useEffect, useRef, useId } from "react";
import { useT } from "../i18n/index.jsx";

export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null), id = useId();
  const { t } = useT();
  useEffect(() => { const d = ref.current; d.showModal(); return () => d.close(); }, []);
  return <dialog ref={ref} className="gs-dialog" aria-labelledby={id} onCancel={(e) => { e.preventDefault(); onClose(); }}>
    <header className="toolbar"><h2 id={id}>{title}</h2><button type="button" className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose} aria-label={t("qol.close")}>✕</button></header>
    {children}
  </dialog>;
}
