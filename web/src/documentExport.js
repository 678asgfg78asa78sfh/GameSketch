import DOMPurify from "dompurify";
import { api } from "./api.js";
import { orderedNodes, renderMarkdown, escapeHtml as esc } from "./nodeLinks.js";

export const isImage = (path) => /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path);
export async function canvasSvg(slug, id) {
  const scene = await api.canvas(slug, id);
  const elements = (scene.elements || []).filter((e) => !e.isDeleted);
  if (!elements.length) return "";
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg({ elements, files: scene.files || {}, appState: { ...scene.appState, exportBackground: true, viewBackgroundColor: "#ffffff", exportWithDarkMode: false } });
  return DOMPurify.sanitize(svg.outerHTML, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["style"] });
}
const dataUrl = (blob) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });

export async function standaloneDocument(project, t, lang) {
  const nodes = orderedNodes(project), media = new Map();
  async function embed(path) {
    if (!media.has(path)) media.set(path, (async () => {
      const response = await fetch(`/api/projects/${project.slug}/${path}`);
      if (!response.ok) throw new Error(`${path}: ${response.statusText}`);
      return dataUrl(await response.blob());
    })());
    return media.get(path);
  }
  const toc = nodes.map((n) => `<li style="margin-left:${n.depth * 16}px"><a href="#node-${n.id}">${esc(n.title)}</a></li>`).join("");
  const sections = [];
  for (const n of nodes) {
    const doc = new DOMParser().parseFromString(DOMPurify.sanitize(renderMarkdown(n.body, project.nodes)), "text/html");
    for (const el of doc.querySelectorAll("[src], a[href]")) {
      const attr = el.hasAttribute("src") ? "src" : "href", url = el.getAttribute(attr);
      const prefix = `/api/projects/${project.slug}/`;
      const path = url.startsWith(prefix) ? url.slice(prefix.length) : url;
      if (/^assets\/[A-Za-z0-9_.-]+$/.test(path)) el.setAttribute(attr, await embed(path));
    }
    const attachments = [];
    for (const path of n.attachments || []) {
      const url = await embed(path), name = path.split("/").pop();
      attachments.push(isImage(path) ? `<figure><img src="${url}" alt="${esc(name)}"><figcaption>${esc(name)}</figcaption></figure>` : `<p><a download="${esc(name)}" href="${url}">${esc(name)}</a></p>`);
    }
    const svg = n.canvas ? await canvasSvg(project.slug, n.id) : "";
    sections.push(`<section id="node-${n.id}"><p class="meta">${esc(project.categories.find((c) => c.slug === n.pillar)?.label || n.pillar)} · ${esc(n.status)} · ${esc(t(`progress.${n.progress || "new"}`))}</p><h2>${esc(n.title)}</h2>${doc.body.innerHTML}${attachments.join("")}${svg ? `<figure>${svg}</figure>` : ""}</section>`);
  }
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(project.title)}</title><style>
body{font:16px/1.65 system-ui,sans-serif;max-width:1000px;margin:auto;padding:40px;color:#172033;background:#fff}h1,h2,h3{line-height:1.2}a{color:#394dcc}section{border-top:1px solid #dce1e8;margin-top:36px;padding-top:24px;scroll-margin-top:20px}.meta,figcaption{color:#526071;font-size:13px}img,svg{max-width:100%;height:auto}svg{max-height:700px}figure{margin:20px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f7;padding:16px;border-radius:8px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dce1e8;padding:8px;text-align:left}blockquote{border-left:3px solid #7c8cff;padding-left:16px}.missing-link{color:#a33;text-decoration:underline dotted}nav ul{list-style:none;padding-left:0}@media print{body{padding:0}figure{break-inside:avoid}}
</style></head><body><h1>${esc(project.title)}</h1><nav aria-label="${esc(t("qol.contents"))}"><h2>${esc(t("qol.contents"))}</h2><ul>${toc}</ul></nav>${sections.join("")}</body></html>`;
}
