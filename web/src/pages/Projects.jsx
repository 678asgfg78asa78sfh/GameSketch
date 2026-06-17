import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import { spring, fadeUp } from "../motion.js";
import { useT } from "../i18n/index.jsx";
import { DEFAULT_CATEGORIES } from "../pillars.js";

export default function Projects({ me, onOpen, onLogout }) {
  const { t } = useT();
  const [list, setList] = useState(null);
  const [title, setTitle] = useState("");

  useEffect(() => { api.projects().then(setList).catch(() => setList([])); }, []);

  async function create(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const p = await api.createProject(title.trim());
    setTitle("");
    onOpen(p.slug);
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
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>{t("projects.newButton")}</button>
        </motion.form>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 16 }}>
          <AnimatePresence>
            {(list || []).map((p, i) => (
              <motion.button key={p.slug} layout variants={fadeUp} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0.96 }}
                custom={3 + i} whileHover={{ y: -5, transition: spring }} whileTap={{ scale: 0.98 }}
                onClick={() => onOpen(p.slug)} className="glass"
                style={{ textAlign: "left", padding: 0, overflow: "hidden", cursor: "pointer", color: "var(--text)" }}>
                <div style={{ height: 5, background: "linear-gradient(90deg, var(--gameloop), var(--artstyle), var(--content), var(--threads), var(--scope))" }} />
                <div style={{ padding: 18 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, color: "var(--text)" }}>{p.title}</div>
                  <div className="mono" style={{ marginTop: 9 }}>{p.slug}</div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        {list && list.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 4px" }}>{t("projects.empty")}</div>
        )}
      </div>
    </div>
  );
}
