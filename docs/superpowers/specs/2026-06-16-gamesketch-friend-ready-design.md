# GameSketch "friend-ready" — Design / Spec

**Date:** 2026-06-16
**Goal:** Make GameSketch ready to hand to a friend (Windows, has Node): multilingual UI,
a bottom-left settings gear (password, language, AI provider, how-to), a repo HOWTO.md,
and a fix for the broken tree drag & drop.

## Scope

1. **i18n** — switchable UI in English / German / Russian.
2. **Initial-setup language picker** + small language switch on login.
3. **Settings gear** (bottom-left, only when authenticated): Language · Password · AI provider · How-To.
4. **AI provider layer** — `claude -p` (local CLI) and API-key providers (OpenRouter & any
   OpenAI-compatible) with **model pull**.
5. **HOWTO.md** in repo — read-API docs for external agents (Claude Code CLI etc.).
6. **Bugfix** — tree drag & drop: drop-onto = make child, cross-pillar move cascades, no cycles.

Non-goals: per-user server-side language storage (localStorage is enough), sibling-reorder via
DnD (drop-onto-node = child only), translating the long HOWTO.md (EN only; in-app how-to is translated).

---

## 1. i18n

- New `web/src/i18n/`:
  - `en.js`, `de.js`, `ru.js` — flat-ish nested dictionaries keyed by area (`login.*`, `projects.*`,
    `tree.*`, `editor.*`, `assist.*`, `settings.*`, `howto.*`, `common.*`).
  - `index.js` — `I18nProvider`, `useT()` → `{ t, lang, setLang }`. `t(key, vars?)` does dotted lookup
    with `{var}` interpolation; missing key falls back to the key string (dev-visible).
- Active language in `localStorage["gs_lang"]`; initial = stored ?? `navigator.language` prefix match
  (`de`/`ru`) ?? `en`.
- `App.jsx` wraps everything in `<I18nProvider>`.
- Replace hardcoded German in: `Login`, `App`, `Projects`, `Project`, `Tree`, `TreeNode`,
  `NodeEditor`, `AssistPanel`, `Attachments`, `CanvasPane`, `HistoryPanel`, `StatusBadge`.
- Pillar display names are part of the dictionaries (slugs stay stable: `gameloop`, `artstyle`,
  `content`, `threads`, `scope`).

## 2. Setup / login language picker

- `Login.jsx`: a compact EN/DE/RU segmented control. In setup mode it sits above the form; on
  return login a small switch in a corner. Selecting it calls `setLang` (persists immediately).

## 3. Settings gear

- `web/src/components/SettingsGear.jsx` — fixed `bottom-left` cog button, rendered by `App` when
  `me` is set. Receives current project `slug` (or null) for the How-To URLs.
- `web/src/components/SettingsPanel.jsx` — glass modal with sections:
  - **Language** — EN/DE/RU.
  - **Password** — current + new → `api.changePassword`.
  - **AI** — provider radio:
    - `claude-cli`: optional model (dropdown from a known Claude model list), optional binary path
      (default `claude`). No API key.
    - `openai` (OpenRouter & compatible): `baseUrl`, `apiKey`, `model` + **"Load models"** button
      → `api.pullModels` populates the dropdown.
    - Save → `api.saveSettings`.
  - **How-To** — translated short guide + concrete read-API URLs for the open project (copy buttons);
    generic `:slug` pattern when no project open. Links to repo `HOWTO.md`.

## 4. AI provider layer (server)

- Config shape (migrated from old `ai: {baseUrl, model, apiKey}`):
  ```json
  "ai": {
    "provider": "claude-cli" | "openai",
    "openai":   { "baseUrl": "https://openrouter.ai/api/v1", "apiKey": "", "model": "" },
    "claudeCli":{ "bin": "claude", "model": "" }
  }
  ```
  `loadConfig` migrates legacy keys: if old `baseUrl`/`model`/`apiKey` present → `provider:"openai"`,
  move into `openai`.
- `server/ai/providers.js`:
  - `chat({ provider, system, user, lang })` → `{ text }`.
    - `openai`: POST `{baseUrl}/chat/completions`, Bearer apiKey, model, non-streaming.
    - `claude-cli`: `spawn(bin, ["-p", ...(model?["--model",model]:[])])`, write `system\n\n{user}`
      to stdin, read stdout (text). No shell (injection-safe).
  - `listModels(cfg)`:
    - `openai`: GET `{baseUrl}/models`, Bearer → `data[].id` sorted.
    - `claude-cli`: static known IDs (`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`,
      `claude-fable-5`).
- `assist.js` uses `chat()` and passes UI `lang` so prompts localize the “answer in <language>”
  instruction (EN/DE/RU prompt variants).

## Settings & auth endpoints

- `POST /api/auth/password` (guarded): `{ current, next }` → verify current for `req.user.name`,
  re-hash, save. 400 on bad/short input, 401 on wrong current.
- `GET /api/settings` (guarded): returns `ai` with `openai.apiKey` **redacted** to `hasKey: boolean`
  (never leak the secret to the client).
- `PUT /api/settings` (guarded): accepts new `ai`; if `openai.apiKey` omitted/null → keep existing,
  empty string → clear.
- `POST /api/settings/ai/models` (guarded): body = candidate ai config (so "Load models" works before
  saving) → `{ models: string[] }`. Errors return 400 with message.
- Register `settings.routes.js` in `routes/index.js`.

## 5. HOWTO.md (repo, EN)

Read-API endpoints (`export.json`, `export.md`, `subtree.json`, `subtree.md`), the session-cookie
requirement, and a worked example driving them with `claude` / `curl` against a project slug.

## 6. Tree drag & drop fix

- **Frontend `Tree.jsx` `onDragEnd`**: dropping `active` onto `over` →
  `api.updateNode(slug, active.id, { parent: over.id, pillar: over.pillar })` (order appended).
  Guard: ignore when `over.id === active.id` **or** `over` is a descendant of `active`
  (descendant check from the flat node list) → no cycle, no vanishing node.
- **Backend `moveNode`**: defense-in-depth —
  - reject if new parent is the node itself or one of its descendants (throw → 400),
  - resolve new pillar from the new parent (root drop keeps current pillar),
  - **cascade pillar**: when pillar changes, move the node and all descendants’ files into the new
    pillar folder and update their `pillar` field.

## Privacy note

README currently claims "nothing is sent anywhere". OpenRouter and `claude -p` reach the cloud. Update
README + `AssistPanel` copy to: “AI calls go to the provider you choose (local endpoint, OpenRouter,
or Claude CLI); everything else stays local.”

---

## Implementation order

**Backend (with `node --test`):**
1. `moveNode` cycle guard + pillar cascade — extend `server/storage/nodes.test.js`.
2. `POST /api/auth/password` — extend `server/routes/auth.routes.test.js`.
3. `server/ai/providers.js` (`chat`, `listModels`) + config migration in `config.js`.
4. `assist.js` → use provider + `lang`.
5. `server/routes/settings.routes.js` (GET/PUT/models) + register; tests.

**Frontend (verify via `npm run build`):**
6. i18n infra (`web/src/i18n/*`) + wrap `App`.
7. `api.js`: `changePassword`, `getSettings`, `saveSettings`, `pullModels`; `assist` sends `lang`.
8. String extraction across components → `t(...)`.
9. `Login` language picker.
10. `SettingsGear` + `SettingsPanel` (Language/Password/AI/How-To).
11. `Tree.jsx` DnD fix.

**Docs:** 12. `HOWTO.md`. 13. README privacy update.

**Verify:** `npm test` green, `npm run build` clean, manual smoke of setup→language→gear→DnD.
