# GameSketch — Design Spec

**Datum:** 2026-06-04
**Status:** Entwurf, vom Nutzer freigegebene Form (Storage, Canvas, KI-Anbindung bestätigt)
**Arbeitstitel:** GameSketch · **Ort:** `K:\GameSketch`

---

## 1. Was es ist (ein Satz)

Ein **lokal laufendes Web-Tool**, in dem jedes Spielprojekt ein **Baum entlang von 5 Säulen** ist — Knoten als Markdown-Dateien, versioniert mit Git, mit Doodle-Canvas, Datei-Anhängen, Autor pro Änderung und einer KI-Lese-API zum sauberen Rausziehen des ganzen Designs.

## 2. Zweck & Erfolgskriterien

Das Tool ersetzt den „Text-Editor-Schmerz" beim Festhalten von Game-Design-Ideen. Erfolg heißt:

- Ideen lassen sich **reibungsfrei „reinbuttern"**, ausweiten, mit Alternativen versehen — schneller als in einem Text-Editor.
- Ein Mensch *und* eine KI können das Projekt **sauber überschauen und extrahieren**, um daraus einen Prototyp (oder mehr) abzuleiten.
- **Änderungen & Vorschläge sind dokumentiert** und nachvollziehbar: man sieht *wer was* gemacht hat, und kann Stände **wiederherstellen**.
- Das Ding **macht Spaß** und fühlt sich **flüssig** an — sonst wird es nach Woche 2 nicht mehr benutzt (Tool-Falle).

## 3. Harte Constraints (nicht verhandelbar)

1. **Lokal, funkt nirgendwohin.** Keine CDNs, keine Google Fonts, keine Telemetrie, keine Auto-Update-Pings, keine Analytics. Fonts/Icons werden lokal gebündelt.
2. **KI-Aufrufe nur gegen einen vom Nutzer konfigurierten Endpunkt** (OpenAI-kompatibel, z.B. eigener lokaler LLM-Server). Niemals fest auf eine Cloud verdrahtet.
3. **Schlank — keine großen/sprawligen Dependencies.** Bordmittel vor Libs. Jede größere Dependency braucht eine Begründung (siehe §11).
4. **Kein Docker.** Läuft als ein Node-Prozess via `npm start` auf dem Dev-Server des Nutzers.
5. **Wiederherstellbar & reproduzierbar.** Der gesamte Zustand liegt als Dateien unter `data/` → Backup = Ordner kopieren.

## 4. Die 5 Säulen (fixe, opinionated Struktur)

Jedes Projekt hat genau diese 5 Wurzeln; darunter beliebig tiefe Bäume:

| Slug | Säule | Inhalt |
|---|---|---|
| `gameloop` | **Gameloop** | Wie macht das Spiel „Spaß"? Linear vs. wiederkehrende Elemente, Core Loop. |
| `artstyle` | **Grafikstil** | Stil-Definition mit Referenzen (andere Spiele, hochgeladene Assets/Bilder). |
| `content` | **Inhalt** | Wohin geht die Reise, welche Mittel/Mechaniken gibt es; markiert als core/side/future. |
| `threads` | **Stränge** | Detaillierte Stränge: Storyline, Crafting-Strang, Kausalitäten — tief verschachtelt. |
| `scope` | **Scope** | Wie weit geht alles? Asset-Umfang, Scope-Grenzen. |

## 5. Datenmodell

**Jedes Projekt = ein eigenes Git-Repo** unter `data/projects/<slug>/`:

```
data/projects/<slug>/
  project.md                 # Projekt-Meta (Titel, Säulen-Config, Beschreibung)
  nodes/<säule>/<id>.md      # jeder Knoten = Markdown + Frontmatter
  canvases/<id>.excalidraw   # Doodles als JSON (text, diff-bar)
  assets/<hash>-<dateiname>  # Drag&Drop-Anhänge (Bilder etc.)
  .git/                      # Historie = WER/wann + Wiederherstellung
```

**Knoten-Format** (Markdown mit Frontmatter):

```markdown
---
id: 01J7XYZ...            # stabile ID (ULID, beim Anlegen erzeugt)
title: Core Combat Loop
pillar: gameloop          # gameloop | artstyle | content | threads | scope
status: core              # core | side | future
kind: idea                # idea | alternative | note
parent: 01J6ABC...        # null = direkt unter der Säule
order: 3                  # Sortier-Index unter dem Parent
alternatives_to: null     # bei kind=alternative: ID des Knotens, zu dem dies eine Alt. ist
attachments: [assets/ab12-sketch.png]
canvas: canvases/01J7XYZ.excalidraw   # optional
created_by: ms
created_at: 2026-06-04T10:00:00Z
updated_by: ms
updated_at: 2026-06-04T10:00:00Z
---

Freitext-Markdown-Body der Idee. Beliebig lang, Listen, Links.
Querverweise auf andere Knoten via [[01J6ABC...]].
```

