# Mini-Tracker und Ansichtsmodus

GameSketch bleibt ein Werkzeug für Ideen und Spielentwürfe. Der Tracker ist pro Idee freiwillig aktivierbar.

## Benutzung

1. **Ansicht als Standard** oben im Projekt einschalten. Beim Öffnen einer Idee erscheinen Titel, Text, Anhänge und Skizze als Ansicht. Der Tab **Text** öffnet weiterhin den Editor. Der Standard wird pro Benutzer in diesem Browser gespeichert.
2. In der Idee **Fortschritt aktivieren** wählen. Aufgaben oder Meilensteine hinzufügen und direkt in der Ansicht abhaken. Schritte lassen sich umbenennen und entfernen; die letzte Änderung kann über **Rückgängig** zurückgenommen werden.
3. **Abschließen** setzt diesen Stand ausdrücklich auf 100 %. Noch offene Schritte bleiben sichtbar und werden nicht heimlich abgehakt. **Wieder öffnen** gibt die Checkliste zur Bearbeitung frei und zeigt wieder deren tatsächlichen Fortschritt.
4. **Weiterentwickeln** legt aus einem fertigen Stand eine neue Version als Unteridee an: beispielsweise `Ausweichrolle → Ausweichrolle · v2 → Ausweichrolle · v3`. Text und Anhänge bleiben als Ausgangspunkt erhalten, die Skizze wird unabhängig kopiert. Andere Unterideen werden nicht kopiert. Wahlweise werden die Schritte als frische, offene Checkliste übernommen.
5. **Tracking ausblenden** nimmt die Idee aus dem Gesamtfortschritt heraus. Beim erneuten Aktivieren sind die Aufgaben wieder vorhanden.

## Bedeutung der Prozentwerte

- Aufgaben und Meilensteine zählen je einen Schritt. Einer von zwei erledigten Schritten ergibt 50 %.
- Ohne Schritte beginnt eine verfolgte Idee bei 0 %. Alle Schritte erledigt ergibt 100 %; neue Schritte dürfen ergänzt werden.
- Manuelles Abschließen übersteuert die Checkliste auf 100 %. Das ist ausdrücklich als manueller Abschluss gekennzeichnet.
- Unvollständige Checklisten werden auch bei Rundung nie als 100 % angezeigt.
- Der Gesamtwert ist der Durchschnitt der aktuell verfolgten Ideen. Jede Idee zählt gleich viel, unabhängig von der Zahl ihrer Schritte. Frühere Stände mit einer Folgeversion zählen nicht doppelt.
- Vorhandene Ideen mit dem bisherigen Status „In Arbeit“ oder „Fertig“ werden berücksichtigt. „In Arbeit“ ohne messbare Schritte erhält keinen erfundenen Zwischenwert, sondern 0 %. Neue Ideen ohne Tracking zählen nicht mit.
- Das ist ein Arbeitsüberblick, keine Schätzung von Stunden oder Restaufwand.

## Speicherung und Kompatibilität

`tracking` steht zusammen mit dem Text in der Markdown-Frontmatter:

```yaml
tracking:
  enabled: true
  completed: false
  tasks:
    - id: step-1
      title: Playtest bestehen
      kind: milestone
      done: false
```

Neue Ideen benötigen keinen Tracker. Bestehende Dateien werden nicht massenhaft umgeschrieben. Der bisherige `progress`-Status bleibt für bestehende Ansichten und Clients erhalten und wird bei aktivem Tracker aus dessen Aufgaben/Abschluss abgeleitet. `continued_from` verknüpft die neue Version mit ihrem Ausgangspunkt; `version` enthält ihre Nummer.

Einzelne Aufgabenänderungen laufen unter derselben Projektsperre wie andere Schreibvorgänge. Zwei Tabs können verschiedene Schritte ändern, ohne dabei jeweils die komplette Liste des anderen Tabs zu ersetzen. Wiederholtes Hinzufügen mit derselben Schritt-ID und derselben Beschreibung erzeugt keine Dublette. Wiederholtes Weiterentwickeln desselben Stands öffnet die bereits angelegte Folgeversion.

Aufgaben, Abschlüsse und Versionsbezüge bleiben in Backups, Wiederherstellung und Duplikaten erhalten. Der Textverlauf stellt auch die damalige Checkliste wieder her; die heutige Baumposition und Versionsverknüpfung bleiben dabei erhalten. Suche, Gesamtdokument und Exporte berücksichtigen die Checklisten.

Für API-Clients mit Schreibzugriff:

- `POST /api/projects/:slug/nodes/:id/tracking` mit `operation`: `enable`, `disable`, `add`, `edit`, `remove`, `complete` oder `reopen`.
- `add`: `task: { id, title, kind: "task" | "milestone" }`.
- `edit`: `taskId` und `patch` mit `title`, `done` und/oder `kind`.
- `remove`: `taskId`.
- `POST /api/projects/:slug/nodes/:id/continue` mit optionalem `title` und `carryTasks`.

Bis zu 200 Schritte pro Idee, maximal 500 Zeichen pro Schritt. Ein ausgeblendeter oder manuell abgeschlossener Tracker muss vor Änderungen wieder aktiviert beziehungsweise geöffnet werden.

## Prüfung des Updates

- 81 Tests für Speicherung, API, Berechnung und bestehende Logik bestanden; nach der letzten Eingabevalidierung die acht betroffenen Tracker-Tests erneut bestanden.
- 22 Browserabläufe in Microsoft Edge bestanden, einschließlich Autosave-Fehlern, Wiederherstellung, Aufgaben, Folgeversionen, Exporten und Copilot.
- Nach einer zusätzlichen Korrektur für schmale Ansichten die beiden betroffenen Browserabläufe erneut bestanden; Desktop und 390-Pixel-Ansicht auch visuell geprüft.
- Produktionsbuild erfolgreich. Die bekannte Größenwarnung für die Canvas-Bibliothek bleibt; neue Abhängigkeiten waren nicht nötig.
- Tests verwenden eigene temporäre Projekte und verändern keine vorhandenen Nutzerdaten.
