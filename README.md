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
nur damit jede Änderung einen Autor hat → team-tauglich). Im Setup wählst du die
**Sprache** (Englisch / Deutsch / Russisch); später jederzeit umstellbar über das
**Zahnrad unten links** (dort auch: Passwort ändern, KI-Provider, How-To).

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

## KI-Anbindung

Im **Zahnrad unten links → KI** wählst du einen Provider (kein `config.json`-Gefummel nötig):

- **Claude CLI** (`claude -p`) — ruft das lokale `claude`-Binary auf, kein API-Key.
- **API-Key (OpenRouter & OpenAI-kompatibel)** — `baseUrl` + `apiKey` + `model`,
  Button **„Modelle laden"** zieht die Modellliste vom Provider.

Dann erscheinen im Knoten-Tab **„assist"** die Buttons *Lücken finden*, *Zusammenfassen*,
*Alternative*. Die schicken den jeweiligen Teilbaum an den von **dir** gewählten Provider —
die Antwort kommt in deiner UI-Sprache zurück.

> Die Einstellungen landen weiterhin in `data/config.json` (Block `ai`); der API-Key wird
> der UI nie zurückgegeben. Alte `{ baseUrl, model, apiKey }`-Configs werden automatisch migriert.

## KI-Lese-API (für externe Agents)

Damit ein externer Agent (z. B. Claude Code) das ganze Design runterbrechen kann
(Session-Cookie nötig — im Browser eingeloggt sein):

```
GET /api/projects/:slug/export.json            # voller, verschachtelter Baum
GET /api/projects/:slug/export.md              # ganzes GDD flach als Markdown
GET /api/projects/:slug/nodes/:id/subtree.json # beliebiger Teilbaum
GET /api/projects/:slug/nodes/:id/subtree.md
```

Vollständige Anleitung inkl. Cookie-Handling und einem `claude`-Beispiel: **[HOWTO.md](HOWTO.md)**
(im Zahnrad → How-To sind die URLs mit deinem Projekt-Slug vorausgefüllt, mit Kopier-Button).

## „Funkt nirgendwohin"-Garantie

Keine CDNs, keine Google Fonts (Fonts lokal gebündelt via fontsource), keine Telemetrie,
keine Auto-Update-Pings. Excalidraw läuft vollständig offline. Die App selbst funkt nirgendwohin.

**Ausnahme = KI:** Die *assist*-Funktion geht an den Provider, den **du** im Zahnrad wählst.
Wählst du einen Cloud-Provider (OpenRouter) oder `claude -p`, verlässt der jeweilige
Design-Ausschnitt deinen Rechner Richtung dieses Anbieters. Ein rein lokaler OpenAI-kompatibler
Endpunkt (z. B. LM Studio / Ollama) bleibt vollständig offline. Du entscheidest pro Provider.

## Tests

```bash
npm test     # Backend-Suite (storage, auth, API, AI-export)
```

## Tech

Node + Fastify 5 · Markdown (gray-matter) + Git · React + Vite · Excalidraw · @dnd-kit · motion.
Kein Docker. Ein Prozess. Alles lokal.
