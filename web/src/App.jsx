import { useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./pages/Login.jsx";
import Projects from "./pages/Projects.jsx";
import Project from "./pages/Project.jsx";

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState({ name: "projects" });

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true));
  }, []);

  if (!ready)
    return <div className="mono" style={{ display: "grid", placeItems: "center", height: "100%" }}>lädt …</div>;
  if (!me) return <Login onAuthed={(name) => setMe({ name })} />;
  if (route.name === "project")
    return <Project slug={route.slug} me={me} onBack={() => setRoute({ name: "projects" })} />;
  return (
    <Projects
      me={me}
      onOpen={(slug) => setRoute({ name: "project", slug })}
      onLogout={async () => { await api.logout(); setMe(null); }}
    />
  );
}
