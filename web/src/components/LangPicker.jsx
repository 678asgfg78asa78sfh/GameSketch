import { useT, LANGS } from "../i18n/index.jsx";

// Segmented EN / DE / RU control. Used in the login/setup screen and the settings gear.
export default function LangPicker() {
  const { lang, setLang } = useT();
  return (
    <div style={{ display: "inline-flex", gap: 4, padding: 4, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
      {LANGS.map(([code, label]) => {
        const active = lang === code;
        return (
          <button key={code} type="button" onClick={() => setLang(code)}
            style={{
              cursor: "pointer", padding: "5px 11px", fontSize: 13, fontFamily: "var(--font-body)",
              borderRadius: "var(--radius-sm)", transition: "background .15s, color .15s",
              background: active ? "var(--surface-3)" : "transparent",
              color: active ? "var(--text)" : "var(--text-dim)",
              border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
