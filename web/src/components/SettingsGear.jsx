import { useState } from "react";
import { useT } from "../i18n/index.jsx";
import SettingsPanel from "./SettingsPanel.jsx";

// Fixed cog in the bottom-left corner; opens the settings panel. `slug` (or null) is the
// currently open project, used to fill concrete read-API URLs in the How-To section.
export default function SettingsGear({ slug }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} title={t("settings.gear")} aria-label={t("settings.gear")}
        className="glass"
        style={{ position: "fixed", left: 16, bottom: 16, zIndex: 40, width: 46, height: 46, borderRadius: 99, display: "grid", placeItems: "center", cursor: "pointer", fontSize: 21, padding: 0, lineHeight: 1 }}>
        ⚙
      </button>
      {open && <SettingsPanel slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}
