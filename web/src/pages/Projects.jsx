import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import { spring, fadeUp } from "../motion.js";
import { useT } from "../i18n/index.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";
import Dialog from "../components/Dialog.jsx";
import { errorText } from "../ui.js";
import { nodeTemplate } from "../nodeTemplates.js";

export default function Projects({ me, onOpen, onLogout }) {
  const { t, lang } = useT();
  const [list, setList] = useState(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [archived, setArchived] = useState(false), [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(null), [newTitle, setNewTitle] = useState("");
  const backupInput = useRef(null);
  async function reload() { try { setList(await api.projects()); } catch (e) { setError(errorText(e, t)); } }

  useEffect(() => { reload(); }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await run(async () => { const p = await api.createProject(title.trim()); setTitle(""); onOpen(p.slug); });
  }
  async function run(fn) {
    if (busy) return; setBusy(true); setError("");
    try { await fn(); await reload(); } catch (e) { setError(errorText(e, t)); await reload(); } finally { setBusy(false); }
  }
  async function example() {
    await run(async () => {
      const p = await api.createProject(t("qol.exampleTitle"));
      const mechanic = await api.createNode(p.slug, { ...nodeTemplate("mechanic", lang), pillar: "gameloop" });
      const enemy = await api.createNode(p.slug, { ...nodeTemplate("enemy", lang), pillar: "content", body: nodeTemplate("enemy", lang).body + `\n\n[[${mechanic.id}]]` });
      await api.createNode(p.slug, { ...nodeTemplate("playtest", lang), pillar: "scope", body: nodeTemplate("playtest", lang).body + `\n\n[[${mechanic.id}]] · [[${enemy.id}]]` });
      localStorage.setItem(`gs_sel_${p.slug}`, mechanic.id); onOpen(p.slug);
    });
  }

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "46px 28px 80px" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div className="brand" style={{ fontSize: 30 }}>GameSketch</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="mono">{me.name}</span>
            <button className="btn btn-ghost" onClick={onLogout}>{t("common.logout")}</button>
          </div>
        </header>

        <div style={{ display: "flex", gap: 16, marginBottom: 38, color: "var(--text-faint)", fontSize: 12.5, flexWrap: "wrap" }}>
          {DEFAULT_CATEGORIES.map((cat) => (
            <span key={cat.slug} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ color: cat.color, background: cat.color }} />{cat.label}
            </span>
          ))}
        </div>

        <motion.h1 variants={fadeUp} initial="initial" animate="animate" custom={0} style={{ fontSize: 42, marginBottom: 6 }}>
          {t("projects.heading")}
        </motion.h1>
        <motion.p variants={fadeUp} initial="initial" animate="animate" custom={1}
          style={{ color: "var(--text-dim)", marginTop: 0, marginBottom: 24, fontSize: 16 }}>
          {t("projects.subtitle")}
        </motion.p>

        <motion.form variants={fadeUp} initial="initial" animate="animate" custom={2} onSubmit={create}
          style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <input className="field" placeholder={t("projects.newPlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" disabled={busy || !title.trim()} style={{ whiteSpace: "nowrap" }}>{t("projects.newButton")}</button>
        </motion.form>
        <div className="toolbar" style={{ marginBottom: 16 }}>
          <button className={`btn ${!archived ? "btn-primary" : "btn-ghost"}`} onClick={() => setArchived(false)}>{t("qol.active")}</button>
          <button className={`btn ${archived ? "btn-primary" : "btn-ghost"}`} onClick={() => setArchived(true)}>{t("qol.archived")}</button>
          <button className="btn" disabled={busy} onClick={example}>{t("qol.example")}</button>
          <button className="btn" type="button" disabled={busy} onClick={() => backupInput.current.click()}>{t("qol.importBackup")}</button><input ref={backupInput} hidden type="file" accept=".gamesketch" disabled={busy} onChange={(e) => { const file = e.target.files[0]; e.target.value = ""; if (file) run(async () => { const p = await api.importBackup(file); onOpen(p.slug); }); }} />
          <input type="search" className="field" style={{ flex: 1, minWidth: 150 }} aria-label={t("qol.projectTitle")} placeholder={t("qol.projectTitle")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <p className="muted" style={{ fontSize: 12 }}>{t("qol.backupHint")}</p>
        {error && <div role="alert" className="error">{error} <button className="btn" onClick={reload}>{t("qol.retry")}</button></div>}
        {busy && <div role="status" className="muted">{t("common.loading")}</div>}
        {!list && !error && <p>{t("common.loading")}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 16 }}>
          <AnimatePresence>
            {(list || []).filter((p) => !!p.archived === archived && p.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((p, i) => (
              <motion.article key={p.slug} layout variants={fadeUp} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0.96 }}
                custom={3 + i} whileHover={{ y: -5, transition: spring }} whileTap={{ scale: 0.98 }}
                className="glass project-card"
                style={{ textAlign: "left", padding: 0, overflow: "hidden", cursor: "pointer", color: "var(--text)" }}>
                <div style={{ height: 5, background: "linear-gradient(90deg, var(--gameloop), var(--artstyle), var(--content), var(--threads), var(--scope))" }} />
                <button onClick={() => onOpen(p.slug)}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--text)" }}>{p.title}</div>
                  <div className="mono" style={{ marginTop: 9 }}>{p.slug}</div>
                </button>
                <div className="toolbar"><button className="btn btn-ghost" disabled={busy} onClick={() => { setRenaming(p); setNewTitle(p.title); }}>{t("qol.rename")}</button><button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.duplicateProject(p.slug, t("qol.copyTitle", { title: p.title })))}>{t("qol.duplicate")}</button><button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.updateProject(p.slug, { archived: !p.archived }))}>{t(`qol.${p.archived ? "unarchive" : "archive"}`)}</button></div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
        {list && list.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 4px" }}>{t("projects.empty")}</div>
        )}
      </div>
      {renaming && <Dialog title={t("qol.rename")} onClose={() => { if (!busy) setRenaming(null); }}><form onSubmit={(e) => { e.preventDefault(); run(async () => { await api.updateProject(renaming.slug, { title: newTitle.trim() }); setRenaming(null); }); }}><label>{t("qol.projectTitle")}<input className="field" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus maxLength={200} required /></label>{error && <p role="alert" className="error">{error}</p>}<button className="btn btn-primary" disabled={busy || !newTitle.trim()}>{t("qol.save")}</button></form></Dialog>}
    </div>
  );
}
