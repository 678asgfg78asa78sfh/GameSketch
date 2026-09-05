# GameSketch: Alltag und Produktfunktionen

Aufbauend auf den [Bugfixes](bugfix-review-2026-09-05.md) wurden die besprochenen Produktfunktionen umgesetzt.

| Bereich | Ergebnis |
| --- | --- |
| Wiederherstellen | Papierkorb für ganze Unterbäume samt Metadaten, Anhängen und Skizzen. Wiederhergestellte Unterideen folgen auch einem inzwischen verschobenen Elternknoten. |
| Rückgängig | Aktionsliste und direkte Rückgängig-Schaltfläche. Neuere Texte, neue Unterideen und nachträglich bearbeitete Kopie-Skizzen werden vor versehentlichem Verlust geschützt. |
| Backups | `.gamesketch` enthält Projektdateien, Medien, Papierkorb, Aktionsdaten und Git-Verlauf. Importiert wird ein neues Projekt; das Original bleibt bestehen. |
| Finden und Verknüpfen | Suche in Titel und Inhalt, Fortschritts-/Prioritätsfilter, Strg/Cmd+K; `[[id]]` und `[[id|Beschriftung]]`, Titelauswahl beim Tippen, Rückverweise und Pfadnavigation. |
| Dokument | Gesamtes GDD mit Inhaltsübersicht, Anhängen und Skizzen. HTML mit eingebetteten lokalen Medien, Drucken/PDF, Markdown und JSON. |
| Projektverwaltung | Umbenennen, Archivieren, aus Archiv holen, Duplizieren und Filtern. |
| Vorlagen | Ausgefüllte Vorlagen für Mechanik, Gegner und Playtest in DE/EN/RU sowie ein verknüpftes Beispielprojekt. |
| Copilot | Projekt- und benutzerspezifische Gespräche; laufende Antworten bleiben beim ursprünglichen Projekt. Vorher/nachher-Prüfung, gemeinsame Übernahme und gemeinsames Rückgängig einer Antwort. Veraltete Vorschläge werden abgewiesen; wiederholte Übernahme dupliziert nichts. |
| Bedienung | Duplizieren ganzer Unterbäume, Verschieben ohne Drag-and-drop, Hoch-/Runter-Tasten, gespeicherte Baumzustände, zugängliche Dateiauswahl, Bildvorschau, Anhänge entfernen mit Rückgängig. |
| Speichern | Wechsel warten auf laufende Speicherungen. Fehlgeschlagene Texte bleiben zusätzlich als lokale Entwürfe wiederherstellbar. Strg/Cmd+S speichert Text und Canvas sofort. |

Die projektweisen Schreibsperren gelten auch beim Lesen eines kompletten Projekts. Dadurch erscheint während einer mehrteiligen KI-Aktion kein halbfertiger Zwischenstand. Schlägt ein Teil fehl, werden bereits ausgeführte Textänderungen zurückgenommen.

## Grenzen

- Der Copilot erhält einen Projektüberblick aus Textauszügen (12.000 Zeichen insgesamt, andere Ideen bis 400 Zeichen). Die Oberfläche benennt die Abdeckung. Bilder und Skizzen werden nicht vom Modell analysiert.
- Backup-Dateien sind auf 100 MiB komprimiert / 200 MiB entpackt einschließlich Versionsdaten begrenzt. Größere Installationen können bei beendetem Server als Ordner gesichert werden.
- Benutzerkonten, API-Schlüssel und Browsergespräche sind nicht im Projektbackup enthalten. Lokale Entwürfe und Gespräche bleiben im jeweiligen Browser.
- Fremde Bild-URLs im Markdown bleiben im HTML-Export extern. Hochgeladene Medien und Canvas-Zeichnungen werden eingebettet.
- Rückgängig ersetzt keine Konfliktauflösung bei gleichzeitiger Bearbeitung desselben Texts durch mehrere Personen. Bei neueren betroffenen Änderungen wird die Aktion abgewiesen; der Textverlauf bleibt verfügbar.

## Prüfung

Die automatisierten Prüfungen verwenden ausschließlich temporäre Daten. Externe KI-Anbieter werden durch einen lokalen Testdienst ersetzt. Die Browserfälle prüfen echte Speicherung, Dateiimport/-download, SVG-Schriften ohne externe Anfragen, KI-Vorschläge und Projektwechsel. Desktop-, Dokument- und schmale Dialogansichten wurden zusätzlich visuell geprüft.

- `npm test`: **72 bestanden**, keine übersprungen.
- `npm run test:e2e` mit installiertem Microsoft Edge: **18 bestanden**, einschließlich Produktionsbuild.
- Die Druckprüfung kontrolliert den vorbereiteten vollständigen Druckinhalt; der Betriebssystemdialog wird dabei simuliert.
- `npm audit`: **0 bekannte Schwachstellen** zum Prüfzeitpunkt.
- `git diff --check` mit Berücksichtigung von CRLF: ohne Fehler.

Der Build meldet weiterhin Größenhinweise für die nachgeladenen Canvas-/Diagrammbibliotheken. Externe Modellqualität und Mehrbenutzerbearbeitung desselben Texts wurden nicht als Teil dieser Prüfung bewertet.

## Erneute Regressionsprüfung

- Nach einem erfolgreichen Speichern konnte ein fehlgeschlagenes anschließendes Neuladen den alten Text wieder im Editor anzeigen. Titel und Inhalt behalten jetzt ihren gespeicherten Stand; ungespeicherte Felder werden bei Aktualisierungen einzeln geschützt. Das fehlgeschlagene Neuladen lässt sich direkt wiederholen. Ein Browsertest prüft den Fehlerfall, das Wiederholen und den Inhalt nach einem vollständigen Seitenneustart.
- Ein gültiges Backup mit einem leeren Anhang wurde als ungültig zurückgewiesen: Die Prüfung verwechselte eine vorhandene leere Datei mit einer fehlenden Datei. Der Import prüft jetzt die Existenz des Dateieintrags. Ein zusätzlicher Test exportiert und importiert einen solchen Anhang.
- Das Installationsarchiv enthält jetzt auch die Dokumentation, auf die die README verweist.
