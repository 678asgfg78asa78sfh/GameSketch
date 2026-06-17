import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { useWork } from "../workContext.jsx";
import { CATEGORY_COLORS, slugifyCategory, DEFAULT_CATEGORIES } from "../pillars.js";

function uniqueSlug(label, existing) {
  const base = slugifyCategory(label) || "cat";
  const taken = new Set(existing.map((c) => c.slug));
  let s = base, i = 2;
  while (taken.has(s)) s = `${base}-${i++}`;
  return s;
}

// Bottom-left gear (next to global settings) — only in a project. Edits the project's categories.
export default function ProjectConfigGear({ slug }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title={t("projectCfg.gear")} aria-label={t("projectCfg.gear")}
        className="glass"
        style={{ position: "fixed", left: 70, bottom: 16, zIndex: 40, width: 46, height: 46, borderRadius: 99, display: "grid", placeItems: "center", cursor: "pointer", fontSize: 19, padding: 0, lineHeight: 1 }}>
        🗂
      </button>
      {open && <ProjectConfigPanel slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProjectConfigPanel({ slug, onClose }) {
  const { t } = useT();
  const { bumpReload } = useWork();
  const [cats, setCats] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [tplName, setTplName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.project(slug).then((p) => setCats((p.categories || DEFAULT_CATEGORIES).map((c) => ({ ...c })))).catch(() => setCats(DEFAULT_CATEGORIES.map((c) => ({ ...c }))));
    api.templates().then((r) => setTemplates(r.templates || [])).catch(() => {});
  }, [slug]);

  const update = (i, patch) => setCats((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i) => setCats((cs) => cs.filter((_, j) => j !== i));
  const move = (i, dir) => setCats((cs) => {
    const j = i + dir;
    if (j < 0 || j >= cs.length) return cs;
    const out = cs.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });
  const add = () => setCats((cs) => [...cs, { slug: uniqueSlug("category", cs), label: "New category", color: CATEGORY_COLORS[cs.length % CATEGORY_COLORS.length] }]);

  async function save() {
    setErr(""); setMsg(""); setBusy(true);
    try {
      await api.saveCategories(slug, cats);
      bumpReload();
      setMsg(t("projectCfg.saved"));
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  function applyTemplate(tpl) {
    setErr(""); setMsg("");
    setCats(tpl.categories.map((c) => ({ slug: c.slug, label: c.label, color: c.color })));
  }

  async function saveAsTemplate() {
    if (!tplName.trim()) return;
    setBusy(true); setErr("");
    try {
      await api.saveTemplate(tplName.trim(), cats);
      setTemplates((await api.templates()).templates || []);
      setTplName("");
      setMsg(t("projectCfg.templateSaved"));
    } catch (e) { setErr(String(e.message || e)); }
    finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(3,4,8,0.62)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="glass" style={{ width: "min(620px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700 }}>{t("projectCfg.title")}</div>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>✕ {t("common.close")}</button>
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, lineHeight: 1.6 }}>{t("projectCfg.intro")}</p>

        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {(cats || []).map((c, i) => (
            <div key={c.slug} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={c.color} onChange={(e) => update(i, { color: e.target.value })}
                style={{ width: 34, height: 34, padding: 0, border: "1px solid var(--border)", borderRadius: 8, background: "transparent", cursor: "pointer" }} />
              <input className="field" value={c.label} onChange={(e) => update(i, { label: e.target.value })} placeholder={t("projectCfg.label")} />
              <button className="btn btn-ghost btn-icon" disabled={i === 0} title="↑" onClick={() => move(i, -1)}>↑</button>
              <button className="btn btn-ghost btn-icon" disabled={i === cats.length - 1} title="↓" onClick={() => move(i, 1)}>↓</button>
              <button className="btn btn-ghost btn-icon" disabled={cats.length <= 1} title={t("projectCfg.remove")} onClick={() => remove(i)} style={{ color: "var(--gameloop)" }}>✕</button>
            </div>
          ))}
        </div>
        <button className="btn" onClick={add} style={{ marginBottom: 16 }}>{t("projectCfg.addCategory")}</button>

        {err && <div style={{ color: "var(--gameloop)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
        {msg && <div style={{ color: "var(--content)", fontSize: 13, marginBottom: 10 }}>{msg}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{t("projectCfg.save")}</button>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 8 }}>{t("projectCfg.templates")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {templates.map((tpl) => (
              <button key={tpl.name} className="btn btn-ghost" onClick={() => applyTemplate(tpl)} title={t("projectCfg.apply")}>
                {tpl.name} · {tpl.categories.length}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="field" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={t("projectCfg.templateName")} />
            <button className="btn" disabled={busy || !tplName.trim()} onClick={saveAsTemplate} style={{ whiteSpace: "nowrap" }}>{t("projectCfg.saveAsTemplate")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
