# GameSketch

Lokales Web-Tool, um Spielideen als **lebenden Baum** entlang von 5 Säulen aufs Papier zu bringen
— Knoten als Markdown, versioniert mit Git, mit Doodle-Canvas, Datei-Anhängen, Autor pro Änderung
und einer KI-Lese-API zum sauberen Rausziehen. **Läuft komplett lokal. Funkt nirgendwohin.**

## Die 5 Säulen

1. **Gameloop** – wie macht's Spaß, Core Loop
2. **Grafikstil** – Stil + Referenzen
3. **Inhalt** – wohin die Reise geht (core / side / future)
4. **Stränge** – Story, Crafting, Kausalitäten (tief verschachtelt)
5. **Scope** – wie weit alles geht, Asset-Umfang

## Voraussetzungen

- **Node.js ≥ 20** (getestet mit 24)
- **git** im PATH (jedes Projekt ist ein eigenes Git-Repo → Historie, Autor, Wiederherstellung)

## Installation

```bash
npm install
```

## Starten

**Produktion (ein Prozess, empfohlen):**
```bash
npm run build      # baut das Frontend nach web/dist
npm start          # serviert UI + API auf http://127.0.0.1:4321
```
Optional anderer Port: `PORT=8080 npm start`.

**Entwicklung (Hot Reload, zwei Prozesse):**
```bash
npm run dev:server   # API auf :4321
npm run dev:web      # Vite UI auf :5173 (proxyt /api -> :4321)
```

Beim ersten Aufruf legst du im Browser deinen Account an (user:password — keine Rollen,
nur damit jede Änderung einen Autor hat → team-tauglich).

## Wo liegen meine Daten?

Alles unter **`data/`** (gitignored vom App-Repo):

```
data/
  config.json              # Users + KI-Endpunkt
  projects/<slug>/         # je ein eigenes Git-Repo
    project.md             # Projekt-Meta
    nodes/<säule>/*.md     # jeder Knoten = Markdown + Frontmatter
    canvases/*.excalidraw  # Doodles (JSON)
    assets/                # hochgeladene Dateien
```

**Backup = `data/` kopieren.** Wiederherstellung eines Knoten-Stands geht im UI (Tab „history" → Restore).

## KI-Anbindung (lokal)

In **`data/config.json`** den Block `ai` auf deinen lokalen, OpenAI-kompatiblen Endpunkt setzen:

```json
"ai": { "baseUrl": "http://127.0.0.1:1234/v1", "model": "dein-modell", "apiKey": "" }
```

Dann erscheinen im Knoten-Tab **„assist"** die Buttons *Lücken finden*, *Zusammenfassen*,
*Alternative*. Die schicken den jeweiligen Teilbaum an **deinen** Endpunkt — nie in die Cloud.

## KI-Lese-API (für externe Agents)

Damit ein externer Agent (z. B. Claude Code) das ganze Design runterbrechen kann
(Session-Cookie nötig — im Browser eingeloggt sein):

```
GET /api/projects/:slug/export.json            # voller, verschachtelter Baum
GET /api/projects/:slug/export.md              # ganzes GDD flach als Markdown
GET /api/projects/:slug/nodes/:id/subtree.json # beliebiger Teilbaum
GET /api/projects/:slug/nodes/:id/subtree.md
```

## „Funkt nirgendwohin"-Garantie

Keine CDNs, keine Google Fonts (Fonts lokal gebündelt via fontsource), keine Telemetrie,
keine Auto-Update-Pings. KI-Aufrufe gehen ausschließlich an den Endpunkt, den **du** in
`config.json` einträgst. Excalidraw läuft vollständig offline.

## Tests

```bash
npm test     # Backend-Suite (storage, auth, API, AI-export)
```

## Tech

Node + Fastify 5 · Markdown (gray-matter) + Git · React + Vite · Excalidraw · @dnd-kit · motion.
Kein Docker. Ein Prozess. Alles lokal.
