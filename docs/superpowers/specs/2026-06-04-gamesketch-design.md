# GameSketch — Design Spec

**Date:** 2026-06-04
**Status:** Draft, form approved by the user (storage, canvas, AI integration confirmed)
**Working title:** GameSketch · **Location:** `K:\GameSketch`

---

## 1. What it is (one sentence)

A **locally running web tool** in which every game project is a **tree along 5 pillars** — nodes as Markdown files, versioned with Git, with a doodle canvas, file attachments, an author per change, and an AI read API to cleanly pull out the entire design.

## 2. Purpose & success criteria

The tool replaces the "text-editor pain" of capturing game-design ideas. Success means:

- Ideas can be **"dumped in" frictionlessly**, expanded, and given alternatives — faster than in a text editor.
- A human *and* an AI can **cleanly survey and extract** the project in order to derive a prototype (or more) from it.
- **Changes & suggestions are documented** and traceable: you can see *who did what*, and you can **restore** states.
- The thing **is fun** and feels **fluid** — otherwise it won't be used anymore after week 2 (the tool trap).

## 3. Hard constraints (non-negotiable)

1. **Local, transmits nowhere.** No CDNs, no Google Fonts, no telemetry, no auto-update pings, no analytics. Fonts/icons are bundled locally.
2. **AI calls only against a user-configured endpoint** (OpenAI-compatible, e.g. your own local LLM server). Never hard-wired to a cloud.
3. **Lean — no large/sprawling dependencies.** Built-in tools before libs. Every larger dependency needs a justification (see §11).
4. **No Docker.** Runs as a single Node process via `npm start` on the user's dev server.
5. **Restorable & reproducible.** The entire state lives as files under `data/` → backup = copy the folder.

## 4. The 5 pillars (fixed, opinionated structure)

Every project has exactly these 5 roots; below them, arbitrarily deep trees:

| Slug | Pillar | Content |
|---|---|---|
| `gameloop` | **Gameloop** | How does the game create "fun"? Linear vs. recurring elements, core loop. |
| `artstyle` | **Art style** | Style definition with references (other games, uploaded assets/images). |
| `content` | **Content** | Where does the journey go, which means/mechanics exist; marked as core/side/future. |
| `threads` | **Threads** | Detailed threads: storyline, crafting thread, causalities — deeply nested. |
| `scope` | **Scope** | How far does everything go? Asset volume, scope limits. |

## 5. Data model

**Each project = its own Git repo** under `data/projects/<slug>/`:

```
data/projects/<slug>/
  project.md                 # Project meta (title, pillar config, description)
  nodes/<pillar>/<id>.md     # each node = Markdown + frontmatter
  canvases/<id>.excalidraw   # doodles as JSON (text, diffable)
  assets/<hash>-<filename>   # drag&drop attachments (images etc.)
  .git/                      # history = WHO/when + restore
```

**Node format** (Markdown with frontmatter):

```markdown
---
id: 01J7XYZ...            # stable ID (ULID, generated on creation)
title: Core Combat Loop
pillar: gameloop          # gameloop | artstyle | content | threads | scope
status: core              # core | side | future
kind: idea                # idea | alternative | note
parent: 01J6ABC...        # null = directly under the pillar
order: 3                  # sort index under the parent
alternatives_to: null     # for kind=alternative: ID of the node this is an alt. to
attachments: [assets/ab12-sketch.png]
canvas: canvases/01J7XYZ.excalidraw   # optional
created_by: ms
created_at: 2026-06-04T10:00:00Z
updated_by: ms
updated_at: 2026-06-04T10:00:00Z
---

Free-text Markdown body of the idea. Arbitrarily long, lists, links.
Cross-references to other nodes via [[01J6ABC...]].
```