- **Baum** wird aus `parent` + `order` rekonstruiert.
- **Umsortieren / Verschieben** = `parent`/`order` im Frontmatter ändern → Git-Commit.
- **Status core/side/future** ist die „Reise"-Dimension (was ist Kern, was Beiwerk, was Zukunft).
- **Alternativen** = Knoten mit `kind: alternative` + `alternatives_to`; **Notizen/Vorschläge** = `kind: note`.
- **Backlinks** über `[[id]]` im Body.

**Historie & Autorschaft = Git:** Jeder Save erzeugt einen Commit im Projekt-Repo, `--author` = eingeloggter User. Damit:
- *Wer was wann* = `git log` / `git blame`.
- *Wiederherstellung* = Restore eines früheren Stands eines Knotens (UI macht intern `git show <commit>:<pfad>` und schreibt zurück).
- *Vorschläge dokumentiert* = Commit-Historie + `kind: note`/`alternative`-Knoten.

## 6. Architektur

**Ein Node-Prozess (Fastify)** serviert sowohl die statisch gebaute Frontend-App als auch die `/api`-Routen. `npm start`, kein Docker.

```
gamesketch/ (App-Quellcode, eigenes Git-Repo)
  package.json  vite.config.js
  server/
    index.js          # bootet Fastify, serviert /api + gebautes Frontend
    auth.js           # user:password, Session-Cookie
    storage/
      project.js      # Projekte anlegen/listen
      nodes.js        # Knoten lesen/schreiben/verschieben/löschen (Markdown+Frontmatter)
      git.js          # commit(author), log, restore  (via node:child_process)
      assets.js       # Datei-Uploads in assets/
    ai/
      extract.js      # Projekt/Teilbaum -> JSON + flaches Markdown
      assist.js       # Proxy an konfigurierten lokalen OpenAI-kompatiblen Endpunkt
    routes.js
  web/                # React + Vite Frontend
    src/...
  data/               # Laufzeitdaten (nicht im App-Repo)
    config.json       # Users, KI-Endpunkt-Config
    projects/<slug>/  # je ein Git-Repo (siehe §5)
```

- **Git** wird über `node:child_process` aufgerufen — keine Extra-Dependency.
- **Frontmatter** parsen/schreiben mit `gray-matter` (klein).

## 7. Auth (minimal, nur für Autorschaft)

- Users in `data/config.json`: `[{ name, passhash }]`. Hash via `node:crypto` **scrypt** (keine Auth-Lib).
- Login-Formular → Session-**Cookie** (httpOnly), signiert per HMAC (`node:crypto`).
- **Keine Rollen, keine Rechte.** Zweck ausschließlich: jeder Commit bekommt einen Autor → man sieht wer was machte. Dadurch automatisch **team-tauglich**, ohne jetzt Komplexität zu bauen.
- **First-Run:** Gibt es noch keinen User, führt ein Setup-Screen durch das Anlegen des ersten Users.

## 8. KI-Anbindung

**(a) Lese-API (read-only) — zum Rausziehen für externe Agents:**
- `GET /api/projects/:slug/export.json` → vollständiger, verschachtelter Baum als JSON.
- `GET /api/projects/:slug/export.md` → das ganze GDD flach als ein Markdown-Dokument (Überschriften nach Säule/Tiefe), LLM-freundlich.
- `GET /api/projects/:slug/nodes/:id/subtree.json` und `.../subtree.md` → beliebiger Teilbaum.
- Ein externer Agent (z.B. Claude Code) kann diese Endpunkte abrufen und das Design runterbrechen.

**(b) In-App-Assist (optional, schreibt nie automatisch):**
- Config in `data/config.json`: `{ ai: { baseUrl, model, apiKey? } }` → zeigt auf den **lokalen** OpenAI-kompatiblen Endpunkt des Nutzers (`/v1/chat/completions`).
- UI-Buttons: **„Lücken finden"**, **„Strang zusammenfassen"**, **„Alternative vorschlagen"**. Der Server baut aus dem relevanten Teilbaum (dessen flaches Markdown) einen Prompt, schickt ihn an den konfigurierten Endpunkt, zeigt das Ergebnis an.
- **Der Nutzer entscheidet**, ob ein Vorschlag als Knoten übernommen wird. Nie Auto-Schreiben, nie Cloud.

## 9. UX & Motion — „2026 smoothness" (Leitlinie, vom Nutzer betont)

Nicht starr — **flüssig, geil, intuitiv, überzeugend**. Konkret und für die Umsetzung verbindlich:

