import { loadConfig } from "../config.js";
import { getProject } from "../storage/projects.js";
import { subtreeToMarkdown, flattenToMarkdown } from "../storage/tree.js";

const PROMPTS = {
  gaps: "Du bist Game-Design-Co-Pilot. Finde Lücken, Widersprüche und offene Fragen im folgenden Design-Ausschnitt. Antworte in knappen Stichpunkten auf Deutsch.",
  summarize: "Fasse den folgenden Design-Strang in 3-5 Sätzen klar zusammen (Deutsch).",
  alternative: "Schlage 2-3 konkrete alternative Design-Ansätze zum folgenden Ausschnitt vor (Deutsch, je 1-2 Sätze).",
};

export async function assist(slug, { scope, action }) {
  const cfg = loadConfig();
  if (!cfg.ai.baseUrl) throw new Error("Kein lokaler KI-Endpunkt konfiguriert (data/config.json -> ai.baseUrl).");
  const project = await getProject(slug);
  if (!project) throw new Error("Projekt nicht gefunden");
  const context = scope?.nodeId
    ? subtreeToMarkdown(project, project.nodes, scope.nodeId)
    : flattenToMarkdown(project, project.nodes);
  const system = PROMPTS[action] || PROMPTS.gaps;

  const res = await fetch(`${cfg.ai.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cfg.ai.apiKey ? { Authorization: `Bearer ${cfg.ai.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: cfg.ai.model || "local",
      messages: [{ role: "system", content: system }, { role: "user", content: context }],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`KI-Endpunkt Fehler ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content ?? "" };
}
