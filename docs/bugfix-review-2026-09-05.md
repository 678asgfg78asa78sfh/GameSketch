# Bugfix-Prüfung vom 05.09.2026

Die vorhandenen 45 Tests und der Build liefen bereits vor der Prüfung durch. Zusätzliche
Regressionstests haben Fehler aufgedeckt, die darin nicht abgedeckt waren.

| Problem | Korrektur |
| --- | --- |
| Titel und Text kurz nacheinander ändern: Der Autosave verwirft die erste Änderung. | Änderungen werden zusammengeführt, laufende Schreibvorgänge abgewartet und ausstehende Änderungen beim Knoten- oder Tabwechsel gespeichert. Fehler werden angezeigt und können erneut gespeichert werden. |
| Gleichzeitige Änderungen können sich überschreiben oder am Git-Index scheitern. | Lese-/Schreibvorgänge und Commits werden pro Projekt nacheinander ausgeführt; parallele Uploads behalten alle Verweise. |
| Eine reine Änderung von `order` löst eine Unteridee aus ihrem Elternknoten. | Ausgelassene Eltern bleiben erhalten; reine Kategorieänderungen an Wurzelknoten werden samt Unterbaum übernommen. |
| Neue Unterideen können die falsche Kategorie bekommen; ihre Reihenfolge springt. | Unterideen übernehmen die Elternkategorie und werden hinter bestehenden Geschwistern angelegt. Der Baum sortiert auch verschachtelte Ideen. |
| Wiederherstellen scheitert nach einem Kategorieumzug; Editor und Verlauf bleiben veraltet. | Historische Dateien werden über die stabile Knoten-ID gefunden. Inhalt und Status werden wiederhergestellt, Editor und Verlauf aktualisiert. Die aktuelle Baumstruktur bleibt erhalten. |
| Der Maximieren-Knopf ändert die nutzbare Breite nicht. | Der Editor nutzt die volle Breite; Escape oder Wiederherstellen zeigt den Baum wieder. Auch nach dem Löschen einer maximierten Idee bleibt der Baum erreichbar. |
| Canvas-Daten mit Bildern über 1 MB werden abgewiesen; Speicherfehler bleiben unsichtbar. | Eigenes JSON-Limit von 50 MB, sichtbare Lade-/Speicherfehler, erneutes Speichern und Speichern beim Tabwechsel. |
| Canvas-Schriften werden von einem CDN geladen. | Schriften werden beim Build lokal kopiert und lokal ausgeliefert. |
| Eine gleichzeitig bearbeitete Kategorie kann trotz neuer Ideen entfernt werden. | Die Prüfung erfolgt innerhalb desselben Schreibvorgangs wie die Kategorieänderung. |

Abhängigkeiten wurden aktualisiert. Für `@fastify/static` wurde die geänderte Header-API angepasst;
Vite bleibt auf der zu Node 20 passenden 6er-Version. Gezielte Overrides aktualisieren veraltete,
von Excalidraw bzw. seinem Diagrammparser fest vorgegebene Bibliotheksversionen.

## Validierung vor dem Funktionsausbau

- `npm test`: **57 bestanden**, keine übersprungen.
- `npm run test:e2e` mit `GS_BROWSER_CHANNEL=msedge`: **7 bestanden**, inklusive Produktionsbuild.
- Browserabläufe: Anmeldung, Projektanlage, Markdown-Vorschau, Upload/Download, schnelles Bearbeiten
  mit Knotenwechsel, Fehler mit erneutem Speichern, Verlauf, Maximieren/Löschen, verschachtelte
  Reihenfolge und Zeichnen samt Textelement ohne externe Schriftanfragen.
- `npm audit`: **0 bekannte Schwachstellen** zum Prüfzeitpunkt.

Die Prüfungen verwenden temporäre Testprojekte. Bestehende Nutzerdaten wurden nicht bearbeitet.
Externe KI-Anbieter wurden nicht live aufgerufen. Der Build meldet weiterhin die bereits vorhandene
Größenwarnung für nachgeladene Canvas-/Diagramm-Bundles.

Der anschließende Funktionsausbau und seine Prüfungen sind in [Workspace-Update](workspace-update-2026-09-05.md) dokumentiert.
