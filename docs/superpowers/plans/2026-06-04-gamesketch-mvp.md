# GameSketch MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local-first, no-phone-home web tool where each game project is a 5-pillar tree of Markdown+Git nodes, with a doodle canvas, file attachments, author-per-change, an AI read-API and a local-LLM assist — all served by one Node process, with fluid "2026-smooth" UX.

**Architecture:** One Fastify process serves a built React/Vite frontend and a `/api` REST layer. Each game project is its own Git repo under `data/projects/<slug>/`; nodes are Markdown files with YAML frontmatter; every write is a Git commit authored by the logged-in user (history + restore = Git). Excalidraw provides the canvas. AI is read-only export endpoints plus an optional proxy to a user-configured OpenAI-compatible local endpoint.

**Tech Stack:** Node 20+ (built-in test runner `node --test`, `node:crypto`, `node:child_process`), Fastify + `@fastify/static`, `gray-matter`. Frontend: React + Vite, `@excalidraw/excalidraw`, `@dnd-kit/*` (tree drag), `motion` (springs), `marked` + `dompurify` (markdown render). No CDNs, no telemetry, no Docker.

---

## Conventions (read once)

- **Working dir / app repo:** `K:\GameSketch` (git already initialized, branch `main`).
- **Node version:** 20+ (for stable `node --test`, global `fetch`, `crypto.scrypt`).
- **Backend tests:** Node built-in runner. File next to source as `*.test.js`. Run a single file: `node --test server/storage/tree.test.js`. Run all: `node --test`.
- **No network in tests.** Git tests run against a temp repo under the OS temp dir.
- **Commit style:** `feat:`/`test:`/`chore:` prefix, end every commit body with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Commit cadence:** after each task's tests pass (the final step of every task).
- **ESM everywhere:** `package.json` has `"type": "module"`; use `import`/`export`.
- **Paths:** all data lives under `K:\GameSketch\data\` (gitignored).

## Locked Contracts (every task references these — do not rename)

**Node object** (returned by storage; `body` is the Markdown after frontmatter):
```js
{
  id, title, pillar, status, kind, parent, order,
  alternatives_to, attachments /* string[] */, canvas /* string|null */,
  created_by, created_at, updated_by, updated_at,
  body /* string */
}
```
- `pillar` ∈ `"gameloop" | "artstyle" | "content" | "threads" | "scope"`
- `status` ∈ `"core" | "side" | "future"`
- `kind` ∈ `"idea" | "alternative" | "note"`
- `parent`: node id or `null` (null = directly under the pillar)

**PILLARS constant** (fixed order, used for rendering + export):
```js
export const PILLARS = [
  { slug: "gameloop", label: "Gameloop" },
  { slug: "artstyle", label: "Grafikstil" },
  { slug: "content",  label: "Inhalt" },
  { slug: "threads",  label: "Stränge" },
  { slug: "scope",    label: "Scope" },
];
```

**Module signatures** (implemented across the plan):
```
util/ids.js        ulid(): string
util/slug.js       slugify(s): string
storage/paths.js   dataDir(): string; projectDir(slug); nodesDir(slug); etc.
storage/git.js     ensureRepo(dir); commitAll(dir,{name,email,message}); fileHistory(dir,rel); fileAtCommit(dir,commit,rel)
storage/tree.js    buildTree(nodes)->{pillar:[{...node,children}]}; flattenToMarkdown(project,nodes)->string; subtreeNodes(nodes,id)->node[]; subtreeToMarkdown(project,nodes,id)->string
storage/nodes.js   listNodes(slug); getNode(slug,id); createNode(slug,input,author); updateNode(slug,id,patch,author); moveNode(slug,id,{parent,order},author); deleteNode(slug,id,author); nodeHistory(slug,id); restoreNode(slug,id,commit,author)
storage/projects.js listProjects(); createProject({title},author); getProject(slug)
storage/assets.js  saveAsset(slug,nodeId,{filename,buffer},author)->relPath
storage/canvas.js  readCanvas(slug,id); writeCanvas(slug,id,json,author)
config.js          loadConfig(); saveConfig(c); shape {users:[{name,salt,passhash}], session_secret, ai:{baseUrl,model,apiKey}}
auth.js            hashPassword(pw)->{salt,passhash}; verifyPassword(pw,rec)->bool; signSession(name)->cookie; verifySession(cookie)->name|null; requireAuth (fastify preHandler)
ai/extract.js      (uses tree.js; wired in routes)
ai/assist.js       assist(slug,{scope,action})->{text}
```

**Author object** passed into write functions: `{ name, email }` (email defaults to `<name>@local` if unset).

---

## File Structure

```
server/
  index.js              boot Fastify, register plugins+routes, serve web/dist (prod) 
  config.js             load/save data/config.json
  auth.js               scrypt hashing, HMAC session cookie, requireAuth hook
  util/ids.js           ULID generator
  util/slug.js          slugify
  storage/paths.js      resolve data/project/node/asset/canvas paths
  storage/git.js        git init/commit/log/show via child_process
  storage/tree.js       PURE: build nested tree, flatten to markdown, subtree
  storage/nodes.js      node CRUD as md+frontmatter (+commit, +history/restore)
  storage/projects.js   project create/list/get (each = git repo)
  storage/assets.js     save uploaded files
  storage/canvas.js     read/write excalidraw json
  ai/extract.js         json/markdown export helpers (thin over tree.js)
  ai/assist.js          build prompt from subtree md, POST to local endpoint
  routes/auth.routes.js
  routes/projects.routes.js
  routes/nodes.routes.js
  routes/assets.routes.js
  routes/canvas.routes.js
  routes/ai.routes.js
web/
  index.html
  src/main.jsx          React root
  src/App.jsx           shell + tiny router (auth gate)
  src/api.js            fetch wrapper for /api
  src/styles/tokens.css design tokens + local @font-face
  src/styles/global.css
  src/motion.js         spring presets for `motion`
  src/pages/Login.jsx
  src/pages/Projects.jsx
  src/pages/Project.jsx
  src/components/Tree.jsx, TreeNode.jsx, NodeEditor.jsx, MarkdownView.jsx,
                 CanvasPane.jsx, Attachments.jsx, HistoryPanel.jsx,
                 AssistPanel.jsx, StatusBadge.jsx, Toolbar.jsx
  src/fonts/            local variable font file(s)
