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
  assist: (slug, scope, action) => req("POST", `/api/projects/${slug}/assist`, { scope, action }),
};
