<div align="center">

# GameSketch

**Put your game ideas on paper as a living tree — local-first, AI-readable, no phone-home.**

![GameSketch — the project view](docs/hero.png)

![license](https://img.shields.io/badge/license-MIT-7c8cff)
&nbsp;![node](https://img.shields.io/badge/node-%E2%89%A5%2020-2ee6a8)
&nbsp;![local-first](https://img.shields.io/badge/local--first-no%20tracking-ff6b9d)

</div>

## What it is

GameSketch is a small local web app for turning a game idea into a structured, living **Game Design Document** — instead of one sprawling text file. Every idea is a node in a tree, organised along 5 pillars. Nodes are plain **Markdown files versioned with Git**, so nothing is ever lost, you can see who changed what, and an AI can read the whole design straight off disk or through a small read-API.

It runs as **one Node process on your own machine**. No CDNs, no telemetry, no accounts in the cloud.

## The 5 pillars

Every project starts with these (you can rename / recolour / add / remove them per project):

1. **Gameloop** — how it's fun; the core loop
2. **Art style** — the look, with references
3. **Content** — where the journey goes; tagged `core` / `side` / `future`
4. **Threads** — detailed strands: story, crafting, causality (nest as deep as you like)
5. **Scope** — how far it all goes; asset budget

## Highlights

- 🌳 **5-pillar idea tree** — add / nest / reorder, status `core·side·future`, alternatives & notes, outliner keys (Enter = sibling, Tab = child)
- ✍️ **Markdown editor** with live preview and autosave
- 🎨 **Doodle canvas** per node (Excalidraw, fully offline)
- 📎 **Drag & drop attachments** — sketches, refs, anything
- 🕓 **Git history + one-click restore**, with an author on every change
- 🤖 **AI** — a read-API for external agents *and* an in-app copilot, pointed at a local endpoint, OpenRouter, or the local `claude` CLI
- 🌍 **English / Deutsch / Русский**
- 🔒 **No phone-home** — local fonts, no CDNs, no telemetry

## Requirements

- **Node.js ≥ 20** (tested on 24)
- **git** on your `PATH` (each project is its own git repo → history, author, restore)

## Quick start

**Production (single process, recommended):**

```bash
npm install
npm run build      # builds the frontend into web/dist
npm start          # serves UI + API on http://127.0.0.1:4321
```

Other port: `PORT=8080 npm start`.

**Development (hot reload, two processes):**

```bash
npm run dev:server   # API on :4321
npm run dev:web      # Vite UI on :5173 (proxies /api -> :4321)
```

On first launch you pick a **language** and create an account (`user:password` — no roles, it just stamps an author on every change, so the app is team-ready without extra complexity). Everything is later adjustable via the **gear (bottom-left)**: language, password, AI provider, agents, and a How-To.

## Where your data lives

Everything sits under **`data/`** (git-ignored by the app repo):

```
data/
  config.json              # users + AI provider settings
  projects/<slug>/         # each project is its own git repo
    project.md             # project meta + categories
    nodes/<category>/*.md  # each node = Markdown + frontmatter
    canvases/*.excalidraw  # doodles (JSON)
    assets/                # uploaded files
```

**Backup = copy `data/`.** Restoring an earlier version of a node is built into the UI (node → **History** tab → Restore).

## AI

Open the **gear → AI** and pick a provider (no `config.json` editing needed):

- **Local endpoint** — any OpenAI-compatible server (LM Studio, Ollama, …). Stays fully offline.
- **OpenRouter / API key** — `baseUrl` + `apiKey` + `model`; a **Load models** button pulls the list.
- **Claude CLI** — calls your local `claude` binary, no API key.

Then the node **Assist** tab offers *Find gaps*, *Summarise*, *Suggest alternative* — each sends the relevant subtree to the provider **you** chose. There's also a project-wide **copilot** (the ✦ button).

## AI read-API (for external agents)

An external agent (e.g. the Claude Code CLI) can pull a whole design out and reason over it. Agents **pair** with the app to get a token (gear → **Agents** → Accept), then call the read endpoints:

```
GET /api/projects/:slug/export.json            # full nested tree
GET /api/projects/:slug/export.md              # whole GDD flattened to Markdown
GET /api/projects/:slug/nodes/:id/subtree.json # any subtree
GET /api/projects/:slug/nodes/:id/subtree.md
```

Full guide (pairing, tokens, read-only vs. read+write, a `claude` example): **[HOWTO.md](HOWTO.md)**.

## "Phones home to nowhere"

No CDNs, no Google Fonts (fonts are bundled locally via fontsource), no telemetry, no auto-update pings. Excalidraw runs fully offline. The app itself talks to no one.

**The one exception is AI:** the *assist* / *copilot* feature talks to the provider **you** select in the gear. A purely local endpoint (LM Studio / Ollama) stays offline; choosing a cloud provider (OpenRouter) or `claude -p` sends that design excerpt to that provider. You decide, per provider. The server only binds `127.0.0.1` — reachable from your machine only.

## Tests

```bash
npm test     # backend suite: storage, auth, API, AI export
```

## Tech

Node + Fastify 5 · Markdown (gray-matter) + Git · React + Vite · Excalidraw · @dnd-kit · motion · fontsource (Bricolage Grotesque / Hanken Grotesk / JetBrains Mono). No Docker. One process. All local.

## License

[MIT](LICENSE) © 2026 ms
