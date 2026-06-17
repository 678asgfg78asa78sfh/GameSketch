import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "../api.js";
import { pop } from "../motion.js";
import { useT } from "../i18n/index.jsx";
import LangPicker from "../components/LangPicker.jsx";

export default function Login({ onAuthed }) {
  const { t } = useT();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.needsSetup().then((r) => setNeedsSetup(r.needsSetup)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (needsSetup) await api.setup(name, pw);
      await api.login(name, pw);
      onAuthed(name);
    } catch (e2) { setErr(String(e2.message || e2)); setBusy(false); }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 24 }}>
      <motion.form {...pop} onSubmit={submit} className="glass" style={{ width: 366, padding: 34, display: "grid", gap: 15 }}>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <LangPicker />
        </div>
        <div>
          <div className="brand" style={{ fontSize: 36 }}>GameSketch</div>
          <p style={{ color: "var(--text-dim)", margin: "8px 0 0", fontSize: 14.5 }}>
            {needsSetup ? t("login.setup") : t("login.welcome")}
          </p>
        </div>
        <input className="field" placeholder={t("login.name")} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <input className="field" placeholder={t("login.password")} type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div style={{ color: "var(--gameloop)", fontSize: 13.5 }}>{err}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: "center", padding: 13, fontSize: 15 }}>
          {busy ? "…" : needsSetup ? t("login.create") : t("login.enter")}
        </button>
        <div className="mono" style={{ textAlign: "center", fontSize: 11, opacity: 0.7 }}>{t("common.localTagline")}</div>
      </motion.form>
    </div>
  );
}
