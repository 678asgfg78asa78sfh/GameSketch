import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";

export default function CanvasPane({ slug, node, maximized }) {
  const { t } = useT();
  const [initial, setInitial] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    let ok = true;
    api.canvas(slug, node.id).then((d) => {
      // Restore the image blobs (files) too — without them, image elements render as gray
      // boxes when the canvas remounts (e.g. after switching to another tab and back).
      if (ok) setInitial({
        elements: d.elements || [],
        files: d.files || undefined,
        appState: { viewBackgroundColor: d.appState?.viewBackgroundColor || "transparent" },
      });
    });
    return () => { ok = false; };
  }, [node.id]);

  if (!initial) return <div className="mono">{t("editor.canvasLoading")}</div>;

  return (
    <div style={{ height: maximized ? "calc(100vh - 230px)" : "68vh", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
      <Excalidraw theme="dark" initialData={initial}
        onChange={(elements, appState, files) => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            // Persist image blobs (files) alongside elements, else pasted/dropped images
            // are lost on reload and come back as gray boxes.
            api.saveCanvas(slug, node.id, { elements, files, appState: { viewBackgroundColor: appState.viewBackgroundColor } });
          }, 900);
        }} />
    </div>
  );
}
