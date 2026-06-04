import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import { spring, fadeUp } from "../motion.js";

const PILLARS = [
  ["Gameloop", "--gameloop"], ["Grafik", "--artstyle"], ["Inhalt", "--content"],
  ["Stränge", "--threads"], ["Scope", "--scope"],
];

export default function Projects({ me, onOpen, onLogout }) {
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
            <button className="btn btn-ghost" onClick={onLogout}>Logout</button>
          </div>
        </header>

        <div style={{ display: "flex", gap: 16, marginBottom: 38, color: "var(--text-faint)", fontSize: 12.5, flexWrap: "wrap" }}>
          {PILLARS.map(([l, c]) => (
            <span key={l} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ color: `var(${c})`, background: `var(${c})` }} />{l}
            </span>
          ))}
        </div>

        <motion.h1 variants={fadeUp} initial="initial" animate="animate" custom={0} style={{ fontSize: 42, marginBottom: 6 }}>
          Deine Projekte
        </motion.h1>
        <motion.p variants={fadeUp} initial="initial" animate="animate" custom={1}
          style={{ color: "var(--text-dim)", marginTop: 0, marginBottom: 24, fontSize: 16 }}>
          Bring deine Spielideen als lebenden Baum aufs Papier.
        </motion.p>

        <motion.form variants={fadeUp} initial="initial" animate="animate" custom={2} onSubmit={create}
          style={{ display: "flex", gap: 10, marginBottom: 32 }}>
          <input className="field" placeholder="Neues Projekt benennen…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>＋ Neues Projekt</button>
        </motion.form>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(232px,1fr))", gap: 16 }}>
          <AnimatePresence>
            {(list || []).map((p, i) => (
              <motion.button key={p.slug} layout variants={fadeUp} initial="initial" animate="animate" exit={{ opacity: 0, scale: 0.96 }}
                custom={3 + i} whileHover={{ y: -5, transition: spring }} whileTap={{ scale: 0.98 }}
                onClick={() => onOpen(p.slug)} className="glass"
                style={{ textAlign: "left", padding: 0, overflow: "hidden", cursor: "pointer" }}>
                <div style={{ height: 5, background: "linear-gradient(90deg, var(--gameloop), var(--artstyle), var(--content), var(--threads), var(--scope))" }} />
                <div style={{ padding: 18 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{p.title}</div>
                  <div className="mono" style={{ marginTop: 9 }}>{p.slug}</div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        {list && list.length === 0 && (
          <div style={{ color: "var(--text-faint)", padding: "30px 4px" }}>Noch keine Projekte — leg oben dein erstes an. ✨</div>
        )}
      </div>
    </div>
  );
}
