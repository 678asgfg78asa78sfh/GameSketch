async function req(method, url, body) {
  const opts = { method, headers: {}, credentials: "same-origin" };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export const api = {
  needsSetup: () => req("GET", "/api/auth/needs-setup"),
  setup: (name, password) => req("POST", "/api/auth/setup", { name, password }),
  login: (name, password) => req("POST", "/api/auth/login", { name, password }),
  logout: () => req("POST", "/api/auth/logout"),
  me: () => req("GET", "/api/auth/me"),
  changePassword: (current, next) => req("POST", "/api/auth/password", { current, next }),
  getSettings: () => req("GET", "/api/settings"),
  saveSettings: (ai) => req("PUT", "/api/settings", { ai }),
  pullModels: (ai) => req("POST", "/api/settings/ai/models", { ai }),
  testAi: (ai) => req("POST", "/api/settings/ai/test", { ai }),
  chat: (payload) => req("POST", "/api/chat", payload),
  agents: () => req("GET", "/api/pair/agents"),
  approveAgent: (id, mode, hours, scope) => req("POST", `/api/pair/agents/${id}/approve`, { mode, hours, scope }),
  denyAgent: (id) => req("POST", `/api/pair/agents/${id}/deny`),
  revokeAgent: (id) => req("DELETE", `/api/pair/agents/${id}`),
  assistGaps: (slug, nodeId, lang) => req("POST", `/api/projects/${slug}/assist/gaps`, { nodeId, lang }),
  assistPropose: (slug, payload) => req("POST", `/api/projects/${slug}/assist/propose`, payload),
  assistApply: (slug, actions) => req("POST", `/api/projects/${slug}/assist/apply`, { actions }),
  saveCategories: (slug, categories) => req("PUT", `/api/projects/${slug}/categories`, { categories }),
  templates: () => req("GET", "/api/templates"),
  saveTemplate: (name, categories) => req("POST", "/api/templates", { name, categories }),
  deleteTemplate: (name) => req("DELETE", `/api/templates/${encodeURIComponent(name)}`),
  projects: () => req("GET", "/api/projects"),
  createProject: (title) => req("POST", "/api/projects", { title }),
  project: (slug) => req("GET", `/api/projects/${slug}`),
  createNode: (slug, input) => req("POST", `/api/projects/${slug}/nodes`, input),
  updateNode: (slug, id, patch) => req("PATCH", `/api/projects/${slug}/nodes/${id}`, patch),
  deleteNode: (slug, id) => req("DELETE", `/api/projects/${slug}/nodes/${id}`),
  history: (slug, id) => req("GET", `/api/projects/${slug}/nodes/${id}/history`),
  restore: (slug, id, commit) => req("POST", `/api/projects/${slug}/nodes/${id}/restore`, { commit }),
  canvas: (slug, id) => req("GET", `/api/projects/${slug}/canvases/${id}`),
  saveCanvas: (slug, id, json) => req("PUT", `/api/projects/${slug}/canvases/${id}`, json),
  uploadAttachment: (slug, id, file) => {
    const fd = new FormData(); fd.append("file", file);
    return req("POST", `/api/projects/${slug}/nodes/${id}/attachments`, fd);
  },
  assist: (slug, scope, action, lang) => req("POST", `/api/projects/${slug}/assist`, { scope, action, lang }),
};
