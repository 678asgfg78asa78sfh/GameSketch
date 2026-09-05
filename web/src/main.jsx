import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/workspace.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n/index.jsx";
import { WorkProvider } from "./workContext.jsx";

createRoot(document.getElementById("root")).render(
  <I18nProvider>
    <WorkProvider>
      <App />
    </WorkProvider>
  </I18nProvider>
);