- **Tree** is reconstructed from `parent` + `order`.
- **Reordering / moving** = change `parent`/`order` in the frontmatter → Git commit.
- **Status core/side/future** is the "journey" dimension (what is core, what is extra, what is future).
- **Alternatives** = nodes with `kind: alternative` + `alternatives_to`; **notes/suggestions** = `kind: note`.
- **Backlinks** via `[[id]]` in the body.

**History & authorship = Git:** Every save creates a commit in the project repo, `--author` = the logged-in user. With that:
- *Who did what when* = `git log` / `git blame`.
- *Restore* = restore an earlier state of a node (the UI internally does `git show <commit>:<path>` and writes it back).
- *Suggestions documented* = commit history + `kind: note`/`alternative` nodes.

## 6. Architecture

**A single Node process (Fastify)** serves both the statically built frontend app and the `/api` routes. `npm start`, no Docker.

```
gamesketch/ (app source code, its own Git repo)
  package.json  vite.config.js
  server/
    index.js          # boots Fastify, serves /api + the built frontend
    auth.js           # user:password, session cookie
    storage/
      project.js      # create/list projects
      nodes.js        # read/write/move/delete nodes (Markdown+frontmatter)
      git.js          # commit(author), log, restore  (via node:child_process)
      assets.js       # file uploads into assets/
    ai/
      extract.js      # project/subtree -> JSON + flat Markdown
      assist.js       # proxy to the configured local OpenAI-compatible endpoint
    routes.js
  web/                # React + Vite frontend
    src/...
  data/               # runtime data (not in the app repo)
    config.json       # users, AI endpoint config
    projects/<slug>/  # one Git repo each (see §5)
```

- **Git** is invoked via `node:child_process` — no extra dependency.
- **Frontmatter** parsing/writing with `gray-matter` (small).

## 7. Auth (minimal, only for authorship)

- Users in `data/config.json`: `[{ name, passhash }]`. Hash via `node:crypto` **scrypt** (no auth lib).
- Login form → session **cookie** (httpOnly), signed via HMAC (`node:crypto`).
- **No roles, no permissions.** The sole purpose: every commit gets an author → you can see who did what. This makes it automatically **team-capable** without building complexity now.
- **First-run:** If there is no user yet, a setup screen guides through creating the first user.

## 8. AI integration

**(a) Read API (read-only) — for pulling out into external agents:**
- `GET /api/projects/:slug/export.json` → complete, nested tree as JSON.
- `GET /api/projects/:slug/export.md` → the entire GDD flattened into a single Markdown document (headings by pillar/depth), LLM-friendly.
- `GET /api/projects/:slug/nodes/:id/subtree.json` and `.../subtree.md` → any subtree.
- An external agent (e.g. Claude Code) can fetch these endpoints and break the design down.

**(b) In-app assist (optional, never writes automatically):**
- Config in `data/config.json`: `{ ai: { baseUrl, model, apiKey? } }` → points to the user's **local** OpenAI-compatible endpoint (`/v1/chat/completions`).
- UI buttons: **"Find gaps"**, **"Summarize thread"**, **"Suggest alternative"**. The server builds a prompt from the relevant subtree (its flat Markdown), sends it to the configured endpoint, and shows the result.
- **The user decides** whether a suggestion is adopted as a node. Never auto-write, never cloud.

## 9. UX & motion — "2026 smoothness" (guideline, emphasized by the user)

Not rigid — **fluid, slick, intuitive, convincing**. Concrete and binding for the implementation:

- **Physics instead of linear:** Spring-based animations for expand/collapse, drag, node insertion — no hard `ease`. Prefer CSS transforms/`transition` and the **View Transitions API**; a **lightweight motion lib** (e.g. `motion`/Framer-Motion successor or `react-spring`) is allowed as a deliberate exception (same logic as Excalidraw), CSS-first where possible.
- **Optimistic UI, no full-page reloads:** Actions feel *instant*; saving happens in the background (commit), the UI does not wait.
- **Tactile interactions:** Node creation "pops" in, drag&drop with ghost preview + spring snap, buttons with tangible press feedback, subtle pillar color theming.
- **Frictionless capture:** Outliner keyboard (Enter = sibling, Tab = child, Shift+Tab = outdent) — ideas fly in without the mouse.
- **Calm, modern look:** local variable font, generous whitespace, subtle depth (shadows/blur), dark-mode capable. Implemented with the `frontend-design` skill during building.
- **Performance = feel:** 60fps interactions, no stutter when expanding large trees (virtualization only if needed).

