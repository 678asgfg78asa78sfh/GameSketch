import { loadConfig } from "../config.js";
import { getProject } from "../storage/projects.js";
import { subtreeToMarkdown, flattenToMarkdown } from "../storage/tree.js";
import { chat } from "./providers.js";

const LANG_NAME = { en: "English", de: "German (Deutsch)", ru: "Russian (Русский)" };

const PROMPTS = {
  gaps: (L) =>
    `You are a game-design co-pilot. Find gaps, contradictions and open questions in the following design excerpt. Answer in concise bullet points. Write your answer in ${L}.`,
  summarize: (L) =>
    `Summarize the following design thread clearly in 3-5 sentences. Write your answer in ${L}.`,
  alternative: (L) =>
    `Propose 2-3 concrete alternative design approaches to the following excerpt (1-2 sentences each). Write your answer in ${L}.`,
};

export async function assist(slug, { scope, action, lang }) {
  const cfg = loadConfig();
  const project = await getProject(slug);
  if (!project) throw new Error("project not found");
  const context = scope?.nodeId
    ? subtreeToMarkdown(project, project.nodes, scope.nodeId)
    : flattenToMarkdown(project, project.nodes);
  const L = LANG_NAME[lang] || LANG_NAME.en;
  const system = (PROMPTS[action] || PROMPTS.gaps)(L);
  return chat(cfg, { system, user: context });
}