package.json, vite.config.js
```

---

## Phase 0 — Scaffolding & runnable shell

### Task 0.1: package.json + scripts

**Files:**
- Create: `package.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "gamesketch",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:web": "vite",
    "dev:server": "node --watch server/index.js",
    "build": "vite build",
    "start": "cross-env NODE_ENV=production node server/index.js",
    "test": "node --test"
  },
  "dependencies": {
    "@fastify/static": "^7.0.0",
    "fastify": "^4.28.0",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "cross-env": "^7.0.3",
    "vite": "^5.4.0"
  }
}
```

- [ ] **Step 2: Install** — Run: `npm install`. Expected: completes, `node_modules/` created, no audit-blocking errors. (Frontend deps `react`, `@excalidraw/excalidraw`, `@dnd-kit/*`, `motion`, `marked`, `dompurify` are added in Phase 5 to keep early installs small.)

- [ ] **Step 3: Commit**
```bash
git add package.json package-lock.json
git commit -m "chore: scaffold package.json and scripts"
```

### Task 0.2: Fastify server boots and serves a placeholder

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Write `server/index.js`**
```js
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 4321;

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get("/api/health", async () => ({ ok: true }));

  // Serve built frontend in production; in dev, Vite serves the UI separately.
  const dist = join(__dirname, "..", "web", "dist");
  if (existsSync(dist)) {
    app.register(fastifyStatic, { root: dist });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api")) return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html"); // SPA fallback
    });
  }
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = buildServer();
  app.listen({ port: PORT, host: "127.0.0.1" })
    .then(() => console.log(`GameSketch on http://127.0.0.1:${PORT}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Verify it boots** — Run: `node server/index.js` then in another shell `curl http://127.0.0.1:4321/api/health`. Expected: `{"ok":true}`. Stop the server (Ctrl+C).

- [ ] **Step 3: Commit**
```bash
git add server/index.js
git commit -m "feat: boot fastify server with health route and SPA fallback"
```

### Task 0.3: Vite config (local-only, no telemetry, proxy /api in dev)

**Files:**
- Create: `vite.config.js`, `web/index.html`, `web/src/main.jsx`, `web/src/App.jsx`

- [ ] **Step 1: Write `vite.config.js`**
```js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:4321" }, // dev: UI -> server
  },
});
```

- [ ] **Step 2: Write `web/index.html`**
```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GameSketch</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write `web/src/main.jsx` and a placeholder `web/src/App.jsx`**
```jsx
// main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
createRoot(document.getElementById("root")).render(<App />);
```
```jsx
// App.jsx
export default function App() {
  return <h1 style={{ fontFamily: "system-ui", padding: 24 }}>GameSketch ✨</h1>;
}
```
(React deps are installed in Phase 5 Task 5.1; this task only lands the files. If you want to preview now, run Task 5.1's install first.)

- [ ] **Step 4: Commit**
```bash
git add vite.config.js web/index.html web/src/main.jsx web/src/App.jsx
git commit -m "feat: vite config + react entry placeholder"
```

---

## Phase 1 — Storage core (backend, TDD)

### Task 1.1: ULID generator

**Files:**
- Create: `server/util/ids.js`, `server/util/ids.test.js`

- [ ] **Step 1: Write the failing test** `server/util/ids.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { ulid } from "./ids.js";

test("ulid is 26 chars, Crockford base32, monotonic-ish unique", () => {
  const a = ulid(); const b = ulid();
  assert.equal(a.length, 26);
  assert.match(a, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: Run, expect fail** — Run: `node --test server/util/ids.test.js`. Expected: FAIL (`ulid` not found).

- [ ] **Step 3: Implement `server/util/ids.js`**
```js
import { randomBytes } from "node:crypto";
const ENC = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

export function ulid() {
  // 48-bit time + 80-bit randomness, encoded to 26 chars.
  const time = Date.now();
  let ts = "";
  let t = time;
  for (let i = 9; i >= 0; i--) { ts = ENC[t % 32] + ts; t = Math.floor(t / 32); }
  ts = ts.slice(-10);
  const rnd = randomBytes(10);
  let rand = "";
  // encode 80 bits -> 16 chars
  let bits = 0, value = 0;
  for (const byte of rnd) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { rand += ENC[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) rand += ENC[(value << (5 - bits)) & 31];
  return (ts + rand).slice(0, 26);
}
```

- [ ] **Step 4: Run, expect pass** — Run: `node --test server/util/ids.test.js`. Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add server/util/ids.js server/util/ids.test.js
git commit -m "feat: ulid id generator with tests"
```

### Task 1.2: slugify

**Files:**
- Create: `server/util/slug.js`, `server/util/slug.test.js`

- [ ] **Step 1: Failing test** `server/util/slug.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "./slug.js";

test("slugify lowercases, strips, dashifies, handles umlauts", () => {
  assert.equal(slugify("Mein Cooles Spiel!"), "mein-cooles-spiel");
  assert.equal(slugify("Über Größe"), "ueber-groesse");
  assert.equal(slugify("  a  b  "), "a-b");
  assert.equal(slugify(""), "untitled");
});
```

- [ ] **Step 2: Run, expect fail** — Run: `node --test server/util/slug.test.js`.

- [ ] **Step 3: Implement `server/util/slug.js`**
```js
const MAP = { "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss" };
export function slugify(s) {
  const out = String(s).toLowerCase()
    .replace(/[äöüß]/g, (c) => MAP[c])
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return out || "untitled";
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**
```bash
git add server/util/slug.js server/util/slug.test.js
git commit -m "feat: slugify util with tests"
```

### Task 1.3: paths

**Files:**
- Create: `server/storage/paths.js`

- [ ] **Step 1: Implement `server/storage/paths.js`** (no test — pure path joins, exercised by later tests)
```js
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

export function dataDir() { return process.env.GS_DATA_DIR || join(ROOT, "data"); }
export function configPath() { return join(dataDir(), "config.json"); }
export function projectsDir() { return join(dataDir(), "projects"); }
export function projectDir(slug) { return join(projectsDir(), slug); }
export function projectMeta(slug) { return join(projectDir(slug), "project.md"); }
export function nodesDir(slug, pillar) {
  return pillar ? join(projectDir(slug), "nodes", pillar) : join(projectDir(slug), "nodes");
}
export function nodePath(slug, pillar, id) { return join(nodesDir(slug, pillar), `${id}.md`); }
export function assetsDir(slug) { return join(projectDir(slug), "assets"); }
export function canvasDir(slug) { return join(projectDir(slug), "canvases"); }
export function canvasPath(slug, id) { return join(canvasDir(slug), `${id}.excalidraw`); }
```
> Tests set `GS_DATA_DIR` to a temp dir so they never touch real data.

- [ ] **Step 2: Commit**
```bash
git add server/storage/paths.js
git commit -m "feat: storage path resolver (GS_DATA_DIR overridable)"
```

### Task 1.4: git layer

**Files:**
- Create: `server/storage/git.js`, `server/storage/git.test.js`

- [ ] **Step 1: Failing test** `server/storage/git.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureRepo, commitAll, fileHistory, fileAtCommit } from "./git.js";

test("ensureRepo + commitAll + history + show round-trips", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gs-git-"));
  await ensureRepo(dir);
  writeFileSync(join(dir, "a.md"), "v1");
  await commitAll(dir, { name: "ms", email: "ms@local", message: "add a" });
  writeFileSync(join(dir, "a.md"), "v2");
  await commitAll(dir, { name: "ms", email: "ms@local", message: "edit a" });

  const hist = await fileHistory(dir, "a.md");
  assert.equal(hist.length, 2);
  assert.equal(hist[0].author, "ms");           // newest first
  const old = await fileAtCommit(dir, hist[1].commit, "a.md");
  assert.equal(old, "v1");
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/storage/git.js`**
```js
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { join } from "node:path";
const run = promisify(execFile);

async function git(dir, args, opts = {}) {
  const { stdout } = await run("git", ["-C", dir, ...args], { maxBuffer: 64 * 1024 * 1024, ...opts });
  return stdout;
}

export async function ensureRepo(dir) {
  if (existsSync(join(dir, ".git"))) return;
  await git(dir, ["init", "-b", "main"]);
  await git(dir, ["config", "user.name", "GameSketch"]);
  await git(dir, ["config", "user.email", "gamesketch@local"]);
}

export async function commitAll(dir, { name, email, message }) {
  await git(dir, ["add", "-A"]);
  // Skip empty commits silently.
  const status = await git(dir, ["status", "--porcelain"]);
  if (!status.trim()) return null;
  await git(dir, ["-c", `user.name=${name}`, "-c", `user.email=${email}`,
    "commit", "-m", message]);
  return (await git(dir, ["rev-parse", "HEAD"])).trim();
}

export async function fileHistory(dir, rel) {
  const fmt = "%H%x1f%an%x1f%aI%x1f%s";
  const out = await git(dir, ["log", `--format=${fmt}`, "--", rel]);
  return out.split("\n").filter(Boolean).map((line) => {
    const [commit, author, date, message] = line.split("\x1f");
    return { commit, author, date, message };
  });
}

export async function fileAtCommit(dir, commit, rel) {
  return await git(dir, ["show", `${commit}:${rel.replace(/\\/g, "/")}`]);
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**
```bash
git add server/storage/git.js server/storage/git.test.js
git commit -m "feat: git storage layer (init/commit/history/show) with tests"
```

### Task 1.5: tree (PURE brain — build/flatten/subtree)

**Files:**
- Create: `server/storage/tree.js`, `server/storage/tree.test.js`

- [ ] **Step 1: Failing test** `server/storage/tree.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTree, flattenToMarkdown, subtreeNodes, subtreeToMarkdown } from "./tree.js";

const nodes = [
  { id: "a", title: "Loop", pillar: "gameloop", status: "core", kind: "idea", parent: null, order: 0, body: "core loop" },
  { id: "b", title: "Combat", pillar: "gameloop", status: "core", kind: "idea", parent: "a", order: 0, body: "swing" },
  { id: "c", title: "Stealth alt", pillar: "gameloop", status: "side", kind: "alternative", parent: "a", order: 1, alternatives_to: "b", body: "sneak" },
];
const project = { title: "Demo" };

test("buildTree nests by parent within pillar, sorted by order", () => {
  const t = buildTree(nodes);
  assert.equal(t.gameloop.length, 1);
  assert.equal(t.gameloop[0].children.length, 2);
  assert.equal(t.gameloop[0].children[0].id, "b");
  assert.deepEqual(Object.keys(t), ["gameloop","artstyle","content","threads","scope"]);
});

test("flattenToMarkdown emits pillar headings and node bodies", () => {
  const md = flattenToMarkdown(project, nodes);
  assert.match(md, /# Demo/);
  assert.match(md, /## Gameloop/);
  assert.match(md, /Loop/);
  assert.match(md, /\[side\]/); // status surfaced
});

test("subtreeNodes returns node + descendants", () => {
  const sub = subtreeNodes(nodes, "a");
  assert.deepEqual(sub.map(n => n.id).sort(), ["a","b","c"]);
  assert.match(subtreeToMarkdown(project, nodes, "a"), /Combat/);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/storage/tree.js`**
```js
export const PILLARS = [
  { slug: "gameloop", label: "Gameloop" },
  { slug: "artstyle", label: "Grafikstil" },
  { slug: "content",  label: "Inhalt" },
  { slug: "threads",  label: "Stränge" },
  { slug: "scope",    label: "Scope" },
];

export function buildTree(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = Object.fromEntries(PILLARS.map((p) => [p.slug, []]));
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else (roots[n.pillar] ||= []).push(n);
  }
  const sortRec = (arr) => {
    arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    arr.forEach((x) => sortRec(x.children));
  };
  Object.values(roots).forEach(sortRec);
  return roots;
}

function emitNode(n, depth, out) {
  const tag = n.kind === "alternative" ? " (Alternative)" : n.kind === "note" ? " (Notiz)" : "";
  out.push(`${"#".repeat(Math.min(depth, 6))} ${n.title} [${n.status}]${tag}`);
  if (n.body && n.body.trim()) out.push("", n.body.trim());
  out.push("");
  n.children.forEach((c) => emitNode(c, depth + 1, out));
}

export function flattenToMarkdown(project, nodes) {
  const tree = buildTree(nodes);
  const out = [`# ${project.title || "Untitled"}`, ""];
  for (const p of PILLARS) {
    out.push(`## ${p.label}`, "");
    (tree[p.slug] || []).forEach((n) => emitNode(n, 3, out));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function subtreeNodes(nodes, id) {
  const childrenOf = new Map();
  for (const n of nodes) {
    if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
    childrenOf.get(n.parent).push(n);
  }
  const root = nodes.find((n) => n.id === id);
  if (!root) return [];
  const acc = [root];
  const walk = (pid) => (childrenOf.get(pid) || []).forEach((c) => { acc.push(c); walk(c.id); });
  walk(id);
  return acc;
}

export function subtreeToMarkdown(project, nodes, id) {
  const sub = subtreeNodes(nodes, id);
  const tree = buildTree(sub.map((n) => (n.id === id ? { ...n, parent: null } : n)));
  const root = Object.values(tree).flat()[0];
  const out = [`# ${project.title || "Untitled"} — Teilbaum`, ""];
  if (root) emitNode(root, 2, out);
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
```

- [ ] **Step 4: Run, expect pass.**

- [ ] **Step 5: Commit**
```bash
git add server/storage/tree.js server/storage/tree.test.js
git commit -m "feat: pure tree build/flatten/subtree logic with tests"
```

### Task 1.6: nodes CRUD (md + frontmatter, commit on write)

**Files:**
- Create: `server/storage/nodes.js`, `server/storage/nodes.test.js`

- [ ] **Step 1: Failing test** `server/storage/nodes.test.js`
```js
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-nodes-"));
const { createProject } = await import("./projects.js");
const { createNode, listNodes, getNode, updateNode, moveNode, deleteNode, nodeHistory, restoreNode } = await import("./nodes.js");

const author = { name: "ms", email: "ms@local" };

test("create/list/get node", async () => {
  const p = await createProject({ title: "T" }, author);
  const n = await createNode(p.slug, { pillar: "gameloop", title: "Loop", body: "v1" }, author);
  assert.equal(n.title, "Loop");
  assert.equal(n.status, "core");           // default
  assert.equal(n.kind, "idea");             // default
  const all = await listNodes(p.slug);
  assert.equal(all.length, 1);
  assert.equal((await getNode(p.slug, n.id)).body, "v1");
});

test("update bumps history; restore brings old body back", async () => {
  const p = await createProject({ title: "T2" }, author);
  const n = await createNode(p.slug, { pillar: "content", title: "X", body: "first" }, author);
  await updateNode(p.slug, n.id, { body: "second" }, author);
  const hist = await nodeHistory(p.slug, n.id);
  assert.ok(hist.length >= 2);
  await restoreNode(p.slug, n.id, hist[hist.length - 1].commit, author);
  assert.equal((await getNode(p.slug, n.id)).body, "first");
});

test("move changes parent/order; delete removes file", async () => {
  const p = await createProject({ title: "T3" }, author);
  const a = await createNode(p.slug, { pillar: "threads", title: "A" }, author);
  const b = await createNode(p.slug, { pillar: "threads", title: "B" }, author);
  await moveNode(p.slug, b.id, { parent: a.id, order: 0 }, author);
  assert.equal((await getNode(p.slug, b.id)).parent, a.id);
  await deleteNode(p.slug, b.id, author);
  assert.equal(await getNode(p.slug, b.id), null);
});
```

- [ ] **Step 2: Run, expect fail** (modules missing).

- [ ] **Step 3: Implement `server/storage/nodes.js`**
```js
import matter from "gray-matter";
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ulid } from "../util/ids.js";
import { nodesDir, nodePath, projectDir } from "./paths.js";
import { commitAll, fileHistory, fileAtCommit } from "./git.js";

const PILLARS = ["gameloop", "artstyle", "content", "threads", "scope"];

function nowIso() { return new Date().toISOString(); }

function fileToNode(file, raw) {
  const { data, content } = matter(raw);
  return { ...data, body: content.replace(/^\n/, "").replace(/\n$/, "") };
}

function nodeToFile(n) {
  const { body, ...fm } = n;
  return matter.stringify(body ? `\n${body}\n` : "\n", fm);
}

function relFor(n) { return join("nodes", n.pillar, `${n.id}.md`); }

export async function listNodes(slug) {
  const base = nodesDir(slug);
  if (!existsSync(base)) return [];
  const out = [];
  for (const pillar of PILLARS) {
    const dir = join(base, pillar);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".md")) continue;
      out.push(fileToNode(f, readFileSync(join(dir, f), "utf8")));
    }
  }
  return out;
}

export async function getNode(slug, id) {
  return (await listNodes(slug)).find((n) => n.id === id) || null;
}

export async function createNode(slug, input, author) {
  const id = ulid();
  const ts = nowIso();
  const n = {
    id, title: input.title || "Neue Idee",
    pillar: input.pillar, status: input.status || "core",
    kind: input.kind || "idea", parent: input.parent ?? null,
    order: input.order ?? Date.now() % 100000,
    alternatives_to: input.alternatives_to ?? null,
    attachments: input.attachments || [], canvas: input.canvas ?? null,
    created_by: author.name, created_at: ts, updated_by: author.name, updated_at: ts,
    body: input.body || "",
  };
  if (!PILLARS.includes(n.pillar)) throw new Error(`bad pillar: ${n.pillar}`);
  mkdirSync(nodesDir(slug, n.pillar), { recursive: true });
  writeFileSync(nodePath(slug, n.pillar, id), nodeToFile(n));
  await commitAll(projectDir(slug), { ...author, message: `node: create "${n.title}"` });
  return n;
}

export async function updateNode(slug, id, patch, author) {
  const n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const next = { ...n, ...patch, id: n.id, pillar: patch.pillar || n.pillar,
    updated_by: author.name, updated_at: nowIso() };
  // if pillar changed, remove old file
  if (next.pillar !== n.pillar) rmSync(nodePath(slug, n.pillar, id));
  mkdirSync(nodesDir(slug, next.pillar), { recursive: true });
  writeFileSync(nodePath(slug, next.pillar, id), nodeToFile(next));
  await commitAll(projectDir(slug), { ...author, message: `node: edit "${next.title}"` });
  return next;
}

export async function moveNode(slug, id, { parent, order }, author) {
  return updateNode(slug, id, { parent: parent ?? null, order: order ?? 0 }, author);
}

export async function deleteNode(slug, id, author) {
  const n = await getNode(slug, id);
  if (!n) return;
  rmSync(nodePath(slug, n.pillar, id));
  await commitAll(projectDir(slug), { ...author, message: `node: delete "${n.title}"` });
}

export async function nodeHistory(slug, id) {
  const n = await getNode(slug, id);
  if (!n) return [];
  return fileHistory(projectDir(slug), relFor(n));
}

export async function restoreNode(slug, id, commit, author) {
  const n = await getNode(slug, id);
  if (!n) throw new Error("node not found");
  const raw = await fileAtCommit(projectDir(slug), commit, relFor(n));
  writeFileSync(nodePath(slug, n.pillar, id), raw);
  await commitAll(projectDir(slug), { ...author, message: `node: restore "${n.title}"` });
  return fileToNode(`${id}.md`, raw);
}
```

- [ ] **Step 4: Run, expect pass** (also exercises projects.js from next task — implement Task 1.7 first if running in isolation; in sequence, write projects.js before running this).

> **Ordering note:** `nodes.test.js` imports `projects.js`. Implement Task 1.7 (`projects.js`) before running this test. Write both, then run 1.6 and 1.7 tests together: `node --test server/storage/`.

- [ ] **Step 5: Commit**
```bash
git add server/storage/nodes.js server/storage/nodes.test.js
git commit -m "feat: node CRUD as markdown+frontmatter with git history/restore"
```

### Task 1.7: projects create/list/get

**Files:**
- Create: `server/storage/projects.js`, `server/storage/projects.test.js`

- [ ] **Step 1: Failing test** `server/storage/projects.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-proj-"));
const { createProject, listProjects, getProject } = await import("./projects.js");

test("create -> unique slug, git repo, listable, getable", async () => {
  const author = { name: "ms", email: "ms@local" };
  const a = await createProject({ title: "My Game" }, author);
  const b = await createProject({ title: "My Game" }, author); // dup title
  assert.equal(a.slug, "my-game");
  assert.notEqual(a.slug, b.slug); // disambiguated
  const list = await listProjects();
  assert.equal(list.length, 2);
  const got = await getProject(a.slug);
  assert.equal(got.title, "My Game");
  assert.deepEqual(got.nodes, []);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/storage/projects.js`**
```js
import matter from "gray-matter";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { slugify } from "../util/slug.js";
import { projectsDir, projectDir, projectMeta, nodesDir } from "./paths.js";
import { ensureRepo, commitAll } from "./git.js";
import { listNodes } from "./nodes.js";

const PILLARS = ["gameloop", "artstyle", "content", "threads", "scope"];

function uniqueSlug(base) {
  let slug = base, i = 2;
  while (existsSync(projectDir(slug))) slug = `${base}-${i++}`;
  return slug;
}

export async function createProject({ title }, author) {
  mkdirSync(projectsDir(), { recursive: true });
  const slug = uniqueSlug(slugify(title));
  const dir = projectDir(slug);
  mkdirSync(dir, { recursive: true });
  for (const p of PILLARS) mkdirSync(nodesDir(slug, p), { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "canvases"), { recursive: true });
  const meta = matter.stringify("\n", {
    title, slug, created_by: author.name, created_at: new Date().toISOString(),
    pillars: PILLARS,
  });
  writeFileSync(projectMeta(slug), meta);
  // keep empty pillar dirs in git
  for (const p of PILLARS) writeFileSync(join(nodesDir(slug, p), ".gitkeep"), "");
  await ensureRepo(dir);
  await commitAll(dir, { ...author, message: `project: create "${title}"` });
  return { slug, title };
}

export async function listProjects() {
  const base = projectsDir();
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((s) => existsSync(projectMeta(s)))
    .map((slug) => {
      const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
      return { slug, title: data.title, created_at: data.created_at };
    });
}

export async function getProject(slug) {
  if (!existsSync(projectMeta(slug))) return null;
  const { data } = matter(readFileSync(projectMeta(slug), "utf8"));
  return { ...data, slug, nodes: await listNodes(slug) };
}
```

- [ ] **Step 4: Run, expect pass** — Run: `node --test server/storage/`. Expected: projects + nodes + tree + git + util tests all PASS.

- [ ] **Step 5: Commit**
```bash
git add server/storage/projects.js server/storage/projects.test.js
git commit -m "feat: project create/list/get (each project = git repo)"
```

### Task 1.8: assets + canvas storage

**Files:**
- Create: `server/storage/assets.js`, `server/storage/canvas.js`, `server/storage/assets.test.js`

- [ ] **Step 1: Failing test** `server/storage/assets.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-asset-"));
const { createProject } = await import("./projects.js");
const { saveAsset } = await import("./assets.js");
const { writeCanvas, readCanvas } = await import("./canvas.js");
const author = { name: "ms", email: "ms@local" };

test("saveAsset returns repo-relative path and writes file", async () => {
  const p = await createProject({ title: "A" }, author);
  const rel = await saveAsset(p.slug, "node1", { filename: "sketch.png", buffer: Buffer.from("PNGDATA") }, author);
  assert.match(rel, /^assets\/[a-f0-9]{8}-sketch\.png$/);
  assert.ok(existsSync(join(process.env.GS_DATA_DIR, "projects", p.slug, rel)));
});

test("canvas write/read round-trips JSON", async () => {
  const p = await createProject({ title: "C" }, author);
  await writeCanvas(p.slug, "n1", { elements: [], appState: {} }, author);
  assert.deepEqual((await readCanvas(p.slug, "n1")).elements, []);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/storage/assets.js`**
```js
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { assetsDir, projectDir } from "./paths.js";
import { commitAll } from "./git.js";

export async function saveAsset(slug, nodeId, { filename, buffer }, author) {
  mkdirSync(assetsDir(slug), { recursive: true });
  const hash = createHash("sha1").update(buffer).digest("hex").slice(0, 8);
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const rel = `assets/${hash}-${safe}`;
  writeFileSync(join(projectDir(slug), rel), buffer);
  await commitAll(projectDir(slug), { ...author, message: `asset: add ${safe}` });
  return rel;
}
```

- [ ] **Step 4: Implement `server/storage/canvas.js`**
```js
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { canvasPath, canvasDir, projectDir } from "./paths.js";
import { commitAll } from "./git.js";

export async function writeCanvas(slug, id, json, author) {
  mkdirSync(canvasDir(slug), { recursive: true });
  writeFileSync(canvasPath(slug, id), JSON.stringify(json, null, 2));
  await commitAll(projectDir(slug), { ...author, message: `canvas: update ${id}` });
}
export async function readCanvas(slug, id) {
  if (!existsSync(canvasPath(slug, id))) return { elements: [], appState: {} };
  return JSON.parse(readFileSync(canvasPath(slug, id), "utf8"));
}
```

- [ ] **Step 5: Run, expect pass; Commit**
```bash
git add server/storage/assets.js server/storage/canvas.js server/storage/assets.test.js
git commit -m "feat: asset upload + excalidraw canvas storage with tests"
```

---

## Phase 2 — Config & Auth

### Task 2.1: config load/save

**Files:**
- Create: `server/config.js`, `server/config.test.js`

- [ ] **Step 1: Failing test** `server/config.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-cfg-"));
const { loadConfig, saveConfig } = await import("./config.js");

test("loadConfig returns defaults; saveConfig persists", async () => {
  const c = loadConfig();
  assert.deepEqual(c.users, []);
  assert.ok(c.session_secret.length >= 32);
  c.ai.baseUrl = "http://127.0.0.1:1234/v1";
  saveConfig(c);
  assert.equal(loadConfig().ai.baseUrl, "http://127.0.0.1:1234/v1");
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/config.js`**
```js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { configPath, dataDir } from "./storage/paths.js";

function defaults() {
  return {
    users: [],
    session_secret: randomBytes(32).toString("hex"),
    ai: { baseUrl: "", model: "", apiKey: "" },
  };
}

export function loadConfig() {
  if (!existsSync(configPath())) {
    mkdirSync(dataDir(), { recursive: true });
    const c = defaults();
    writeFileSync(configPath(), JSON.stringify(c, null, 2));
    return c;
  }
  return { ...defaults(), ...JSON.parse(readFileSync(configPath(), "utf8")) };
}

export function saveConfig(c) {
  mkdirSync(dirname(configPath()), { recursive: true });
  writeFileSync(configPath(), JSON.stringify(c, null, 2));
}
```

- [ ] **Step 4: Run, expect pass; Commit**
```bash
git add server/config.js server/config.test.js
git commit -m "feat: config load/save with generated session secret"
```

### Task 2.2: auth (scrypt + HMAC session)

**Files:**
- Create: `server/auth.js`, `server/auth.test.js`

- [ ] **Step 1: Failing test** `server/auth.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-auth-"));
const { hashPassword, verifyPassword, signSession, verifySession } = await import("./auth.js");

test("password hash verifies; wrong password fails", () => {
  const rec = hashPassword("hunter2");
  assert.ok(verifyPassword("hunter2", rec));
  assert.equal(verifyPassword("nope", rec), false);
});

test("session cookie signs and verifies; tamper fails", () => {
  const c = signSession("ms");
  assert.equal(verifySession(c), "ms");
  assert.equal(verifySession(c + "x"), null);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/auth.js`**
```js
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { loadConfig } from "./config.js";

export function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const passhash = scryptSync(pw, salt, 64).toString("hex");
  return { salt, passhash };
}

export function verifyPassword(pw, rec) {
  const h = scryptSync(pw, rec.salt, 64);
  const stored = Buffer.from(rec.passhash, "hex");
  return h.length === stored.length && timingSafeEqual(h, stored);
}

function secret() { return loadConfig().session_secret; }

export function signSession(name) {
  const payload = Buffer.from(name).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(cookie) {
  if (!cookie || !cookie.includes(".")) return null;
  const [payload, sig] = cookie.split(".");
  const expect = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return Buffer.from(payload, "base64url").toString();
}

// Fastify preHandler: rejects unauthenticated /api calls, sets req.user.
export function requireAuth(req, reply, done) {
  const cookie = req.cookies?.gs_session;
  const name = verifySession(cookie);
  if (!name) { reply.code(401).send({ error: "unauthorized" }); return; }
  req.user = { name, email: `${name}@local` };
  done();
}
```

- [ ] **Step 4: Run, expect pass; Commit**
```bash
git add server/auth.js server/auth.test.js
git commit -m "feat: scrypt password hashing + HMAC session + requireAuth hook"
```

---

## Phase 3 — API routes

> Add cookie support: `npm install @fastify/cookie @fastify/multipart` and register in `server/index.js` (see Task 3.1). Update `package.json` dependencies accordingly and commit the lockfile.

### Task 3.1: wire plugins + register routes in server/index.js

**Files:**
- Modify: `server/index.js`
- Create: `server/routes/index.js` (registers all route modules)

- [ ] **Step 1:** `npm install @fastify/cookie @fastify/multipart`

- [ ] **Step 2: Modify `server/index.js`** — register cookie + multipart + routes before the static fallback. Insert after `const app = Fastify(...)`:
```js
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import { registerRoutes } from "./routes/index.js";
// ...
await app.register(cookie);
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
await registerRoutes(app);
```
> Note: make `buildServer` `async` and `await` registrations; update the boot block to `await buildServer()`.

- [ ] **Step 3: Create `server/routes/index.js`**
```js
import authRoutes from "./auth.routes.js";
import projectRoutes from "./projects.routes.js";
import nodeRoutes from "./nodes.routes.js";
import assetRoutes from "./assets.routes.js";
import canvasRoutes from "./canvas.routes.js";
import aiRoutes from "./ai.routes.js";

export async function registerRoutes(app) {
  await app.register(authRoutes);
  await app.register(projectRoutes);
  await app.register(nodeRoutes);
  await app.register(assetRoutes);
  await app.register(canvasRoutes);
  await app.register(aiRoutes);
}
```

- [ ] **Step 4: Commit**
```bash
git add server/index.js server/routes/index.js package.json package-lock.json
git commit -m "chore: register cookie, multipart and route modules"
```

### Task 3.2: auth routes (setup, login, logout, me)

**Files:**
- Create: `server/routes/auth.routes.js`, `server/routes/auth.routes.test.js`

- [ ] **Step 1: Failing integration test** `server/routes/auth.routes.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-authroutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

test("first-run setup creates user; login sets cookie; me returns name", async () => {
  const app = await buildServer();
  let res = await app.inject({ method: "POST", url: "/api/auth/setup",
    payload: { name: "ms", password: "pw" } });
  assert.equal(res.statusCode, 200);
  res = await app.inject({ method: "POST", url: "/api/auth/login",
    payload: { name: "ms", password: "pw" } });
  assert.equal(res.statusCode, 200);
  const cookie = res.cookies.find((c) => c.name === "gs_session").value;
  const me = await app.inject({ method: "GET", url: "/api/auth/me",
    cookies: { gs_session: cookie } });
  assert.equal(me.json().name, "ms");
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/routes/auth.routes.js`**
```js
import { loadConfig, saveConfig } from "../config.js";
import { hashPassword, verifyPassword, signSession, requireAuth } from "../auth.js";

export default async function authRoutes(app) {
  app.get("/api/auth/needs-setup", async () => ({ needsSetup: loadConfig().users.length === 0 }));

  app.post("/api/auth/setup", async (req, reply) => {
    const cfg = loadConfig();
    if (cfg.users.length > 0) return reply.code(409).send({ error: "already set up" });
    const { name, password } = req.body || {};
    if (!name || !password) return reply.code(400).send({ error: "name+password required" });
    cfg.users.push({ name, ...hashPassword(password) });
    saveConfig(cfg);
    return { ok: true };
  });

  app.post("/api/auth/login", async (req, reply) => {
    const { name, password } = req.body || {};
    const user = loadConfig().users.find((u) => u.name === name);
    if (!user || !verifyPassword(password, user))
      return reply.code(401).send({ error: "bad credentials" });
    reply.setCookie("gs_session", signSession(name), {
      httpOnly: true, sameSite: "lax", path: "/",
    });
    return { ok: true, name };
  });

  app.post("/api/auth/logout", async (req, reply) => {
    reply.clearCookie("gs_session", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", { preHandler: requireAuth }, async (req) => ({ name: req.user.name }));
}
```

- [ ] **Step 4: Run, expect pass; Commit**
```bash
git add server/routes/auth.routes.js server/routes/auth.routes.test.js
git commit -m "feat: auth routes (setup/login/logout/me) with integration test"
```

### Task 3.3: project + node routes

**Files:**
- Create: `server/routes/projects.routes.js`, `server/routes/nodes.routes.js`, `server/routes/nodes.routes.test.js`

- [ ] **Step 1: Failing test** `server/routes/nodes.routes.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-noderoutes-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return r.cookies.find((c) => c.name === "gs_session").value;
}

test("create project + node, list back via project GET", async () => {
  const app = await buildServer();
  const cookie = await authed(app);
  const cj = { gs_session: cookie };
  const proj = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "G" } })).json();
  const node = (await app.inject({ method: "POST", url: `/api/projects/${proj.slug}/nodes`, cookies: cj,
    payload: { pillar: "gameloop", title: "Loop" } })).json();
  assert.equal(node.pillar, "gameloop");
  const full = (await app.inject({ method: "GET", url: `/api/projects/${proj.slug}`, cookies: cj })).json();
  assert.equal(full.nodes.length, 1);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/routes/projects.routes.js`**
```js
import { requireAuth } from "../auth.js";
import { createProject, listProjects, getProject } from "../storage/projects.js";

export default async function projectRoutes(app) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/projects")) return requireAuth(req, reply, () => {});
  });
  app.get("/api/projects", async () => listProjects());
  app.post("/api/projects", async (req, reply) => {
    const { title } = req.body || {};
    if (!title) return reply.code(400).send({ error: "title required" });
    return createProject({ title }, req.user);
  });
  app.get("/api/projects/:slug", async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return p;
  });
}
```
> **Auth note:** the `addHook` above duplicates intent; simpler is to attach `{ preHandler: requireAuth }` per-route. Use per-route `preHandler: requireAuth` on every route in projects/nodes/assets/canvas/ai modules (drop the addHook). This keeps `req.user` populated and 401s unauthenticated calls.

- [ ] **Step 4: Implement `server/routes/nodes.routes.js`** (per-route `requireAuth`)
```js
import { requireAuth } from "../auth.js";
import { createNode, updateNode, moveNode, deleteNode, getNode, nodeHistory, restoreNode } from "../storage/nodes.js";

const guard = { preHandler: requireAuth };

export default async function nodeRoutes(app) {
  app.post("/api/projects/:slug/nodes", guard, async (req) =>
    createNode(req.params.slug, req.body || {}, req.user));

  app.patch("/api/projects/:slug/nodes/:id", guard, async (req, reply) => {
    const { id, slug } = req.params;
    if (req.body.parent !== undefined || req.body.order !== undefined)
      await moveNode(slug, id, { parent: req.body.parent, order: req.body.order }, req.user);
    const { parent, order, ...rest } = req.body || {};
    const n = Object.keys(rest).length ? await updateNode(slug, id, rest, req.user) : await getNode(slug, id);
    if (!n) return reply.code(404).send({ error: "not found" });
    return n;
  });

  app.delete("/api/projects/:slug/nodes/:id", guard, async (req) => {
    await deleteNode(req.params.slug, req.params.id, req.user);
    return { ok: true };
  });

  app.get("/api/projects/:slug/nodes/:id/history", guard, async (req) =>
    nodeHistory(req.params.slug, req.params.id));

  app.post("/api/projects/:slug/nodes/:id/restore", guard, async (req) =>
    restoreNode(req.params.slug, req.params.id, req.body.commit, req.user));
}
```
> Also remove the `addHook` from projects.routes.js and add `{ preHandler: requireAuth }` to each of its routes (consistency).

- [ ] **Step 5: Run, expect pass; Commit**
```bash
git add server/routes/projects.routes.js server/routes/nodes.routes.js server/routes/nodes.routes.test.js
git commit -m "feat: project + node REST routes with auth guard and tests"
```

### Task 3.4: asset + canvas routes

**Files:**
- Create: `server/routes/assets.routes.js`, `server/routes/canvas.routes.js`

- [ ] **Step 1: Implement `server/routes/assets.routes.js`**
```js
import { requireAuth } from "../auth.js";
import { saveAsset } from "../storage/assets.js";
import { updateNode, getNode } from "../storage/nodes.js";

export default async function assetRoutes(app) {
  app.post("/api/projects/:slug/nodes/:id/attachments",
    { preHandler: requireAuth }, async (req, reply) => {
      const { slug, id } = req.params;
      const file = await req.file();
      if (!file) return reply.code(400).send({ error: "no file" });
      const buffer = await file.toBuffer();
      const rel = await saveAsset(slug, id, { filename: file.filename, buffer }, req.user);
      const node = await getNode(slug, id);
      if (node) await updateNode(slug, id, { attachments: [...(node.attachments || []), rel] }, req.user);
      return { path: rel };
    });

  // Serve a stored asset (image preview)
  app.get("/api/projects/:slug/assets/:name", { preHandler: requireAuth }, async (req, reply) => {
    const { assetsDir } = await import("../storage/paths.js");
    const { join } = await import("node:path");
    return reply.sendFile
      ? reply.sendFile(req.params.name, assetsDir(req.params.slug))
      : reply.code(501).send({ error: "static not available" });
  });
}
```
> If `reply.sendFile` for arbitrary roots is awkward, instead read the file with `node:fs` and `reply.type(...).send(buffer)`. Keep within the project's `assets/` dir; reject `..` in `name`.

- [ ] **Step 2: Implement `server/routes/canvas.routes.js`**
```js
import { requireAuth } from "../auth.js";
import { readCanvas, writeCanvas } from "../storage/canvas.js";
import { updateNode, getNode } from "../storage/nodes.js";

const guard = { preHandler: requireAuth };
export default async function canvasRoutes(app) {
  app.get("/api/projects/:slug/canvases/:id", guard, async (req) =>
    readCanvas(req.params.slug, req.params.id));
  app.put("/api/projects/:slug/canvases/:id", guard, async (req) => {
    const { slug, id } = req.params;
    await writeCanvas(slug, id, req.body, req.user);
    const node = await getNode(slug, id);
    if (node && !node.canvas) await updateNode(slug, id, { canvas: `canvases/${id}.excalidraw` }, req.user);
    return { ok: true };
  });
}
```

- [ ] **Step 3: Manual check** — boot server, login via curl, POST a file, GET it back. (Covered end-to-end in Phase 7 UI.)

- [ ] **Step 4: Commit**
```bash
git add server/routes/assets.routes.js server/routes/canvas.routes.js
git commit -m "feat: attachment upload + canvas read/write routes"
```

---

## Phase 4 — AI (read-API + local assist)

### Task 4.1: extract + assist

**Files:**
- Create: `server/ai/assist.js`, `server/routes/ai.routes.js`, `server/routes/ai.routes.test.js`

- [ ] **Step 1: Failing test (export only; assist needs a live endpoint, covered manually)** `server/routes/ai.routes.test.js`
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.GS_DATA_DIR = mkdtempSync(join(tmpdir(), "gs-ai-"));
process.env.NODE_ENV = "test";
const { buildServer } = await import("../index.js");

async function authed(app) {
  await app.inject({ method: "POST", url: "/api/auth/setup", payload: { name: "ms", password: "pw" } });
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { name: "ms", password: "pw" } });
  return r.cookies.find((c) => c.name === "gs_session").value;
}

test("export.md returns flattened markdown", async () => {
  const app = await buildServer();
  const cookie = await authed(app);
  const cj = { gs_session: cookie };
  const p = (await app.inject({ method: "POST", url: "/api/projects", cookies: cj, payload: { title: "G" } })).json();
  await app.inject({ method: "POST", url: `/api/projects/${p.slug}/nodes`, cookies: cj,
    payload: { pillar: "gameloop", title: "Loop", body: "fun" } });
  const md = await app.inject({ method: "GET", url: `/api/projects/${p.slug}/export.md`, cookies: cj });
  assert.match(md.body, /## Gameloop/);
  assert.match(md.body, /Loop/);
});
```

- [ ] **Step 2: Run, expect fail.**

- [ ] **Step 3: Implement `server/ai/assist.js`**
```js
import { loadConfig } from "../config.js";
import { getProject } from "../storage/projects.js";
import { subtreeToMarkdown, flattenToMarkdown } from "../storage/tree.js";

const PROMPTS = {
  gaps: "Du bist Game-Design-Co-Pilot. Finde Lücken, Widersprüche und offene Fragen in folgendem Design-Ausschnitt. Antworte in knappen Stichpunkten auf Deutsch.",
  summarize: "Fasse den folgenden Design-Strang in 3-5 Sätzen klar zusammen (Deutsch).",
  alternative: "Schlage 2-3 konkrete alternative Design-Ansätze zum folgenden Ausschnitt vor (Deutsch, je 1-2 Sätze).",
};

export async function assist(slug, { scope, action }) {
  const cfg = loadConfig();
  if (!cfg.ai.baseUrl) throw new Error("Kein lokaler KI-Endpunkt konfiguriert (data/config.json -> ai.baseUrl).");
  const project = await getProject(slug);
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
```

- [ ] **Step 4: Implement `server/routes/ai.routes.js`**
```js
import { requireAuth } from "../auth.js";
import { getProject } from "../storage/projects.js";
import { flattenToMarkdown, subtreeToMarkdown, subtreeNodes, buildTree } from "../storage/tree.js";
import { assist } from "../ai/assist.js";

const guard = { preHandler: requireAuth };
export default async function aiRoutes(app) {
  app.get("/api/projects/:slug/export.json", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return { title: p.title, slug: p.slug, tree: buildTree(p.nodes) };
  });

  app.get("/api/projects/:slug/export.md", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    if (!p) return reply.code(404).send({ error: "not found" });
    return reply.type("text/markdown; charset=utf-8").send(flattenToMarkdown(p, p.nodes));
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.json", guard, async (req) => {
    const p = await getProject(req.params.slug);
    return { nodes: subtreeNodes(p.nodes, req.params.id) };
  });

  app.get("/api/projects/:slug/nodes/:id/subtree.md", guard, async (req, reply) => {
    const p = await getProject(req.params.slug);
    return reply.type("text/markdown; charset=utf-8").send(subtreeToMarkdown(p, p.nodes, req.params.id));
  });

  app.post("/api/projects/:slug/assist", guard, async (req, reply) => {
    try { return await assist(req.params.slug, req.body || {}); }
    catch (e) { return reply.code(400).send({ error: String(e.message || e) }); }
  });
}
```

- [ ] **Step 5: Run export test, expect pass; Commit**
```bash
git add server/ai/assist.js server/routes/ai.routes.js server/routes/ai.routes.test.js
git commit -m "feat: AI read-API (export/subtree) + local-endpoint assist"
```

- [ ] **Step 6: Full backend test sweep** — Run: `node --test`. Expected: all suites PASS.

---

## Phase 5 — Frontend shell, design tokens, auth gate

### Task 5.1: install frontend deps + design tokens

**Files:**
- Modify: `package.json`
- Create: `web/src/styles/tokens.css`, `web/src/styles/global.css`, `web/src/fonts/` (drop a local variable font, e.g. Inter)

- [ ] **Step 1: Install** — `npm install react react-dom @excalidraw/excalidraw @dnd-kit/core @dnd-kit/sortable marked dompurify motion`

- [ ] **Step 2: Add a local font** — place a variable font file at `web/src/fonts/Inter.woff2` (downloaded once, committed locally; NO Google Fonts link). 

- [ ] **Step 3: Write `web/src/styles/tokens.css`** (pillar colors, spacing, radius, motion vars)
```css
@font-face {
  font-family: "Inter";
  src: url("../fonts/Inter.woff2") format("woff2");
  font-weight: 100 900; font-display: swap;
}
:root {
  --bg: #0e0f13; --panel: #16181f; --panel-2: #1d2029;
  --text: #e8eaf0; --muted: #9aa0b0; --line: #2a2e3a;
  --accent: #7c8cff;
  --gameloop: #ff7a59; --artstyle: #ffd166; --content: #06d6a0;
  --threads: #8c7bff; --scope: #4cc9f0;
  --core: #06d6a0; --side: #ffd166; --future: #9aa0b0;
  --radius: 14px; --radius-sm: 9px;
  --space: 8px;
  --spring: 420; --damp: 32; /* spring presets consumed in motion.js */
  --shadow: 0 8px 30px rgba(0,0,0,.35);
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--bg); color: var(--text); font-family: "Inter", system-ui, sans-serif; }
```

- [ ] **Step 4: Write `web/src/styles/global.css`** (scrollbars, focus rings, buttons base) — minimal, smooth transitions:
```css
button { font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--line);
  background: var(--panel-2); border-radius: var(--radius-sm); padding: 8px 12px;
  transition: transform .12s ease, background .2s ease, border-color .2s ease; }
