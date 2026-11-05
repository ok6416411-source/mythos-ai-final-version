# Echte Token-Anzeige und faire Limits

## Nächster Arbeitsschritt
- Verbrauchsdaten des KI-Anbieters statt geschätzter Textlängen in Website, Coding-App und CLI übernehmen.
- Eingabe-, Ausgabe- und Gesamtverbrauch anzeigen. Fehlende Anbieterwerte ausdrücklich als unbekannt kennzeichnen.
- Verbrauch zentral pro Benutzer erfassen und für Stunde, Woche und Monat auswerten.
- Vorhandene Limits erhalten, bis Token-Grenzen festgelegt sind; keine erfundenen Tarifgrenzen aktivieren.
- Neue Aufgaben bei ausgeschöpften Token-Grenzen sperren, bereits zugelassene Aufgaben einschließlich ihrer Fortsetzungen weiterlaufen lassen.

## Technische Umsetzung
- Gemeinsame Normalisierung von Streaming-Usage für Lovable und Google, mit Tests.
- Geschützte, benutzergebundene Aufgaben-Zulassung und zentrale Verbrauchserfassung; Zeitfenster sind rollierend (1 Stunde, 7 Tage, 30 Tage).
- Website, API und Desktop/CLI verwenden denselben Abrechnungsvertrag; Fortsetzungen benötigen einen vom Server ausgestellten Nachweis.
- Download-Pakete aktualisieren. Neue veröffentlichte EXE-/npm-Versionen benötigen weiterhin den externen Release-Prozess.

## Prüfung und Zwischenstand
- Tests für echte Verbrauchswerte, unbekannte Werte, Zeitfenster und Fortsetzung nach ausgeschöpftem Limit.
- Angemeldeten Website-Chat mit echter Antwort prüfen; App/CLI soweit ausführbar testen und übrige Prüfungen benennen.
- Danach kurzer Fortschrittsbericht mit offenen Punkten; Backend-Umzug und Tab-Hintergrundfortsetzung bleiben getrennte offene Aufgaben.