- **Physik statt linear:** Spring-basierte Animationen für Expand/Collapse, Drag, Knoten-Einfügen — kein hartes `ease`. Bevorzugt CSS-Transforms/`transition` und die **View-Transitions-API**; eine **leichtgewichtige Motion-Lib** (z.B. `motion`/Framer-Motion-Nachfolger oder `react-spring`) ist als bewusste Ausnahme erlaubt (gleiche Logik wie Excalidraw), CSS-first wo möglich.
- **Optimistic UI, keine Full-Page-Reloads:** Aktionen fühlen sich *sofort* an; Speichern passiert im Hintergrund (Commit), UI wartet nicht.
- **Tactile Interaktionen:** Knoten-Anlegen „ploppt" rein, Drag&Drop mit Ghost-Preview + Spring-Snap, Buttons mit spürbarem Press-Feedback, sanftes Säulen-Color-Theming.
- **Reibungsfreies Erfassen:** Outliner-Tastatur (Enter = Geschwister, Tab = Kind, Shift+Tab = ausrücken) — Ideen fliegen rein ohne Maus.
- **Ruhige, moderne Optik:** lokale Variable-Font, großzügiger Weißraum, dezente Tiefe (Schatten/Blur), Dark-Mode-fähig. Umgesetzt mit der `frontend-design`-Skill beim Bauen.
- **Performance = Gefühl:** 60fps-Interaktionen, keine Ruckler beim Aufklappen großer Bäume (Virtualisierung erst falls nötig).

## 10. API-Oberfläche (Überblick)

```
POST   /api/auth/login            {name, password} -> setzt Session-Cookie
POST   /api/auth/setup            (First-Run) ersten User anlegen
POST   /api/auth/logout

GET    /api/projects              Projekte listen
POST   /api/projects              {title} -> Projekt (Git-Repo) anlegen
GET    /api/projects/:slug        Projekt-Meta + voller Baum

POST   /api/projects/:slug/nodes              Knoten anlegen
PATCH  /api/projects/:slug/nodes/:id          Knoten bearbeiten/verschieben/Status
DELETE /api/projects/:slug/nodes/:id          Knoten löschen
GET    /api/projects/:slug/nodes/:id/history  Git-Historie des Knotens
POST   /api/projects/:slug/nodes/:id/restore  {commit} -> Stand wiederherstellen

POST   /api/projects/:slug/nodes/:id/attachments   Datei-Upload (Drag&Drop)
GET    /api/projects/:slug/canvases/:id            Excalidraw-JSON lesen
PUT    /api/projects/:slug/canvases/:id            Excalidraw-JSON speichern

GET    /api/projects/:slug/export.json
GET    /api/projects/:slug/export.md
GET    /api/projects/:slug/nodes/:id/subtree.json
GET    /api/projects/:slug/nodes/:id/subtree.md
POST   /api/projects/:slug/assist             {scope, action} -> lokaler LLM-Aufruf
```

## 11. Dependencies (das schlanke Versprechen)

**Backend:** `fastify`, `@fastify/static`, `gray-matter`. Git/Hash/Session = `node:child_process` + `node:crypto` (keine Libs).
**Frontend:** `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `@excalidraw/excalidraw`. Dazu Mini-Utils: Markdown-Render (`marked` + `dompurify`), Tree-Drag (`@dnd-kit` oder Eigenbau), Motion (siehe §9).

**Begründete größere Dependencies:** Excalidraw (Canvas/Doodles, vom Nutzer gewählt; React-basiert → deshalb ist das ganze Frontend React, *ein* Framework statt zwei) und die Motion-Lib (für die geforderte Smoothness). Beide laufen vollständig lokal, ohne Telemetrie.

## 12. Scope

**MVP (jetzt bauen):**
- Projekte anlegen/listen (je ein Git-Repo)
- 5-Säulen-Baum: add/edit/move/delete, Status core/side/future, Alternativen & Notizen
- Markdown-Editor mit Live-Vorschau
- Drag&Drop-Datei-Anhänge
- Excalidraw-Canvas pro Knoten
- Git-Historie pro Knoten + Restore
- Login (user:password), Autor pro Commit
- Lese-API (export.json/.md, subtree)
- KI-Assist gegen lokalen Endpunkt
- Vollständig lokal, kein Funk, `npm start`
- „2026-smooth" UX gemäß §9

**Bewusst Phase 2 (NICHT jetzt — gegen die Tool-Falle):**
- „KI baut/poliert den Prototyp" (eigenes, großes Folgeprodukt)
- Echtzeit-Team-Editing / Merge-UI
- Echte Rechte/Rollen
- Templates/Marketplace
- Volltext-Suche über alle Projekte (falls nötig später)

## 13. Entscheidungs-Log

- **Speicher:** Markdown + Git (statt SQLite/Hybrid) → KI-nativ, portabel, kein Lock-in, Git liefert Historie+Autor+Restore gratis. *(Nutzer bestätigt)*
- **Canvas:** Excalidraw eingebettet (statt tldraw/Eigenbau) → ausgereift, MIT, offline. *(Nutzer bestätigt)*
- **KI:** Lese-API + lokaler In-App-Assist (statt nur eines davon). *(Nutzer bestätigt)*
- **Frontend-Framework:** React + Vite (statt Svelte) — weil Excalidraw React ist; ein Framework statt Svelte+React-Insel. *(während Spec-Form bestätigt)*

## 14. Offene Punkte (für den Implementierungsplan)

- Genaue Wahl der Motion-Lib (CSS/View-Transitions vs. `motion` vs. `react-spring`) — im Plan festklopfen.
- Tree-DnD: `@dnd-kit` vs. Eigenbau (Abwägung Schlankheit vs. UX).
- ULID-Erzeugung: kleine Eigenimplementierung vs. winzige Lib.
