import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";
import { useT } from "./i18n/index.jsx";
import { useWork } from "./workContext.jsx";
import Login from "./pages/Login.jsx";
import Projects from "./pages/Projects.jsx";
import Project from "./pages/Project.jsx";
import SettingsGear from "./components/SettingsGear.jsx";
import ProjectConfigGear from "./components/ProjectConfig.jsx";
import ChatWidget from "./components/ChatWidget.jsx";

export default function App() {
  const { t } = useT();
  const { setWork } = useWork();
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  // remember where you were so a browser refresh doesn't kick you back to the projects list
  const [route, setRoute] = useState(() => {
    try {
      const r = JSON.parse(localStorage.getItem("gs_route") || "null");
      if (r && (r.name === "projects" || (r.name === "project" && r.slug))) return r;
    } catch { /* ignore */ }
    return { name: "projects" };
  });

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => { try { localStorage.setItem("gs_route", JSON.stringify(route)); } catch { /* ignore */ } }, [route]);

  // stable so child effects (Project.reload) don't churn
  const openProject = useCallback((slug) => setRoute({ name: "project", slug }), []);
  const goProjects = useCallback(() => setRoute({ name: "projects" }), []);

  // keep the copilot's "what's open" in sync with the route (node is set by Project)
  useEffect(() => {
    setWork({ slug: route.name === "project" ? route.slug : null, nodeId: null });
  }, [route, setWork]);

  if (!ready)
    return <div className="mono" style={{ display: "grid", placeItems: "center", height: "100%" }}>{t("common.loading")}</div>;
  if (!me) return <Login onAuthed={(name) => setMe({ name })} />;

  const currentSlug = route.name === "project" ? route.slug : null;

  return (
    <>
      {route.name === "project" ? (
        <Project key={route.slug} slug={route.slug} me={me} onBack={goProjects} />
      ) : (
        <Projects
          me={me}
          onOpen={openProject}
          onLogout={async () => { await api.logout(); setMe(null); }}
        />
      )}
      <SettingsGear slug={currentSlug} />
      {currentSlug && <ProjectConfigGear slug={currentSlug} />}
      <ChatWidget userName={me.name} />
    </>
  );
}
