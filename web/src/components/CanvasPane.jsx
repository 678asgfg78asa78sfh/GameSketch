import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { api } from "../api.js";
import { useT } from "../i18n/index.jsx";
import { useAutosave } from "../useAutosave.js";

export default function CanvasPane({ slug, node, maximized }) {
  const { t } = useT();
  const [initial, setInitial] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const lastScene = useRef(null);
  const { saved, error, queue, flush } = useAutosave((scene) => api.saveCanvas(slug, node.id, scene), 900);

  useEffect(() => {
    let ok = true;
    setInitial(null); setLoadError("");
    api.canvas(slug, node.id).then((d) => {
      // Restore the image blobs (files) too — without them, image elements render as gray
      // boxes when the canvas remounts (e.g. after switching to another tab and back).
      if (ok) setInitial({
        elements: d.elements || [],
        files: d.files || undefined,
        appState: { viewBackgroundColor: d.appState?.viewBackgroundColor || "transparent" },
      });
    }).catch((e) => { if (ok) setLoadError(e.message || String(e)); });
    return () => { ok = false; };
  }, [slug, node.id, attempt]);

  if (loadError) return <div role="alert" style={{ color: "var(--gameloop)" }}>
    {loadError} <button className="btn btn-ghost" onClick={() => setAttempt((n) => n + 1)}>{t("common.retry")}</button>
  </div>;
  if (!initial) return <div className="mono">{t("editor.canvasLoading")}</div>;

  return (
    <>
      <div className="mono" style={{ marginBottom: 8, color: error ? "var(--gameloop)" : "var(--text-faint)" }} role={error ? "alert" : "status"}>
        {error ? `${t("editor.saveFailed")}: ${error.message}` : saved ? t("editor.saved") : t("editor.saving")}
        {error && <button className="btn btn-ghost" onClick={() => flush().catch(() => {})}>{t("common.retry")}</button>}
      </div>
      <div style={{ height: maximized ? "calc(100vh - 230px)" : "68vh", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
        <Excalidraw theme="dark" initialData={initial}
          onChange={(elements, appState, files) => {
            const scene = { elements, files, appState: { viewBackgroundColor: appState.viewBackgroundColor } };
            const serialized = JSON.stringify(scene);
            if (serialized === lastScene.current) return;
            lastScene.current = serialized;
            queue(scene);
          }} />
      </div>
    </>
  );
}