## 10. API surface (overview)

```
POST   /api/auth/login            {name, password} -> sets session cookie
POST   /api/auth/setup            (first-run) create the first user
POST   /api/auth/logout

GET    /api/projects              list projects
POST   /api/projects              {title} -> create project (Git repo)
GET    /api/projects/:slug        project meta + full tree

POST   /api/projects/:slug/nodes              create node
PATCH  /api/projects/:slug/nodes/:id          edit/move/status node
DELETE /api/projects/:slug/nodes/:id          delete node
GET    /api/projects/:slug/nodes/:id/history  Git history of the node
POST   /api/projects/:slug/nodes/:id/restore  {commit} -> restore state

POST   /api/projects/:slug/nodes/:id/attachments   file upload (drag&drop)
GET    /api/projects/:slug/canvases/:id            read Excalidraw JSON
PUT    /api/projects/:slug/canvases/:id            save Excalidraw JSON

GET    /api/projects/:slug/export.json
GET    /api/projects/:slug/export.md
GET    /api/projects/:slug/nodes/:id/subtree.json
GET    /api/projects/:slug/nodes/:id/subtree.md
POST   /api/projects/:slug/assist             {scope, action} -> local LLM call
```

## 11. Dependencies (the lean promise)

**Backend:** `fastify`, `@fastify/static`, `gray-matter`. Git/hash/session = `node:child_process` + `node:crypto` (no libs).
**Frontend:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@excalidraw/excalidraw`. Plus mini-utils: Markdown render (`marked` + `dompurify`), tree drag (`@dnd-kit` or self-built), motion (see §9).

**Justified larger dependencies:** Excalidraw (canvas/doodles, chosen by the user; React-based → that's why the whole frontend is React, *one* framework instead of two) and the motion lib (for the required smoothness). Both run fully locally, without telemetry.

## 12. Scope

**MVP (build now):**
- Create/list projects (one Git repo each)
- 5-pillar tree: add/edit/move/delete, status core/side/future, alternatives & notes
- Markdown editor with live preview
- Drag&drop file attachments
- Excalidraw canvas per node
- Git history per node + restore
- Login (user:password), author per commit
- Read API (export.json/.md, subtree)
- AI assist against a local endpoint
- Fully local, no transmission, `npm start`
- "2026-smooth" UX per §9

**Deliberately phase 2 (NOT now — against the tool trap):**
- "AI builds/polishes the prototype" (its own, large follow-up product)
- Real-time team editing / merge UI
- Real permissions/roles
- Templates/marketplace
- Full-text search across all projects (later if needed)

## 13. Decision log

- **Storage:** Markdown + Git (instead of SQLite/hybrid) → AI-native, portable, no lock-in, Git provides history+author+restore for free. *(user confirmed)*
- **Canvas:** Excalidraw embedded (instead of tldraw/self-built) → mature, MIT, offline. *(user confirmed)*
- **AI:** Read API + local in-app assist (instead of just one of them). *(user confirmed)*
- **Frontend framework:** React + Vite (instead of Svelte) — because Excalidraw is React; one framework instead of Svelte+React island. *(confirmed during spec form)*

## 14. Open points (for the implementation plan)

- Exact choice of motion lib (CSS/View Transitions vs. `motion` vs. `react-spring`) — nail down in the plan.
- Tree DnD: `@dnd-kit` vs. self-built (trade-off leanness vs. UX).
- ULID generation: small self-implementation vs. a tiny lib.
