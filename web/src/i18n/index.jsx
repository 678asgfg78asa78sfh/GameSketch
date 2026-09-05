import { createContext, useContext, useState, useCallback, useMemo } from "react";
import en from "./en.js";
import de from "./de.js";
import ru from "./ru.js";
import qol from "./qol.js";

const DICTS = { en: { ...en, qol: qol.en }, de: { ...de, qol: qol.de }, ru: { ...ru, qol: qol.ru } };

// [code, native label] — order shown in pickers.
export const LANGS = [
  ["en", "English"],
  ["de", "Deutsch"],
  ["ru", "Русский"],
];

function detect() {
  try {
    const stored = localStorage.getItem("gs_lang");
    if (stored && DICTS[stored]) return stored;
    const nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return DICTS[nav] ? nav : "en";
  } catch {
    return "en";
  }
}

function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o == null ? undefined : o[k]), dict);
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);

  const setLang = useCallback((l) => {
    if (!DICTS[l]) return;
    try { localStorage.setItem("gs_lang", l); } catch { /* ignore */ }
    setLangState(l);
  }, []);

  const t = useCallback(
    (key, vars) => {
      let s = lookup(DICTS[lang], key);
      if (s == null) s = lookup(DICTS.en, key); // fall back to English
      if (s == null) return key; // last resort: surface the missing key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
      return s;
    },
    [lang]
  );

  const value = useMemo(() => ({ t, lang, setLang }), [t, lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within I18nProvider");
  return ctx;
}