button:hover { background: #232732; }
button:active { transform: translateY(1px) scale(.99); }
input, textarea { font: inherit; color: inherit; background: var(--panel); border: 1px solid var(--line);
  border-radius: var(--radius-sm); padding: 8px 10px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 5: Commit**
```bash
git add package.json package-lock.json web/src/styles web/src/fonts
git commit -m "feat: frontend deps + design tokens + local font + global styles"
```

### Task 5.2: api client + motion presets

**Files:**
- Create: `web/src/api.js`, `web/src/motion.js`

- [ ] **Step 1: Write `web/src/api.js`**
```js
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
```

- [ ] **Step 2: Write `web/src/motion.js`** (spring presets for `motion`)
```js
export const spring = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 };
export const springSoft = { type: "spring", stiffness: 260, damping: 30 };
export const pop = {
  initial: { opacity: 0, scale: 0.96, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0, transition: spring },
  exit: { opacity: 0, scale: 0.98, y: -2, transition: { duration: 0.12 } },
};
```

- [ ] **Step 3: Commit**
```bash
git add web/src/api.js web/src/motion.js
git commit -m "feat: frontend api client + motion spring presets"
```

### Task 5.3: App shell + auth gate + Login page

**Files:**
- Modify: `web/src/main.jsx` (import styles)
- Rewrite: `web/src/App.jsx`
- Create: `web/src/pages/Login.jsx`

- [ ] **Step 1: Update `web/src/main.jsx`**
```jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/tokens.css";
import "./styles/global.css";
createRoot(document.getElementById("root")).render(<App />);
```

- [ ] **Step 2: Write `web/src/App.jsx`** — minimal state router: auth gate → Projects or Project view
```jsx
import { useEffect, useState } from "react";
import { api } from "./api.js";
import Login from "./pages/Login.jsx";
import Projects from "./pages/Projects.jsx";
import Project from "./pages/Project.jsx";

export default function App() {
  const [me, setMe] = useState(null);
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState({ name: "projects" }); // {name:'projects'} | {name:'project',slug}

  useEffect(() => { api.me().then(setMe).catch(() => setMe(null)).finally(() => setReady(true)); }, []);
  if (!ready) return <div style={{ padding: 24 }}>…</div>;
  if (!me) return <Login onAuthed={(name) => setMe({ name })} />;
  if (route.name === "project")
    return <Project slug={route.slug} me={me} onBack={() => setRoute({ name: "projects" })} />;
  return <Projects me={me} onOpen={(slug) => setRoute({ name: "project", slug })}
                   onLogout={async () => { await api.logout(); setMe(null); }} />;
}
```

- [ ] **Step 3: Write `web/src/pages/Login.jsx`** (handles first-run setup vs login, smooth fade)
```jsx
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { api } from "../api.js";
import { pop } from "../motion.js";

export default function Login({ onAuthed }) {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [name, setName] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { api.needsSetup().then((r) => setNeedsSetup(r.needsSetup)); }, []);
  async function submit(e) {
    e.preventDefault(); setErr("");
    try {
      if (needsSetup) await api.setup(name, pw);
      await api.login(name, pw); onAuthed(name);
    } catch (e2) { setErr(String(e2.message || e2)); }
  }
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
      <motion.form {...pop} onSubmit={submit}
        style={{ background: "var(--panel)", padding: 28, borderRadius: "var(--radius)",
                 boxShadow: "var(--shadow)", width: 320, display: "grid", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>GameSketch</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>{needsSetup ? "Ersten Account anlegen" : "Anmelden"}</p>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <input placeholder="Passwort" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <div style={{ color: "#ff6b6b", fontSize: 13 }}>{err}</div>}
        <button type="submit" style={{ background: "var(--accent)", borderColor: "transparent" }}>
          {needsSetup ? "Anlegen & Los" : "Rein"}
        </button>
      </motion.form>
    </div>
  );
}
```

- [ ] **Step 4: Manual verify** — Start both: `npm run dev:server` and `npm run dev:web`; open `http://127.0.0.1:5173`. Expected: first run shows "Ersten Account anlegen", create works, lands on Projects (next task). 

- [ ] **Step 5: Commit**
```bash
git add web/src/main.jsx web/src/App.jsx web/src/pages/Login.jsx
git commit -m "feat: app shell, auth gate, login/first-run page"
```

### Task 5.4: Projects page (picker grid + create)

**Files:**
- Create: `web/src/pages/Projects.jsx`

- [ ] **Step 1: Write `web/src/pages/Projects.jsx`** (inviting grid, animated cards, create input)
```jsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../api.js";
import { spring, pop } from "../motion.js";

export default function Projects({ me, onOpen, onLogout }) {
  const [list, setList] = useState([]); const [title, setTitle] = useState("");
  useEffect(() => { api.projects().then(setList); }, []);
  async function create(e) {
    e.preventDefault(); if (!title.trim()) return;
    const p = await api.createProject(title.trim()); setTitle(""); onOpen(p.slug);
  }
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 32 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Deine Projekte</h1>
        <div style={{ color: "var(--muted)" }}>{me.name} · <button onClick={onLogout}>Logout</button></div>
      </header>
      <form onSubmit={create} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input style={{ flex: 1 }} placeholder="Neues Projekt benennen…" value={title}
          onChange={(e) => setTitle(e.target.value)} />
        <button style={{ background: "var(--accent)", borderColor: "transparent" }}>+ Neu</button>
      </form>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
        <AnimatePresence>
          {list.map((p) => (
            <motion.button key={p.slug} layout {...pop} whileHover={{ y: -4, transition: spring }}
              onClick={() => onOpen(p.slug)}
              style={{ textAlign: "left", padding: 18, height: 120, borderRadius: "var(--radius)",
                       background: "var(--panel)", boxShadow: "var(--shadow)" }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{p.title}</div>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>{p.slug}</div>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verify** — create a project; card animates in; clicking opens Project view (next phase, placeholder ok).

- [ ] **Step 3: Commit**
```bash
git add web/src/pages/Projects.jsx
git commit -m "feat: animated projects picker with create"
```

---

## Phase 6 — Project view: tree + node editor

### Task 6.1: Project page layout + data load

**Files:**
- Create: `web/src/pages/Project.jsx`, `web/src/components/Toolbar.jsx`, `web/src/components/StatusBadge.jsx`

- [ ] **Step 1: Write `web/src/components/StatusBadge.jsx`**
```jsx
const COLORS = { core: "var(--core)", side: "var(--side)", future: "var(--future)" };
const LABELS = { core: "Core", side: "Side", future: "Future" };
export default function StatusBadge({ status, onClick }) {
  return (
    <span onClick={onClick} title="Status wechseln"
      style={{ cursor: onClick ? "pointer" : "default", fontSize: 11, fontWeight: 600,
        padding: "2px 8px", borderRadius: 999, color: "#0c0d11",
        background: COLORS[status] || "var(--muted)" }}>
      {LABELS[status] || status}
    </span>
  );
}
```

- [ ] **Step 2: Write `web/src/pages/Project.jsx`** — three-pane: tree (left), editor/canvas (center/right). Loads project, holds nodes in state, selection.
```jsx
import { useEffect, useState, useCallback } from "react";
import { api } from "../api.js";
import Tree from "../components/Tree.jsx";
import NodeEditor from "../components/NodeEditor.jsx";

export default function Project({ slug, me, onBack }) {
  const [project, setProject] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const reload = useCallback(async () => setProject(await api.project(slug)), [slug]);
  useEffect(() => { reload(); }, [reload]);
  if (!project) return <div style={{ padding: 24 }}>Lade…</div>;

  const selected = project.nodes.find((n) => n.id === selectedId) || null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,360px) 1fr", height: "100%" }}>
      <aside style={{ borderRight: "1px solid var(--line)", overflow: "auto", padding: 12 }}>
        <button onClick={onBack} style={{ marginBottom: 12 }}>← Projekte</button>
        <h2 style={{ marginTop: 0 }}>{project.title}</h2>
        <Tree project={project} selectedId={selectedId}
          onSelect={setSelectedId} onChanged={reload} />
      </aside>
      <main style={{ overflow: "auto" }}>
        {selected
          ? <NodeEditor key={selected.id} slug={slug} node={selected} onChanged={reload} />
          : <div style={{ padding: 40, color: "var(--muted)" }}>Wähle oder erstelle einen Knoten ✨</div>}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**
```bash
git add web/src/pages/Project.jsx web/src/components/StatusBadge.jsx
git commit -m "feat: project view layout with tree + editor panes"
```

### Task 6.2: Tree + TreeNode (pillars, expand/collapse, add, outliner keys, dnd)

**Files:**
- Create: `web/src/components/Tree.jsx`, `web/src/components/TreeNode.jsx`

- [ ] **Step 1: Write `web/src/components/Tree.jsx`** — builds nested structure client-side (mirror of server buildTree), renders 5 pillar sections with add buttons, hosts `@dnd-kit` context.
```jsx
import { useMemo } from "react";
import { DndContext, closestCenter } from "@dnd-kit/core";
import { api } from "../api.js";
import TreeNode from "./TreeNode.jsx";

const PILLARS = [
  ["gameloop", "Gameloop", "var(--gameloop)"],
  ["artstyle", "Grafikstil", "var(--artstyle)"],
  ["content", "Inhalt", "var(--content)"],
  ["threads", "Stränge", "var(--threads)"],
  ["scope", "Scope", "var(--scope)"],
];

function nest(nodes) {
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] }]));
  const roots = {};
  for (const n of byId.values()) {
    if (n.parent && byId.has(n.parent)) byId.get(n.parent).children.push(n);
    else (roots[n.pillar] ||= []).push(n);
  }
  for (const arr of Object.values(roots)) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return roots;
}

export default function Tree({ project, selectedId, onSelect, onChanged }) {
  const roots = useMemo(() => nest(project.nodes), [project.nodes]);
  async function addRoot(pillar) {
    const n = await api.createNode(project.slug, { pillar, title: "Neue Idee" });
    onSelect(n.id); onChanged();
  }
  async function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const target = project.nodes.find((n) => n.id === over.id);
    await api.updateNode(project.slug, active.id, { parent: target.parent, order: (target.order ?? 0) + 1 });
    onChanged();
  }
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {PILLARS.map(([slug, label, color]) => (
        <section key={slug} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <strong style={{ fontSize: 13, letterSpacing: .3 }}>{label}</strong>
            <button style={{ marginLeft: "auto", padding: "2px 8px" }} onClick={() => addRoot(slug)}>＋</button>
          </div>
          {(roots[slug] || []).map((n) => (
            <TreeNode key={n.id} node={n} depth={0} slug={project.slug}
              selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} />
          ))}
        </section>
      ))}
    </DndContext>
  );
}
```

- [ ] **Step 2: Write `web/src/components/TreeNode.jsx`** — row with expand chevron, status dot, add-child, drag handle; spring expand via `motion`; outliner keys (Enter=sibling, Tab=child).
```jsx
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSortable } from "@dnd-kit/sortable";
import { api } from "../api.js";
import { spring } from "../motion.js";

export default function TreeNode({ node, depth, slug, selectedId, onSelect, onChanged }) {
  const [open, setOpen] = useState(true);
  const { attributes, listeners, setNodeRef, transform } = useSortable({ id: node.id });
  const sel = node.id === selectedId;

  async function addChild() {
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.id, title: "Neue Idee" });
    onSelect(n.id); onChanged();
  }
  async function addSibling() {
    const n = await api.createNode(slug, { pillar: node.pillar, parent: node.parent, title: "Neue Idee" });
    onSelect(n.id); onChanged();
  }
  function onKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); addSibling(); }
    if (e.key === "Tab") { e.preventDefault(); addChild(); }
  }
  return (
    <div ref={setNodeRef} style={{ transform: transform ? `translateY(${transform.y}px)` : undefined }}>
      <div tabIndex={0} onKeyDown={onKeyDown} onClick={() => onSelect(node.id)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 6px",
          marginLeft: depth * 16, borderRadius: 8, cursor: "pointer",
          background: sel ? "var(--panel-2)" : "transparent" }}>
        {node.children.length > 0
          ? <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
              style={{ width: 14, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▸</span>
          : <span style={{ width: 14 }} />}
        <span {...attributes} {...listeners} style={{ cursor: "grab", color: "var(--muted)" }}>⠿</span>
        <span style={{ width: 7, height: 7, borderRadius: 999,
          background: `var(--${node.status})` }} />
        <span style={{ flex: 1, fontSize: 14, opacity: node.status === "future" ? .7 : 1 }}>{node.title}</span>
        <button style={{ padding: "0 6px" }} onClick={(e) => { e.stopPropagation(); addChild(); }}>＋</button>
      </div>
      <AnimatePresence initial={false}>
        {open && node.children.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1, transition: spring }}
            exit={{ height: 0, opacity: 0, transition: { duration: .12 } }} style={{ overflow: "hidden" }}>
            {node.children.map((c) => (
              <TreeNode key={c.id} node={c} depth={depth + 1} slug={slug}
                selectedId={selectedId} onSelect={onSelect} onChanged={onChanged} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```
> `@dnd-kit/sortable`'s `useSortable` needs a `SortableContext` for full reordering; for MVP the simple `DndContext` + per-node drag handle gives basic move. Full sortable polish is a later refinement (note in §14 of spec).

- [ ] **Step 3: Manual verify** — add roots/children, expand/collapse springs, outliner keys create nodes.

- [ ] **Step 4: Commit**
```bash
git add web/src/components/Tree.jsx web/src/components/TreeNode.jsx
git commit -m "feat: animated pillar tree with add/expand/outliner-keys/drag"
```

### Task 6.3: NodeEditor + MarkdownView + Attachments

**Files:**
- Create: `web/src/components/NodeEditor.jsx`, `web/src/components/MarkdownView.jsx`, `web/src/components/Attachments.jsx`

- [ ] **Step 1: Write `web/src/components/MarkdownView.jsx`**
```jsx
import { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
export default function MarkdownView({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || "")), [text]);
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 2: Write `web/src/components/Attachments.jsx`** (drop zone + chips)
```jsx
import { useState } from "react";
import { api } from "../api.js";
export default function Attachments({ slug, node, onChanged }) {
  const [over, setOver] = useState(false);
  async function onDrop(e) {
    e.preventDefault(); setOver(false);
    for (const file of e.dataTransfer.files) await api.uploadAttachment(slug, node.id, file);
    onChanged();
  }
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      style={{ border: `1.5px dashed ${over ? "var(--accent)" : "var(--line)"}`, borderRadius: 12,
        padding: 12, transition: "border-color .15s", marginTop: 12 }}>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 8 }}>Dateien hierher ziehen</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(node.attachments || []).map((a) => (
          <a key={a} href={`/api/projects/${slug}/${a}`} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, padding: "4px 8px", background: "var(--panel-2)", borderRadius: 8 }}>
            {a.split("/").pop()}
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `web/src/components/NodeEditor.jsx`** — title, status toggle, markdown editor with live preview toggle, kind selector, attachments, canvas toggle, history button. Debounced autosave (optimistic).
```jsx
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import StatusBadge from "./StatusBadge.jsx";
import MarkdownView from "./MarkdownView.jsx";
import Attachments from "./Attachments.jsx";
import CanvasPane from "./CanvasPane.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import AssistPanel from "./AssistPanel.jsx";

const STATUS_CYCLE = { core: "side", side: "future", future: "core" };

export default function NodeEditor({ slug, node, onChanged }) {
  const [title, setTitle] = useState(node.title);
  const [body, setBody] = useState(node.body || "");
  const [tab, setTab] = useState("edit"); // edit | preview | canvas | history | assist
  const saveTimer = useRef(null);

  useEffect(() => { setTitle(node.title); setBody(node.body || ""); }, [node.id]);

  function queueSave(patch) {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { api.updateNode(slug, node.id, patch).then(onChanged); }, 600);
  }
  async function cycleStatus() {
    await api.updateNode(slug, node.id, { status: STATUS_CYCLE[node.status] }); onChanged();
  }
  async function del() { if (confirm("Knoten löschen?")) { await api.deleteNode(slug, node.id); onChanged(); } }

  return (
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <StatusBadge status={node.status} onClick={cycleStatus} />
        <select defaultValue={node.kind}
          onChange={(e) => { api.updateNode(slug, node.id, { kind: e.target.value }).then(onChanged); }}>
          <option value="idea">Idee</option><option value="alternative">Alternative</option><option value="note">Notiz</option>
        </select>
        <button style={{ marginLeft: "auto" }} onClick={del}>🗑</button>
      </div>
      <input value={title} onChange={(e) => { setTitle(e.target.value); queueSave({ title: e.target.value }); }}
        style={{ width: "100%", fontSize: 24, fontWeight: 600, border: "none", background: "transparent", padding: 0 }} />

      <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
        {["edit", "preview", "canvas", "history", "assist"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? "var(--panel-2)" : "transparent" }}>{t}</button>
        ))}
      </div>

      {tab === "edit" && (
        <textarea value={body} onChange={(e) => { setBody(e.target.value); queueSave({ body: e.target.value }); }}
          style={{ width: "100%", minHeight: 360, resize: "vertical", lineHeight: 1.6 }} placeholder="Idee reinbuttern…" />
      )}
      {tab === "preview" && <MarkdownView text={body} />}
      {tab === "canvas" && <CanvasPane slug={slug} node={node} />}
      {tab === "history" && <HistoryPanel slug={slug} node={node} onChanged={onChanged} />}
      {tab === "assist" && <AssistPanel slug={slug} node={node} />}

      {tab === "edit" && <Attachments slug={slug} node={node} onChanged={onChanged} />}
    </div>
  );
}
```

- [ ] **Step 4: Manual verify** — edit title/body autosaves; status cycles; preview renders markdown; attachments drop works.

- [ ] **Step 5: Commit**
```bash
git add web/src/components/NodeEditor.jsx web/src/components/MarkdownView.jsx web/src/components/Attachments.jsx
git commit -m "feat: node editor with autosave, status cycle, markdown preview, attachments"
```

---

## Phase 7 — Canvas, History, Assist panels

### Task 7.1: CanvasPane (Excalidraw, autosave)

**Files:**
- Create: `web/src/components/CanvasPane.jsx`

- [ ] **Step 1: Write `web/src/components/CanvasPane.jsx`**
```jsx
import { useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { api } from "../api.js";

export default function CanvasPane({ slug, node }) {
  const [initial, setInitial] = useState(null);
  const saveTimer = useRef(null);
  useEffect(() => { api.canvas(slug, node.id).then((d) => setInitial(d || { elements: [], appState: {} })); }, [node.id]);
  if (!initial) return <div style={{ color: "var(--muted)" }}>Lade Canvas…</div>;
  return (
    <div style={{ height: "70vh", borderRadius: 12, overflow: "hidden", border: "1px solid var(--line)" }}>
      <Excalidraw initialData={initial}
        onChange={(elements, appState) => {
          clearTimeout(saveTimer.current);
          saveTimer.current = setTimeout(() => {
            api.saveCanvas(slug, node.id, { elements, appState: { viewBackgroundColor: appState.viewBackgroundColor } });
          }, 800);
        }} />
    </div>
  );
}
```
> Excalidraw runs fully offline (no telemetry). Pin styles import path to the installed version if it differs.

- [ ] **Step 2: Manual verify** — open canvas tab, doodle, switch nodes and back → drawing persists (committed to git).

- [ ] **Step 3: Commit**
```bash
git add web/src/components/CanvasPane.jsx
git commit -m "feat: per-node excalidraw canvas with debounced autosave"
```

### Task 7.2: HistoryPanel (git log + restore)

**Files:**
- Create: `web/src/components/HistoryPanel.jsx`

- [ ] **Step 1: Write `web/src/components/HistoryPanel.jsx`**
```jsx
import { useEffect, useState } from "react";
import { api } from "../api.js";
export default function HistoryPanel({ slug, node, onChanged }) {
  const [hist, setHist] = useState([]);
  useEffect(() => { api.history(slug, node.id).then(setHist); }, [node.id]);
  async function restore(commit) {
    if (!confirm("Diesen Stand wiederherstellen?")) return;
    await api.restore(slug, node.id, commit); onChanged();
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {hist.map((h) => (
        <div key={h.commit} style={{ display: "flex", alignItems: "center", gap: 10,
          padding: 10, background: "var(--panel)", borderRadius: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13 }}>{h.message}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>{h.author} · {new Date(h.date).toLocaleString()}</div>
          </div>
          <button onClick={() => restore(h.commit)}>↺ Restore</button>
        </div>
      ))}
      {hist.length === 0 && <div style={{ color: "var(--muted)" }}>Noch keine Historie.</div>}
    </div>
  );
}
```

- [ ] **Step 2: Manual verify** — edit node a few times, history lists commits with author, restore brings old content back.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/HistoryPanel.jsx
git commit -m "feat: per-node history panel with one-click restore"
```

### Task 7.3: AssistPanel (local LLM)

**Files:**
- Create: `web/src/components/AssistPanel.jsx`

- [ ] **Step 1: Write `web/src/components/AssistPanel.jsx`**
```jsx
import { useState } from "react";
import { api } from "../api.js";
const ACTIONS = [["gaps", "Lücken finden"], ["summarize", "Strang zusammenfassen"], ["alternative", "Alternative vorschlagen"]];
export default function AssistPanel({ slug, node }) {
  const [out, setOut] = useState(""); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function run(action) {
    setBusy(true); setErr(""); setOut("");
    try { const r = await api.assist(slug, { nodeId: node.id }, action); setOut(r.text); }
    catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {ACTIONS.map(([a, label]) => <button key={a} disabled={busy} onClick={() => run(a)}>{label}</button>)}
      </div>
      {busy && <div style={{ color: "var(--muted)" }}>Denke nach… (lokaler Endpunkt)</div>}
      {err && <div style={{ color: "#ff6b6b", fontSize: 13 }}>{err} — KI-Endpunkt in <code>data/config.json</code> setzen.</div>}
      {out && <pre style={{ whiteSpace: "pre-wrap", background: "var(--panel)", padding: 14, borderRadius: 10 }}>{out}</pre>}
    </div>
  );
}
```

- [ ] **Step 2: Manual verify** — set `data/config.json` `ai.baseUrl` to a running local OpenAI-compatible server (e.g. `http://127.0.0.1:1234/v1`), click "Lücken finden", see a response. With no endpoint set, shows the friendly error.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/AssistPanel.jsx
git commit -m "feat: assist panel calling local LLM endpoint"
```

---

## Phase 8 — Production build, polish, verification

### Task 8.1: production build + single-process serve

**Files:**
- Modify: `server/index.js` (already serves `web/dist` if present)

- [ ] **Step 1: Build** — Run: `npm run build`. Expected: `web/dist/` created.
- [ ] **Step 2: Start prod** — Run: `npm start`. Open `http://127.0.0.1:4321`. Expected: full app served from one process (no Vite).
- [ ] **Step 3: Commit** (no code change expected; if any path fix needed, include it)
```bash
git commit -am "chore: verify production single-process serve" --allow-empty
```

### Task 8.2: README + run docs

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`** documenting: requirements (Node 20+, git), `npm install`, dev (`npm run dev:server` + `npm run dev:web`), prod (`npm run build` + `npm start`), where data lives (`data/`), how to configure the local AI endpoint (`data/config.json` → `ai.baseUrl/model`), and the "no phone-home" guarantee. Include the AI read-API URLs for external agents.

- [ ] **Step 2: Commit**
```bash
git add README.md
git commit -m "docs: README with run, data, AI-endpoint and read-API instructions"
```

### Task 8.3: Smoothness / verification checklist (manual)

- [ ] Tree expand/collapse uses springs, no jank on a 50-node tree.
- [ ] Adding a node "pops" in; selection is instant (optimistic), save lands in background.
- [ ] Outliner keys: Enter = sibling, Tab = child.
- [ ] Drag a node to reparent; order persists after reload.
- [ ] Drag&drop an image onto a node → chip appears, link opens the file.
- [ ] Canvas doodle persists across node switches and reload.
- [ ] Status cycle core→side→future recolors the dot and dims future nodes.
- [ ] History lists commits with author; restore works.
- [ ] `GET /api/projects/<slug>/export.md` (with session cookie) returns the full GDD; an external agent can consume it.
- [ ] Assist returns text from the local endpoint; clear error when unset.
- [ ] App loads with NO network requests to any external domain (check devtools Network: only same-origin). Fonts are local.
- [ ] `npm start` serves everything from one process.

- [ ] **Final commit**
```bash
git commit -am "chore: MVP verification pass" --allow-empty
```

---

## Self-Review (done during authoring)

**Spec coverage:** 5 pillars (Task 1.5 PILLARS, Tree), Markdown+Git nodes (1.6), each project a git repo (1.7), drag&drop attachments (3.4/6.3), Excalidraw canvas (7.1), author-per-change + history + restore (1.4/1.6/7.2), user:password auth no roles (2.2/3.2), AI read-API export.json/.md + subtree (4.1), local-endpoint assist (4.1/7.3), no phone-home (vite local, local font, configurable AI — 5.1/8.3), one-process `npm start` (0.2/8.1), 2026-smooth motion (motion presets 5.2, springs in Tree/Projects/Login). All covered.

**Placeholder scan:** No TBD/TODO left as work; §14-style refinements (full @dnd-kit SortableContext polish, motion-lib final choice) are explicitly deferred and noted, not silent gaps.

**Type consistency:** Node shape and `PILLARS` defined once (Task 1.5), reused by storage, tree, routes, and client `nest()`. `requireAuth`, `signSession`, `api.*` names consistent across server and `web/src/api.js`. Author object `{name,email}` consistent through storage writes.

**Open refinements (carry to execution, not blockers):**
- Full `@dnd-kit` `SortableContext` for smooth in-list reordering (MVP ships basic move).
- Confirm `@excalidraw/excalidraw` CSS import path for the installed version.
- Asset GET route: use `node:fs` read + `reply.type().send(buffer)` with `..` rejection if `sendFile` rooting is awkward.
