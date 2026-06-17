import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";

export default function CanvasPane({ slug, node }) {
  const { t } = useT();
  const [initial, setInitial] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    let ok = true;
    api.canvas(slug, node.id).then((d) => {
      if (ok) setInitial({ elements: d.elements || [], appState: { viewBackgroundColor: "transparent" } });
    });
    return () => { ok = false; };
  }, [node.id]);

  if (!initial) return <div className="mono">{t("editor.canvasLoading")}</div>;

  return (
    <div style={{ height: "68vh", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
      <Excalidraw theme="dark" initialData={initial}
        onChange={(elements, appState) => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            api.saveCanvas(slug, node.id, { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } });
          }, 900);
        }} />
    </div>
  );
}
