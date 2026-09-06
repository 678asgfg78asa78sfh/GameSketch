# HOWTO — drive GameSketch from an external agent

GameSketch exposes a small **read API** so an external agent (e.g. the **Claude Code CLI**,
a script, or any LLM tool) can pull a whole game design out of a project and reason over it.

Everything is local. The API lives on the same server that serves the UI
(`http://127.0.0.1:4321` by default).

## 1. Authentication — pairing (recommended)

Instead of copying a session cookie, an agent **pairs** with GameSketch and gets a token:

1. The agent requests pairing:
   ```bash
   curl -s -X POST http://127.0.0.1:4321/api/pair/request \
     -H "Content-Type: application/json" -d '{"label":"claude"}'
   # -> { "id": "…", "token": "…" }   (token is PENDING, not usable yet)
   ```
2. In the app (gear → **Agents** tab) the request shows up. The user clicks **Accept** and
   picks a lifetime: **timed** (N hours), **forever**, or **until restart** (in-memory only,
   cleared when the server restarts).
3. The agent can poll until approved:
   ```bash
   curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:4321/api/pair/poll
   # -> { "status": "pending" | "active" | "denied", "expiresAt": … }
   ```
4. Once `active`, send the token on every read request as a header:
   `-H "Authorization: Bearer <token>"` (or `-H "X-GS-Key: <token>"`).
   The token is **header-only** — it is never accepted in the query string, so it can't leak
   into server logs or browser history.

A logged-in browser **session cookie** also works on the read endpoints — handy for quick manual
`curl`s while you are signed in — but pairing is the clean path for agents.

## 2. Find your project slug

```bash
curl -s -H "Authorization: Bearer <token>" http://127.0.0.1:4321/api/projects
# (or, while logged in:  -b "gs_session=<cookie>")
# -> [{ "title": "My Game", "slug": "my-game" }, ...]
```

An approved pairing token works on every **read** endpoint (project list, project tree, and the
`export.*` / `subtree.*` exports below). Editing nodes additionally requires **Read + write**
approval; see section 6. Creating projects and uploading assets require a logged-in session.

## 3. Read endpoints

| Endpoint | Returns |
| --- | --- |
| `GET /api/projects/:slug/export.json` | Full design as a **nested tree** (JSON), grouped by the 5 pillars |
| `GET /api/projects/:slug/export.md` | The whole GDD **flattened to Markdown** (headings per pillar/node) |
| `GET /api/projects/:slug/nodes/:id/subtree.json` | Any **subtree** as JSON (a node + all its descendants) |
| `GET /api/projects/:slug/nodes/:id/subtree.md` | Any subtree as Markdown |

The 5 pillars (stable slugs): `gameloop`, `artstyle`, `content`, `threads`, `scope`.
Each node carries `id`, `title`, `pillar`, `status` (`core`/`side`/`future`), `kind`
(`idea`/`alternative`/`note`), `parent`, `order`, `body` (Markdown) and authoring metadata.

## 4. Worked example — hand the whole design to Claude Code

```bash
SLUG=my-game
COOKIE="gs_session=<value>"

# Pull the flattened GDD and pipe it into the Claude CLI as context:
curl -s -b "$COOKIE" \
  "http://127.0.0.1:4321/api/projects/$SLUG/export.md" \
| claude -p "Here is my game design document. Find gaps and contradictions, then propose a
minimal vertical slice that proves the core loop is fun."
```

Or fetch the structured tree and let the agent navigate it:

```bash
curl -s -b "$COOKIE" \
  "http://127.0.0.1:4321/api/projects/$SLUG/export.json" > gdd.json
```

## 5. In-app shortcut

Inside the app, the **gear in the bottom-left → How-To** tab shows these exact URLs filled in
with your current project's slug, each with a copy button.

## 6. Writing (WRITE-scoped agents)

When you approve an agent you choose **Read-only** or **Read + write**. A write-scoped token can
also edit the design via the same Bearer header:

```bash
# create a node
curl -s -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"pillar":"gameloop","title":"Core loop","body":"cast, catch, upgrade"}' \
  http://127.0.0.1:4321/api/projects/<slug>/nodes

# edit a node (PATCH) / re-parent / delete
curl -s -X PATCH  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"body":"revised"}' http://127.0.0.1:4321/api/projects/<slug>/nodes/<id>
curl -s -X DELETE -H "Authorization: Bearer <token>" \
  http://127.0.0.1:4321/api/projects/<slug>/nodes/<id>
```

A **read-only** token gets `403` on these write routes. Every change is committed to the project's
git repo (author = the agent's label), so nothing is lost and the UI's history/restore still works.

Optional tracking uses `POST /api/projects/:slug/nodes/:id/tracking` with an `operation`:
`enable`, `disable`, `add`, `edit`, `remove`, `complete` or `reopen`.
For `add`, provide `task: { id, title, kind: "task" | "milestone" }`; for `edit`, provide
`taskId` and `patch` containing `title`, `done` and/or `kind`; for `remove`, provide `taskId`.
Use a stable unique task ID when retrying an add. Individual operations update the latest
checklist under the project lock instead of replacing another tab's entire list.

`POST /api/projects/:slug/nodes/:id/continue` creates a child version from a completed idea.
The body accepts an optional `title` and `carryTasks` boolean (default `false`). A repeated
request returns the existing successor. The returned node has `continued_from` and `version`.
Both routes require a session or a WRITE-scoped token and return an undo `action` when changed.
Checklists also appear in project reads and document exports.

## Notes

- Read-only tokens can read; write tokens can read **and** edit nodes. Creating projects and
  uploading assets stays session-only (a logged-in user).
- The server only listens on `127.0.0.1`, so the API is reachable from your machine only
  (not the network) unless you change the host.
- The built-in **assist** feature (gear → AI) sends design excerpts to the AI provider you
  configure (local endpoint, OpenRouter, or the local `claude` CLI). Nothing else leaves your machine.
